//! Host tools exposed to the live voice model for agent delegation.
//! Pure definitions + argument parsing (testable without network).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Tool schema sent to the realtime session (OpenAI-compatible function tools).
pub fn tool_definitions() -> Vec<Value> {
    vec![
        function_tool(
            "list_sessions",
            "List recent Grok Build agent sessions for the current project (id, title, busy).",
            json!({
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "minimum": 1, "maximum": 50 }
                }
            }),
        ),
        function_tool(
            "create_agent_session",
            "Create a new Grok Build agent session in the active project to do coding work. Prefer this for multi-step implementation tasks.",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Short session title" },
                    "prompt": {
                        "type": "string",
                        "description": "First instruction for the coding agent"
                    }
                },
                "required": ["prompt"]
            }),
        ),
        function_tool(
            "prompt_agent",
            "Send a follow-up instruction to an existing agent session (or the current live session if session_id is omitted).",
            json!({
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" },
                    "prompt": { "type": "string" }
                },
                "required": ["prompt"]
            }),
        ),
        function_tool(
            "get_agent_status",
            "Get status of an agent session: state, last activity, whether a permission or plan is waiting.",
            json!({
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" }
                }
            }),
        ),
        function_tool(
            "cancel_agent",
            "Cancel the in-flight turn on an agent session.",
            json!({
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" }
                }
            }),
        ),
        function_tool(
            "capture_screen_context",
            "Take a screenshot of the user's current desktop or active window so you can see what they're looking at. The result is a base64 PNG image. Only call when the user explicitly asks you to look at something.",
            json!({
                "type": "object",
                "properties": {
                    "window_only": {
                        "type": "boolean",
                        "description": "Only capture the active window instead of the full screen. Default false."
                    }
                }
            }),
        ),
        function_tool(
            "batch_create_agent",
            "Create multiple agent sessions in parallel for independent tasks. Use when the user says things like 'run explore and implement in parallel' or 'check all three things at once'. Each task gets its own dedicated agent session.",
            json!({
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string", "description": "Short task title" },
                                "prompt": { "type": "string", "description": "Task instruction for the coding agent" }
                            },
                            "required": ["prompt"]
                        },
                        "minItems": 1,
                        "maxItems": 5
                    }
                },
                "required": ["tasks"]
            }),
        ),
    ]
}

fn function_tool(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "type": "function",
        "name": name,
        "description": description,
        "parameters": parameters
    })
}

