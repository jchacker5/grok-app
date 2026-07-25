//! Voice catalog via xAI REST API (Settings → Voice picker).

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::voice_auth;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceOption {
    pub voice_id: String,
    pub name: String,
    pub language: String,
}

fn mock_voices() -> Vec<VoiceOption> {
    [
        ("ara", "Ara"),
        ("eve", "Eve"),
        ("leo", "Leo"),
        ("rex", "Rex"),
        ("sal", "Sal"),
    ]
    .into_iter()
    .map(|(voice_id, name)| VoiceOption {
        voice_id: voice_id.into(),
        name: name.into(),
        language: "en".into(),
    })
    .collect()
}

/// List built-in + custom voices available for the realtime voice API.
pub async fn list_voices() -> Result<Vec<VoiceOption>, String> {
    if std::env::var("GROK_APP_VOICE")
        .map(|v| v == "mock")
        .unwrap_or(false)
    {
        return Ok(mock_voices());
    }

    let token = voice_auth::resolve_bearer_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.x.ai/v1/tts/voices")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("voices request failed: {e}"))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("voices read body: {e}"))?;
    if !status.is_success() {
        let snippet: String = body.chars().take(240).collect();
        return Err(format!("voices HTTP {status}: {snippet}"));
    }

    let v: Value =
        serde_json::from_str(&body).map_err(|e| format!("voices JSON: {e}; body={body}"))?;
    let list = v
        .as_array()
        .or_else(|| v.get("voices").and_then(|x| x.as_array()))
        .or_else(|| v.get("data").and_then(|x| x.as_array()))
        .cloned()
        .unwrap_or_default();

    let voices = list
        .into_iter()
        .filter_map(|item| {
            let voice_id = item.get("voice_id").and_then(|x| x.as_str())?.to_string();
            let name = item
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or(&voice_id)
                .to_string();
            let language = item
                .get("language")
                .and_then(|x| x.as_str())
                .unwrap_or("en")
                .to_string();
            Some(VoiceOption {
                voice_id,
                name,
                language,
            })
        })
        .collect::<Vec<_>>();

    if voices.is_empty() {
        return Ok(mock_voices());
    }
    Ok(voices)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mock_list_voices() {
        std::env::set_var("GROK_APP_VOICE", "mock");
        let voices = list_voices().await.unwrap();
        let ids: Vec<&str> = voices.iter().map(|v| v.voice_id.as_str()).collect();
        assert_eq!(ids, vec!["ara", "eve", "leo", "rex", "sal"]);
        assert!(voices.iter().all(|v| v.language == "en"));
        std::env::remove_var("GROK_APP_VOICE");
    }
}
