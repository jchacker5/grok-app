//! Embedded terminal PTY lifecycle and bounded remount scrollback.

use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::Arc;

use parking_lot::Mutex;
use portable_pty::{
    native_pty_system, Child, CommandBuilder, MasterPty, PtySize, PtySystem,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::process_limits;

const DEFAULT_SCROLLBACK_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellSpec {
    pub program: String,
    pub args: Vec<String>,
}

pub fn resolve_shell(
    env_shell: Option<&str>,
    comspec: Option<&str>,
    is_windows: bool,
) -> ShellSpec {
    let program = if is_windows {
        comspec
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("powershell.exe")
    } else {
        env_shell
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("/bin/zsh")
    };
    ShellSpec {
        program: program.to_string(),
        args: Vec::new(),
    }
}

pub fn trim_scrollback(existing: &str, incoming: &str, max_bytes: usize) -> String {
    if max_bytes == 0 {
        return String::new();
    }
    let combined = format!("{existing}{incoming}");
    if combined.len() <= max_bytes {
        return combined;
    }
    let mut start = combined.len() - max_bytes;
    while start < combined.len() && !combined.is_char_boundary(start) {
        start += 1;
    }
    combined[start..].to_string()
}

pub fn split_utf8_boundary(bytes: &[u8]) -> (&[u8], &[u8]) {
    if bytes.is_empty() {
        return (bytes, bytes);
    }
    let mut start = bytes.len();
    while start > 0 && bytes[start - 1] & 0b1100_0000 == 0b1000_0000 {
        start -= 1;
    }
    if start == bytes.len() {
        let expected = match bytes[bytes.len() - 1] {
            0xC2..=0xDF => 2,
            0xE0..=0xEF => 3,
            0xF0..=0xF4 => 4,
            _ => return (bytes, &bytes[bytes.len()..]),
        };
        if expected > 1 {
            return (&bytes[..bytes.len() - 1], &bytes[bytes.len() - 1..]);
        }
    }
    if start == 0 {
        return (bytes, &bytes[bytes.len()..]);
    }
    let lead = start - 1;
    let expected = match bytes[lead] {
        0xC2..=0xDF => 2,
        0xE0..=0xEF => 3,
        0xF0..=0xF4 => 4,
        _ => return (bytes, &bytes[bytes.len()..]),
    };
    let actual = bytes.len() - lead;
    if actual < expected {
        (&bytes[..lead], &bytes[lead..])
    } else {
        (bytes, &bytes[bytes.len()..])
    }
}

pub struct ScrollbackBuffer {
    lines: VecDeque<String>,
    max_bytes: usize,
}

impl ScrollbackBuffer {
    fn new(max_bytes: usize) -> Self {
        Self {
            lines: VecDeque::new(),
            max_bytes,
        }
    }

    fn push(&mut self, incoming: &str) {
        let existing = self.lines.iter().map(String::as_str).collect::<String>();
        let trimmed = trim_scrollback(&existing, incoming, self.max_bytes);
        self.lines.clear();
        if !trimmed.is_empty() {
            self.lines.push_back(trimmed);
        }
    }

    fn snapshot(&self) -> String {
        self.lines.iter().map(String::as_str).collect()
    }
}

pub struct TerminalHandle {
    id: String,
    child: Box<dyn Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
    scrollback: Arc<Mutex<ScrollbackBuffer>>,
    // portable-pty performs resize through the master handle.
    master: Box<dyn MasterPty + Send>,
}

pub struct TerminalManager {
    terminals: Mutex<HashMap<String, TerminalHandle>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    id: String,
    chunk: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    id: String,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }

    pub fn spawn(
        self: &Arc<Self>,
        app: AppHandle,
        requested_id: Option<String>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let mut terminals = self.terminals.lock();
        let id = requested_id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("terminal_{}", Uuid::new_v4()));
        if terminals.contains_key(&id) {
            return Ok(id);
        }
        let active = terminals.len() as u32;
        // Read live from settings (not cached at construction) so a change in
        // Settings takes effect on the next spawn without an app restart —
        // matches SessionManager::max_concurrent_from_settings().
        let max_concurrent = process_limits::normalize_max_concurrent(
            crate::store::load_settings().max_concurrent_terminals,
        );
        if !process_limits::can_spawn_process(active, max_concurrent) {
            return Err(format!(
                "Terminal process limit reached (max {max_concurrent})."
            ));
        }

        let shell = runtime_shell();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| format!("open terminal PTY: {error}"))?;

        let mut command = CommandBuilder::new(&shell.program);
        command.args(&shell.args);
        if let Some(cwd) = cwd.filter(|value| !value.trim().is_empty()) {
            command.cwd(cwd);
        }
        if let Some(path) = crate::process_util::enriched_path_env() {
            command.env("PATH", path);
        }
        command.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| {
                format!("spawn terminal shell {}: {error}", shell.program)
            })?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| format!("clone terminal reader: {error}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| format!("open terminal writer: {error}"))?;

        let scrollback = Arc::new(Mutex::new(ScrollbackBuffer::new(
            DEFAULT_SCROLLBACK_BYTES,
        )));
        terminals.insert(
            id.clone(),
            TerminalHandle {
                id: id.clone(),
                child,
                writer,
                scrollback: Arc::clone(&scrollback),
                master: pair.master,
            },
        );
        drop(terminals);

        let manager = Arc::clone(self);
        let terminal_id = id.clone();
        std::thread::Builder::new()
            .name(format!("terminal-reader-{terminal_id}"))
            .spawn(move || {
                let mut read_buf = [0_u8; 8192];
                let mut pending = Vec::new();
                loop {
                    match reader.read(&mut read_buf) {
                        Ok(0) => break,
                        Ok(read) => {
                            pending.extend_from_slice(&read_buf[..read]);
                            let (prefix, tail) = split_utf8_boundary(&pending);
                            let chunk = String::from_utf8_lossy(prefix).into_owned();
                            let next_pending = tail.to_vec();
                            if !chunk.is_empty() {
                                scrollback.lock().push(&chunk);
                                let _ = app.emit(
                                    "terminal://output",
                                    TerminalOutputPayload {
                                        id: terminal_id.clone(),
                                        chunk,
                                    },
                                );
                            }
                            pending = next_pending;
                        }
                        Err(error) => {
                            tracing::debug!("terminal reader {terminal_id} stopped: {error}");
                            break;
                        }
                    }
                }
                if !pending.is_empty() {
                    let chunk = String::from_utf8_lossy(&pending).into_owned();
                    scrollback.lock().push(&chunk);
                    let _ = app.emit(
                        "terminal://output",
                        TerminalOutputPayload {
                            id: terminal_id.clone(),
                            chunk,
                        },
                    );
                }
                let terminal = { manager.terminals.lock().remove(&terminal_id) };
                if let Some(mut terminal) = terminal {
                    let _ = terminal.child.wait();
                    let _ = app.emit(
                        "terminal://exit",
                        TerminalExitPayload {
                            id: terminal_id,
                        },
                    );
                }
            })
            .map_err(|error| {
                self.terminals.lock().remove(&id);
                format!("start terminal reader: {error}")
            })?;

        Ok(id)
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock();
        let terminal = terminals
            .get_mut(id)
            .ok_or_else(|| "terminal not found".to_string())?;
        terminal
            .writer
            .write_all(data.as_bytes())
            .and_then(|_| terminal.writer.flush())
            .map_err(|error| format!("write terminal: {error}"))
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let terminals = self.terminals.lock();
        let terminal = terminals
            .get(id)
            .ok_or_else(|| "terminal not found".to_string())?;
        terminal
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| format!("resize terminal: {error}"))
    }

    pub fn snapshot(&self, id: &str) -> Result<String, String> {
        let terminals = self.terminals.lock();
        let terminal = terminals
            .get(id)
            .ok_or_else(|| "terminal not found".to_string())?;
        let snapshot = terminal.scrollback.lock().snapshot();
        Ok(snapshot)
    }

    pub fn kill(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        let mut terminal = self
            .terminals
            .lock()
            .remove(id)
            .ok_or_else(|| "terminal not found".to_string())?;
        terminal
            .child
            .kill()
            .map_err(|error| format!("kill terminal: {error}"))?;
        let _ = terminal.child.wait();
        let _ = app.emit(
            "terminal://exit",
            TerminalExitPayload {
                id: terminal.id.clone(),
            },
        );
        Ok(())
    }

    pub fn active_count(&self) -> u32 {
        self.terminals.lock().len() as u32
    }
}

