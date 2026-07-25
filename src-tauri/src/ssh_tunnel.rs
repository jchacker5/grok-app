//! SSH tunnel manager — convenience layer on top of the already-existing raw
//! TCP "ACP server (API mode)" remote connection (`store::AppSettings::acp_server_addr`,
//! `acp_client::connect_tcp`). That transport has no auth/TLS of its own; today
//! the user must hand-roll their own `ssh -L ...` tunnel before pointing the
//! app at `127.0.0.1:<port>`. This module spawns and supervises that tunnel
//! for them.
//!
//! Mirrors `AcpClient`'s process-supervision shape: spawn via `tokio::process`,
//! `.kill_on_drop(true)`, `process_util::apply_no_window_tokio` for Windows
//! console hiding, a background monitor task, and a bounded (exactly-once)
//! auto-respawn on unexpected exit.
//!
//! Security note: this does **not** add its own auth/TLS — it shells out to
//! the system `ssh` binary, which provides the encrypted, authenticated
//! channel. We only supervise the child process and confirm the local port
//! forward is actually listening.

use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::Mutex as AsyncMutex;
use tracing::warn;

/// How long to wait between forward-probe attempts after spawning ssh.
const PROBE_INTERVAL: Duration = Duration::from_millis(300);
/// Number of probe attempts before giving up (~3s total).
const PROBE_ATTEMPTS: u32 = 10;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TunnelState {
    Idle,
    Connecting,
    Connected { local_port: u16 },
    Error { message: String },
}

impl TunnelState {
    pub fn is_connected(&self) -> bool {
        matches!(self, TunnelState::Connected { .. })
    }
}

/// Human-readable, actionable error for a missing `ssh` binary — mirrors the
/// "clear, actionable message" tone of `cliDoctor.ts` on the frontend.
pub fn ssh_missing_message() -> String {
    "ssh executable not found on PATH. Install the OpenSSH Client and try again \
     (Windows: Settings → Optional Features → Add a feature → OpenSSH Client; \
     macOS/Linux: ssh usually ships with the OS, otherwise install openssh-client)."
        .to_string()
}

/// Pure builder for the `ssh` argv (excluding the `ssh` program name itself)
/// so the exact flags can be unit-tested without spawning a process.
pub fn ssh_args(remote_port: u16, local_port: u16, identity_file: Option<&str>, target: &str) -> Vec<String> {
    let mut args = vec![
        "-N".to_string(),
        "-L".to_string(),
        format!("{local_port}:localhost:{remote_port}"),
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ExitOnForwardFailure=yes".to_string(),
    ];
    if let Some(id) = identity_file {
        let id = id.trim();
        if !id.is_empty() {
            args.push("-i".to_string());
            args.push(id.to_string());
        }
    }
    args.push(target.to_string());
    args
}