/// System / session instructions for the voice model.
pub fn live_voice_instructions(project_path: Option<&str>, project_name: Option<&str>) -> String {
    let project = project_name
        .or(project_path)
        .unwrap_or("the current workspace");
    format!(
        r#"You are Grok Live Voice in the Grok desktop coding workbench.
You speak briefly and clearly. You can listen and talk while coding agents work.

Project: {project}
{path_line}

Rules:
- You do NOT edit files yourself. For any implementation, debugging, tests, git, or multi-step work, call host tools: create_agent_session, prompt_agent, get_agent_status, cancel_agent, list_sessions.
- After starting work, keep the user updated in plain language. Offer to check status.
- Never invent tool results. Use tool returns only.
- Respect that the app shows permission prompts; if work is blocked on approval, tell the user to allow or deny in the UI.
- Prefer short spoken answers (1–3 sentences) unless the user asks for detail.
"#,
        path_line = project_path
            .map(|p| format!("Path: {p}"))
            .unwrap_or_default(),
    )
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VoiceToolName {
    ListSessions,
    CreateAgentSession,
    PromptAgent,
    GetAgentStatus,
    CancelAgent,
    CaptureScreenContext,
    BatchCreateAgent,
}

impl VoiceToolName {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "list_sessions" => Some(Self::ListSessions),
            "create_agent_session" => Some(Self::CreateAgentSession),
            "prompt_agent" => Some(Self::PromptAgent),
            "get_agent_status" => Some(Self::GetAgentStatus),
            "cancel_agent" => Some(Self::CancelAgent),
            "capture_screen_context" => Some(Self::CaptureScreenContext),
            "batch_create_agent" => Some(Self::BatchCreateAgent),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct CreateAgentArgs {
    pub title: Option<String>,
    pub prompt: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct PromptAgentArgs {
    pub session_id: Option<String>,
    pub prompt: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct SessionRefArgs {
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ListSessionsArgs {
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct CaptureScreenArgs {
    pub window_only: Option<bool>,
}

pub fn parse_capture_screen_args(raw: &str) -> Result<CaptureScreenArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid capture_screen_context args: {e}"))?;
    let window_only = v.get("window_only").and_then(|x| x.as_bool());
    Ok(CaptureScreenArgs { window_only })
}

pub fn parse_create_agent_args(raw: &str) -> Result<CreateAgentArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid create_agent_session args: {e}"))?;
    let prompt = v
        .get("prompt")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if prompt.is_empty() {
        return Err("create_agent_session requires prompt".into());
    }
    let title = v
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Ok(CreateAgentArgs { title, prompt })
}

pub fn parse_prompt_agent_args(raw: &str) -> Result<PromptAgentArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid prompt_agent args: {e}"))?;
    let prompt = v
        .get("prompt")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if prompt.is_empty() {
        return Err("prompt_agent requires prompt".into());
    }
    let session_id = v
        .get("session_id")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Ok(PromptAgentArgs {
        session_id,
        prompt,
    })
}

pub fn parse_session_ref_args(raw: &str) -> Result<SessionRefArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid session args: {e}"))?;
    let session_id = v
        .get("session_id")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Ok(SessionRefArgs { session_id })
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct BatchTask {
    pub title: Option<String>,
    pub prompt: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct BatchCreateAgentArgs {
    pub tasks: Vec<BatchTask>,
}

pub fn parse_batch_create_agent_args(raw: &str) -> Result<BatchCreateAgentArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid batch_create_agent args: {e}"))?;
    let tasks: Vec<BatchTask> = v
        .get("tasks")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let prompt = item
                        .get("prompt")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    if prompt.is_empty() {
                        return None;
                    }
                    let title = item
                        .get("title")
                        .and_then(|x| x.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());
                    Some(BatchTask { title, prompt })
                })
                .collect()
        })
        .unwrap_or_default();
    if tasks.is_empty() {
        return Err("batch_create_agent requires at least one task with a prompt".into());
    }
    if tasks.len() > 5 {
        return Err("batch_create_agent supports at most 5 tasks at once".into());
    }
    Ok(BatchCreateAgentArgs { tasks })
}

pub fn parse_list_sessions_args(raw: &str) -> Result<ListSessionsArgs, String> {
    let v: Value = serde_json::from_str(if raw.trim().is_empty() { "{}" } else { raw })
        .map_err(|e| format!("invalid list_sessions args: {e}"))?;
    let limit = v.get("limit").and_then(|x| x.as_u64()).map(|n| n as u32);
    Ok(ListSessionsArgs { limit })
}

