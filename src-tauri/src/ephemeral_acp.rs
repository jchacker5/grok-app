//! One-shot, ephemeral ACP session for silent text drafting (e.g. AI commit
//! messages). Spawns its own `grok agent stdio` child process — fully
//! independent of `SessionManager`'s focused/background/parked pool, so it
//! never disconnects or steals focus from the user's visible chat session.
//! The process is killed once the single prompt turn completes.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex as ParkingMutex;

use crate::acp_client::{AcpClient, AcpEvent, SpawnOptions, StreamKind};
use crate::cli_probe;

/// Grace period to let already-queued stream events drain after the
/// `session/prompt` RPC resolves, before we kill the ephemeral process.
const DRAIN_GRACE: Duration = Duration::from_secs(5);

/// Run a single silent prompt turn in a brand-new, throwaway agent process
/// and return the accumulated assistant text (no tool-call / thought noise).
///
/// `project_path` anchors the ephemeral session's cwd (so relative context —
/// e.g. `git diff --cached` the caller embeds in `prompt` — reads naturally);
/// it does not touch the caller's real working tree.
pub async fn run_ephemeral_prompt(
    project_path: &str,
    model_id: Option<&str>,
    prompt: &str,
) -> Result<String, String> {
    let project = project_path.trim();
    if project.is_empty() {
        return Err("empty project path".into());
    }
    let cwd = PathBuf::from(project);
    if !cwd.is_dir() {
        return Err(format!("project path not a directory: {project}"));
    }
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err("empty prompt".into());
    }

    let manual_path = crate::store::load_settings().manual_cli_path;
    let probe = cli_probe::probe_cli(manual_path.as_deref());
    if !probe.found {
        return Err(
            "Grok Build CLI not found. Install Grok Build or set path in Settings.".into(),
        );
    }
    let cli_path = PathBuf::from(
        probe
            .path
            .ok_or_else(|| "Grok Build CLI probe returned no path".to_string())?,
    );

    let opts = SpawnOptions {
        model_id: model_id.map(|s| s.to_string()),
        effort: None,
        // Silent one-shot draft: never block waiting on a permission prompt
        // this ephemeral session has no UI to answer.
        permission_policy: Some("dont_ask".into()),
    };

    let (client, mut events) =
        AcpClient::spawn_with_options(cli_path, cwd, opts).map_err(|e| e.message)?;

    let collected: Arc<ParkingMutex<String>> = Arc::new(ParkingMutex::new(String::new()));
    let collected_drain = Arc::clone(&collected);
    let drain = tokio::spawn(async move {
        while let Some(ev) = events.recv().await {
            match ev {
                AcpEvent::Stream {
                    kind: StreamKind::Assistant,
                    text,
                    done,
                    ..
                } => {
                    if !text.is_empty() {
                        collected_drain.lock().push_str(&text);
                    }
                    if done {
                        break;
                    }
                }
                AcpEvent::PromptComplete { .. } => break,
                AcpEvent::ProcessExited { .. } => break,
                AcpEvent::Error { error } => {
                    tracing::warn!("ephemeral acp: agent error event: {error:?}");
                }
                _ => {}
            }
        }
    });

    if let Err(e) = client.initialize_and_new_session().await {
        client.kill().await;
        let _ = tokio::time::timeout(DRAIN_GRACE, drain).await;
        return Err(format!("failed to start drafting session: {}", e.message));
    }

    let prompt_result = client.prompt(prompt).await;
    let _ = tokio::time::timeout(DRAIN_GRACE, drain).await;
    client.kill().await;

    if let Err(e) = prompt_result {
        return Err(format!("draft prompt failed: {}", e.message));
    }

    let text = collected.lock().clone();
    if text.trim().is_empty() {
        return Err("agent returned no text".into());
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_empty_project_path() {
        let err = run_ephemeral_prompt("", None, "draft a commit message")
            .await
            .unwrap_err();
        assert!(err.contains("empty project path"));
    }

    #[tokio::test]
    async fn rejects_missing_project_dir() {
        let err = run_ephemeral_prompt("/definitely/not/a/real/path/xyz", None, "hi")
            .await
            .unwrap_err();
        assert!(err.contains("not a directory"));
    }

    #[tokio::test]
    async fn rejects_empty_prompt() {
        let dir = std::env::temp_dir();
        let err = run_ephemeral_prompt(&dir.to_string_lossy(), None, "   ")
            .await
            .unwrap_err();
        assert!(err.contains("empty prompt"));
    }
}