fn runtime_shell() -> ShellSpec {
    #[cfg(target_os = "windows")]
    {
        let powershell_available = which::which("powershell.exe").is_ok();
        let comspec = if powershell_available {
            None
        } else {
            std::env::var("COMSPEC").ok()
        };
        return resolve_shell(None, comspec.as_deref(), true);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let env_shell = std::env::var("SHELL").ok();
        let mut shell = resolve_shell(env_shell.as_deref(), None, false);
        if shell.program == "/bin/zsh" && !std::path::Path::new("/bin/zsh").is_file() {
            shell.program = "/bin/bash".into();
        }
        shell
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_shell_uses_configured_unix_shell() {
        assert_eq!(
            resolve_shell(Some("/opt/homebrew/bin/fish"), None, false),
            ShellSpec {
                program: "/opt/homebrew/bin/fish".into(),
                args: Vec::new(),
            },
        );
    }

    #[test]
    fn resolve_shell_defaults_to_zsh_on_unix() {
        assert_eq!(
            resolve_shell(None, None, false),
            ShellSpec {
                program: "/bin/zsh".into(),
                args: Vec::new(),
            },
        );
    }

    #[test]
    fn resolve_shell_defaults_to_powershell_on_windows() {
        assert_eq!(
            resolve_shell(None, None, true),
            ShellSpec {
                program: "powershell.exe".into(),
                args: Vec::new(),
            },
        );
    }

    #[test]
    fn resolve_shell_uses_comspec_as_windows_fallback() {
        assert_eq!(
            resolve_shell(None, Some(r"C:\Windows\System32\cmd.exe"), true),
            ShellSpec {
                program: r"C:\Windows\System32\cmd.exe".into(),
                args: Vec::new(),
            },
        );
    }

    #[test]
    fn trim_scrollback_leaves_text_under_cap_unchanged() {
        assert_eq!(trim_scrollback("hello", " world", 32), "hello world");
    }

    #[test]
    fn trim_scrollback_drops_oldest_text_without_splitting_utf8() {
        assert_eq!(trim_scrollback("abc🙂", "def", 8), "c🙂def");
    }

    #[test]
    fn split_utf8_boundary_passes_through_ascii() {
        let bytes = b"hello";
        assert_eq!(split_utf8_boundary(bytes), (&bytes[..], &bytes[5..]));
    }

    #[test]
    fn split_utf8_boundary_holds_incomplete_multibyte_tail() {
        let bytes = &[b'a', 0xF0, 0x9F, 0x99];
        assert_eq!(split_utf8_boundary(bytes), (&bytes[..1], &bytes[1..]));
    }

    #[test]
    fn split_utf8_boundary_handles_empty_input() {
        assert_eq!(split_utf8_boundary(&[]), (&[][..], &[][..]));
    }
}