/// Mock tool executor for tests / GROK_APP_VOICE=mock without a live agent.
pub fn mock_execute_tool(name: &str, args_json: &str) -> Result<Value, String> {
    let tool = VoiceToolName::parse(name).ok_or_else(|| format!("unknown tool: {name}"))?;
    match tool {
        VoiceToolName::ListSessions => {
            let _ = parse_list_sessions_args(args_json)?;
            Ok(json!({
                "sessions": [
                    { "id": "mock-1", "title": "Mock session", "state": "ready" }
                ]
            }))
        }
        VoiceToolName::CreateAgentSession => {
            let a = parse_create_agent_args(args_json)?;
            Ok(json!({
                "session_id": "mock-new",
                "title": a.title.unwrap_or_else(|| "Voice task".into()),
                "accepted_prompt": a.prompt,
                "state": "streaming"
            }))
        }
        VoiceToolName::PromptAgent => {
            let a = parse_prompt_agent_args(args_json)?;
            Ok(json!({
                "session_id": a.session_id.unwrap_or_else(|| "live".into()),
                "accepted_prompt": a.prompt,
                "state": "streaming"
            }))
        }
        VoiceToolName::GetAgentStatus => {
            let a = parse_session_ref_args(args_json)?;
            Ok(json!({
                "session_id": a.session_id.unwrap_or_else(|| "live".into()),
                "state": "ready",
                "summary": "Mock agent is idle and ready."
            }))
        }
        VoiceToolName::CancelAgent => {
            let a = parse_session_ref_args(args_json)?;
            Ok(json!({
                "session_id": a.session_id.unwrap_or_else(|| "live".into()),
                "cancelled": true
            }))
        }
        VoiceToolName::BatchCreateAgent => {
            let a = parse_batch_create_agent_args(args_json)?;
            let sessions: Vec<Value> = a
                .tasks
                .iter()
                .enumerate()
                .map(|(i, t)| {
                    json!({
                        "session_id": format!("mock-batch-{}", i + 1),
                        "title": t.title.clone().unwrap_or_else(|| format!("Task {}", i + 1)),
                        "accepted_prompt": t.prompt,
                        "state": "streaming"
                    })
                })
                .collect();
            Ok(json!({ "sessions": sessions }))
        }
        VoiceToolName::CaptureScreenContext => {
            let _ = parse_capture_screen_args(args_json)?;
            Ok(json!({
                "mime": "image/png",
                "width": 1440,
                "height": 900,
                "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "note": "mock screenshot (1x1 transparent PNG)"
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_nonempty() {
        assert!(tool_definitions().len() >= 4);
    }

    #[test]
    fn parse_create_requires_prompt() {
        assert!(parse_create_agent_args("{}").is_err());
        let a = parse_create_agent_args(r#"{"prompt":"fix tests","title":"T"}"#).unwrap();
        assert_eq!(a.prompt, "fix tests");
        assert_eq!(a.title.as_deref(), Some("T"));
    }

    #[test]
    fn mock_create() {
        let v = mock_execute_tool(
            "create_agent_session",
            r#"{"prompt":"run cargo test"}"#,
        )
        .unwrap();
        assert_eq!(v["session_id"], "mock-new");
    }

    #[test]
    fn parse_batch_requires_tasks() {
        assert!(parse_batch_create_agent_args("{}").is_err());
        let a = parse_batch_create_agent_args(
            r#"{"tasks":[{"prompt":"cargo test","title":"Test"}]}"#,
        )
        .unwrap();
        assert_eq!(a.tasks.len(), 1);
        assert_eq!(a.tasks[0].prompt, "cargo test");
        assert_eq!(a.tasks[0].title.as_deref(), Some("Test"));
    }

    #[test]
    fn parse_batch_rejects_empty_tasks() {
        assert!(parse_batch_create_agent_args(r#"{"tasks":[]}"#).is_err());
    }

    #[test]
    fn parse_batch_rejects_too_many() {
        let tasks: Vec<serde_json::Value> = (0..6)
            .map(|i| serde_json::json!({"prompt": format!("task {i}")}))
            .collect();
        let raw = serde_json::json!({ "tasks": tasks }).to_string();
        assert!(parse_batch_create_agent_args(&raw).is_err());
    }

    #[test]
    fn mock_batch_create() {
        let v = mock_execute_tool(
            "batch_create_agent",
            r#"{"tasks":[{"prompt":"task1"},{"prompt":"task2","title":"T2"}]}"#,
        )
        .unwrap();
        let sessions = v["sessions"].as_array().unwrap();
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0]["session_id"], "mock-batch-1");
        assert_eq!(sessions[1]["session_id"], "mock-batch-2");
        assert_eq!(sessions[1]["title"], "T2");
    }

    #[test]
    fn instructions_include_project() {
        let s = live_voice_instructions(Some("/tmp/app"), Some("app"));
        assert!(s.contains("app"));
        assert!(s.contains("create_agent_session"));
    }
}