fn spawn_ssh_child(
    target: &str,
    remote_port: u16,
    local_port: u16,
    identity_file: Option<&str>,
) -> std::io::Result<Child> {
    let mut cmd = Command::new("ssh");
    for a in ssh_args(remote_port, local_port, identity_file, target) {
        cmd.arg(a);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    crate::process_util::apply_no_window_tokio(&mut cmd);
    cmd.spawn()
}

/// Supervises a single `ssh -N -L ...` child process.
pub struct SshTunnelManager {
    child: AsyncMutex<Option<Child>>,
    state: AsyncMutex<TunnelState>,
    /// Set once the (single allowed) auto-respawn has been attempted, so the
    /// monitor task never respawns more than once per `start()` call.
    respawn_used: AtomicBool,
    /// Bumped on every `start()`/`stop()` so a stale monitor task from a
    /// previous tunnel does not act on a newer one.
    generation: std::sync::atomic::AtomicU64,
}

impl SshTunnelManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            child: AsyncMutex::new(None),
            state: AsyncMutex::new(TunnelState::Idle),
            respawn_used: AtomicBool::new(false),
            generation: std::sync::atomic::AtomicU64::new(0),
        })
    }

    pub async fn status(&self) -> TunnelState {
        self.state.lock().await.clone()
    }

    /// Kill the child (if any) and reset to `Idle`.
    pub async fn stop(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
        *self.state.lock().await = TunnelState::Idle;
    }

    /// Probe the local forward by attempting a real TCP connect. `ssh` can
    /// stay alive briefly before the forward actually binds, so "child alive"
    /// alone is not sufficient confirmation that the tunnel is usable.
    async fn wait_for_forward(local_port: u16) -> bool {
        for _ in 0..PROBE_ATTEMPTS {
            if TcpStream::connect(("127.0.0.1", local_port)).await.is_ok() {
                return true;
            }
            tokio::time::sleep(PROBE_INTERVAL).await;
        }
        false
    }

    pub async fn start(
        self: &Arc<Self>,
        target: &str,
        remote_port: u16,
        local_port: u16,
        identity_file: Option<&str>,
    ) -> Result<TunnelState, String> {
        let target = target.trim().to_string();
        if target.is_empty() {
            return Err("ssh target (user@host) is required".into());
        }
        if remote_port == 0 || local_port == 0 {
            return Err("remote_port and local_port must be non-zero".into());
        }
        which::which("ssh").map_err(|_| ssh_missing_message())?;

        // Replace any existing tunnel.
        self.stop().await;
        self.respawn_used.store(false, Ordering::SeqCst);
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        *self.state.lock().await = TunnelState::Connecting;

        let identity = identity_file
            .map(|s| s.trim())
            .filter(|s| !s.is_empty());

        let child = spawn_ssh_child(&target, remote_port, local_port, identity)
            .map_err(|e| format!("failed to spawn ssh: {e}"))?;
        *self.child.lock().await = Some(child);

        if !Self::wait_for_forward(local_port).await {
            let exited = {
                let mut guard = self.child.lock().await;
                match guard.as_mut() {
                    Some(c) => matches!(c.try_wait(), Ok(Some(_))),
                    None => true,
                }
            };
            self.stop().await;
            let msg = if exited {
                format!(
                    "ssh exited before the local forward on 127.0.0.1:{local_port} came up \
                     (check the target address, credentials, and that BatchMode auth \
                     — e.g. an SSH key with no passphrase or a running agent — is set up)"
                )
            } else {
                format!(
                    "timed out waiting for the local forward on 127.0.0.1:{local_port} to accept connections"
                )
            };
            *self.state.lock().await = TunnelState::Error { message: msg.clone() };
            return Err(msg);
        }

        let state = TunnelState::Connected { local_port };
        *self.state.lock().await = state.clone();
        self.spawn_monitor(generation, target, remote_port, local_port, identity.map(|s| s.to_string()));
        Ok(state)
    }

    /// Background task: waits for the child to exit; if the tunnel was still
    /// meant to be `Connected` (i.e. not a user-initiated `stop()`), attempts
    /// exactly one respawn, then surfaces `Error` if that also fails.
    fn spawn_monitor(
        self: &Arc<Self>,
        generation: u64,
        target: String,
        remote_port: u16,
        local_port: u16,
        identity_file: Option<String>,
    ) {
        let this = Arc::clone(self);
        tokio::spawn(async move {
            loop {
                let exit_status = {
                    let mut guard = this.child.lock().await;
                    match guard.as_mut() {
                        Some(child) => child.wait().await,
                        None => return,
                    }
                };
                // A newer start()/stop() has superseded this monitor.
                if this.generation.load(Ordering::SeqCst) != generation {
                    return;
                }
                let still_wanted = this.state.lock().await.is_connected();
                if !still_wanted {
                    return;
                }
                *this.child.lock().await = None;

                if this.respawn_used.swap(true, Ordering::SeqCst) {
                    *this.state.lock().await = TunnelState::Error {
                        message: "ssh tunnel exited again after the one allowed respawn; giving up".into(),
                    };
                    return;
                }

                warn!(
                    "ssh tunnel exited unexpectedly ({:?}); attempting one respawn (local_port={local_port})",
                    exit_status
                );
                match spawn_ssh_child(&target, remote_port, local_port, identity_file.as_deref()) {
                    Ok(child) => {
                        *this.child.lock().await = Some(child);
                        if this.generation.load(Ordering::SeqCst) != generation {
                            return;
                        }
                        if SshTunnelManager::wait_for_forward(local_port).await {
                            if this.generation.load(Ordering::SeqCst) != generation {
                                return;
                            }
                            *this.state.lock().await = TunnelState::Connected { local_port };
                            // Continue monitoring the respawned child; the
                            // `respawn_used` flag guarantees no further retries.
                            continue;
                        }
                        this.stop().await;
                        *this.state.lock().await = TunnelState::Error {
                            message: format!(
                                "ssh tunnel respawn failed: forward on 127.0.0.1:{local_port} did not come up"
                            ),
                        };
                        return;
                    }
                    Err(e) => {
                        *this.state.lock().await = TunnelState::Error {
                            message: format!("ssh tunnel respawn failed to spawn: {e}"),
                        };
                        return;
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env_lock::ENV_LOCK;

    #[test]
    fn ssh_args_basic_flags() {
        let args = ssh_args(8799, 18799, None, "user@host");
        assert_eq!(
            args,
            vec![
                "-N",
                "-L",
                "18799:localhost:8799",
                "-o",
                "BatchMode=yes",
                "-o",
                "ExitOnForwardFailure=yes",
                "user@host",
            ]
        );
    }

    #[test]
    fn ssh_args_includes_identity_file_when_set() {
        let args = ssh_args(8799, 18799, Some("/home/me/.ssh/id_ed25519"), "user@host");
        assert!(args.contains(&"-i".to_string()));
        let idx = args.iter().position(|a| a == "-i").unwrap();
        assert_eq!(args[idx + 1], "/home/me/.ssh/id_ed25519");
        // -i must come before the target (last arg).
        assert_eq!(args.last().unwrap(), "user@host");
    }

    #[test]
    fn ssh_args_skips_blank_identity_file() {
        let args = ssh_args(8799, 18799, Some("   "), "user@host");
        assert!(!args.contains(&"-i".to_string()));
    }

    #[test]
    fn tunnel_state_is_connected_helper() {
        assert!(!TunnelState::Idle.is_connected());
        assert!(!TunnelState::Connecting.is_connected());
        assert!(!TunnelState::Error { message: "x".into() }.is_connected());
        assert!(TunnelState::Connected { local_port: 1 }.is_connected());
    }

    #[tokio::test]
    async fn fresh_manager_status_is_idle() {
        let mgr = SshTunnelManager::new();
        assert_eq!(mgr.status().await, TunnelState::Idle);
    }

    #[tokio::test]
    async fn stop_without_start_is_a_noop() {
        let mgr = SshTunnelManager::new();
        mgr.stop().await;
        assert_eq!(mgr.status().await, TunnelState::Idle);
    }

    #[tokio::test]
    async fn start_rejects_empty_target() {
        let mgr = SshTunnelManager::new();
        let err = mgr.start("   ", 8799, 18799, None).await.unwrap_err();
        assert!(err.contains("target"));
    }

    #[tokio::test]
    async fn start_rejects_zero_ports() {
        let mgr = SshTunnelManager::new();
        let err = mgr.start("user@host", 0, 18799, None).await.unwrap_err();
        assert!(err.contains("port"));
    }

    /// Graceful, clearly-messaged failure when `ssh` is not on PATH — the
    /// scenario called out for stock Windows without the OpenSSH Client
    /// feature installed. We simulate "not found" portably by emptying PATH
    /// for the duration of the test (guarded by the shared env-mutation lock
    /// used elsewhere in the crate for process-global env vars).
    #[tokio::test]
    async fn start_reports_clear_error_when_ssh_missing() {
        let _g = ENV_LOCK.lock().unwrap();
        let prev_path = std::env::var("PATH").ok();
        std::env::set_var("PATH", "");

        let mgr = SshTunnelManager::new();
        let result = mgr.start("user@host", 8799, 18799, None).await;

        if let Some(p) = prev_path {
            std::env::set_var("PATH", p);
        } else {
            std::env::remove_var("PATH");
        }

        let err = result.expect_err("ssh should not be resolvable with empty PATH");
        assert!(err.to_lowercase().contains("ssh"));
        assert!(err.contains("OpenSSH") || err.to_lowercase().contains("not found"));
        assert_eq!(mgr.status().await, TunnelState::Idle);
    }

    // NOTE: we do not have a live SSH server available in CI/sandbox, so the
    // happy-path "connect + forward comes up + auto-respawn" flow is not
    // covered by an automated test here — it needs a reachable SSH host and
    // is exercised manually per the task's verification notes.
}
