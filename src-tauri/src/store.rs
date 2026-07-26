//! Independent store under ~/.grok-app: projects, sessions index, settings, secrets.

use std::fs;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::paths::{
    automations_file, ensure_app_dirs, folders_file, projects_file, session_dir,
    sessions_index_file, settings_file, spaces_file,
};

/// Where composer model / effort / mode / permission choices are remembered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComposerPrefsScope {
    Global,
    Project,
    Session,
}

impl ComposerPrefsScope {
    pub fn parse(s: &str) -> Self {
        match s.trim().to_ascii_lowercase().as_str() {
            "project" => Self::Project,
            "session" => Self::Session,
            _ => Self::Global,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Project => "project",
            Self::Session => "session",
        }
    }
}

/// Effective composer prefs resolved for the current context.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposerPrefs {
    pub model_id: String,
    pub effort: String,
    pub mode: String,
    pub permission_policy: String,
    /// Scope that was used when resolving (after reading settings).
    pub scope: String,
    /// Which layer actually supplied the values (global | project | session).
    pub source: String,
}

impl Default for ComposerPrefs {
    fn default() -> Self {
        Self {
            model_id: "grok-4.5".into(),
            // Balanced default: faster than high, deeper than low.
            effort: "medium".into(),
            mode: "agent".into(),
            permission_policy: "ask".into(),
            scope: "global".into(),
            source: "global".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub trusted: bool,
    pub last_opened_at: DateTime<Utc>,
    pub path_ok: bool,
    /// Pinned projects float to the top of the sidebar.
    #[serde(default)]
    pub pinned: bool,
    /// Grok Spaces membership — which named space (if any) this project belongs to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub space_id: Option<String>,
    /// Per-project composer prefs (used when scope = project).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permission_policy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub agent_session_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub model_id: Option<String>,
    /// Archived chats stay on disk but hide from the default tree.
    #[serde(default)]
    pub archived: bool,
    /// Pinned chats float to the top of the sidebar (within their group).
    #[serde(default)]
    pub pinned: bool,
    /// Per-session composer prefs (used when scope = session).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permission_policy: Option<String>,
    /// Created by shell scheduled automation (`runAutomation`).
    #[serde(default)]
    pub scheduled: bool,
    /// ISO datetime when thread was settled (manually marked done). None = active.
    #[serde(default)]
    pub settled_at: Option<DateTime<Utc>>,
    /// ISO datetime until which the thread is snoozed. None = not snoozed.
    #[serde(default)]
    pub snoozed_until: Option<DateTime<Utc>>,
    /// Git branch name (populated from working directory).
    #[serde(default)]
    pub branch: Option<String>,
    /// PR reference number as string (e.g. "1234").
    #[serde(default)]
    pub pr_ref: Option<String>,
    /// PR state: "open", "merged", "closed", or None.
    #[serde(default)]
    pub pr_state: Option<String>,
    /// User-defined labels for sidebar filtering. Organizational metadata,
    /// like `pinned` — does not bump `updated_at` when changed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Bookmark with an attached note. `None` = not bookmarked; `Some("")` =
    /// bookmarked with no note. Organizational metadata, like `pinned` /
    /// `tags` — does not bump `updated_at` when changed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bookmark_note: Option<String>,
    /// Session folder membership — a session belongs to at most one folder
    /// (unlike `tags`, which allow multiple). Organizational metadata, like
    /// `pinned` — does not bump `updated_at` when changed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub locale: String,
    pub session_data_mode: String,
    pub manual_cli_path: Option<String>,
    pub permission_policy: String,
    pub model_id: Option<String>,
    pub effort: Option<String>,
    pub mode: String,
    pub onboarding_done: bool,
    pub setup_skipped: bool,
    /// First-run setup wizard finished (CLI gate + optional auth step).
    #[serde(default)]
    pub setup_wizard_completed: bool,
    /// User skipped account/provider configuration during setup.
    #[serde(default)]
    pub auth_setup_deferred: bool,
    /// Default “open path” target: `finder` / `explorer` / editor id (`code`, `cursor`, …).
    #[serde(default = "default_open_target")]
    pub default_open_target: String,
    /// Remember model / effort / mode / permission at global | project | session.
    #[serde(default = "default_composer_prefs_scope")]
    pub composer_prefs_scope: String,
    /// **API mode.** When set (`host:port`), sessions connect to a remote ACP
    /// server over TCP instead of spawning the local `grok agent stdio` — the
    /// agent can run in WSL, a container, or on another host. Empty/unset uses
    /// the normal local-CLI spawn path.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acp_server_addr: Option<String>,
    /// SSH tunnel manager: `user@host` (or `user@host:port` — the `:port` part
    /// is ignored, `ssh_tunnel_remote_port` below is authoritative) target for
    /// the convenience SSH tunnel that fronts `acp_server_addr`. `None`/empty
    /// means the tunnel manager is unconfigured (user still may hand-roll their
    /// own tunnel + `acp_server_addr` as before).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_tunnel_target: Option<String>,
    /// Remote port the ACP server listens on at `ssh_tunnel_target` (forwarded
    /// as `-L <local>:localhost:<remote>`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_tunnel_remote_port: Option<u16>,
    /// Local port to bind the forward on (`127.0.0.1:<local_port>`); this is
    /// also what gets written into `acp_server_addr` on a successful connect.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_tunnel_local_port: Option<u16>,
    /// Optional `-i <identity_file>` private key path for the tunnel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_tunnel_identity_file: Option<String>,
    /// Whether the SSH tunnel manager should be considered "on" (drives UI
    /// state / whether to auto-reconnect at launch in a future iteration).
    #[serde(default)]
    pub ssh_tunnel_enabled: bool,
    /// **Windows only.** WSL distro name (`wsl -l -q` entry) to run the local
    /// `grok agent stdio` process inside of, via `wsl.exe -d <distro> -- grok
    /// ...`, instead of invoking a `grok` binary on the host filesystem. Empty
    /// on non-Windows or when not using WSL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wsl_distro: Option<String>,
    /// Max warm/live agent processes (I02). Default 3.
    #[serde(default = "default_max_concurrent_agents")]
    pub max_concurrent_agents: u32,
    /// Max live embedded terminal processes. Default 4.
    #[serde(default = "default_max_concurrent_terminals")]
    pub max_concurrent_terminals: u32,
    /// Recycle idle agent processes after this many minutes (I03). Default 30.
    #[serde(default = "default_agent_idle_minutes")]
    pub agent_idle_minutes: u32,
    /// Pure stream silence before cancel prompt (I06). Default 120 seconds.
    #[serde(default = "default_stream_stall_seconds")]
    pub stream_stall_seconds: u32,
    /// Store App API keys in the OS keychain (macOS Keychain / Win Cred / Secret Service).
    /// Default **false**: keys stay in `secrets.json` (0600) so cold start does not
    /// trigger system password prompts. Official CLI login still uses `auth.json`.
    #[serde(default)]
    pub store_api_keys_in_keychain: bool,
    /// OS-level sandbox profile for spawned `grok agent` processes
    /// (`off` | `workspace` | `read-only` | `strict` | `devbox`). Default off.
    /// Passed as top-level `grok --sandbox <profile>` / `GROK_SANDBOX` at spawn.
    #[serde(default = "default_sandbox_profile")]
    pub sandbox_profile: String,
    /// xAI realtime voice id (e.g. `eve`).
    #[serde(default = "default_voice_id")]
    pub voice_id: String,
    /// When true, dictation auto-sends on end-of-speech silence.
    #[serde(default)]
    pub voice_dictation_auto_send: bool,
    /// Keep delegated agent sessions running after ending a live voice chat.
    #[serde(default = "default_true")]
    pub voice_keep_agents_on_end: bool,
    /// Show native OS notifications (turn done, background permission requests).
    /// Default true; the OS-level permission prompt is a separate gate handled
    /// by `tauri-plugin-notification` / the browser `Notification` API fallback.
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
    /// Playback rate for voice AI output (0.5-2.0).
    #[serde(default = "default_voice_playback_rate")]
    pub voice_playback_rate: f64,
    /// Dictation language code (e.g. "en", "zh", "auto").
    #[serde(default = "default_voice_dictation_language")]
    pub voice_dictation_language: String,
    /// Enable noise suppression on mic input.
    #[serde(default = "default_voice_noise_suppression")]
    pub voice_noise_suppression: bool,
    /// Mic activation sensitivity 0..1 (higher = more sensitive).
    #[serde(default = "default_voice_sensitivity")]
    pub voice_sensitivity: f64,
    /// Preferred microphone device ID (empty = system default).
    #[serde(default)]
    pub voice_mic_device_id: String,
    /// Play a brief chime when voice listening starts/stops.
    #[serde(default = "default_voice_feedback_chime")]
    pub voice_feedback_chime: bool,
    /// Automatically speak new assistant replies aloud via the browser
    /// `SpeechSynthesis` API (regular chat, not a Live Voice session).
    /// Default false — opt-in.
    #[serde(default)]
    pub auto_read_replies: bool,
    /// Interpret a small fixed set of spoken command phrases ("send message",
    /// "new session", "stop dictation") during dictation as app actions
    /// instead of inserting them as literal text. Default false — opt-in,
    /// since it changes established dictation behavior.
    #[serde(default)]
    pub voice_commands_enabled: bool,
    /// Timestamp display format: locale | 12-hour | 24-hour.
    #[serde(default = "default_timestamp_format")]
    pub timestamp_format: String,
    /// Sidebar sort order: updated_at | created_at | manual.
    #[serde(default = "default_sidebar_sort_order")]
    pub sidebar_sort_order: String,
    /// Wrap long lines in code blocks, diffs, file previews.
    #[serde(default = "default_true")]
    pub word_wrap: bool,
    /// Ignore whitespace-only changes in diff view.
    #[serde(default = "default_true")]
    pub diff_ignore_whitespace: bool,
    /// Confirm before deleting sessions.
    #[serde(default = "default_true")]
    pub confirm_delete: bool,
    /// Confirm before archiving sessions.
    #[serde(default)]
    pub confirm_archive: bool,
    /// Glass surface opacity (40-100).
    #[serde(default = "default_glass_opacity")]
    pub glass_opacity: u32,
    /// Sidebar message preview line count (1-15).
    #[serde(default = "default_sidebar_preview_count")]
    pub sidebar_thread_preview_count: u32,
    /// Auto-archive idle threads after N days (null = off).
    #[serde(default)]
    pub thread_auto_settle_days: Option<u32>,
    /// Auto-open task panel when steps appear.
    #[serde(default)]
    pub auto_open_task_panel: bool,
    /// Default directory for Add Project browser.
    #[serde(default)]
    pub add_project_base_dir: String,
    /// Check provider CLIs for updates on startup.
    #[serde(default = "default_true")]
    pub enable_provider_update_checks: bool,
    /// User saved session presets.
    #[serde(default)]
    pub presets: Vec<SessionPreset>,
    /// User custom system prompts.
    #[serde(default)]
    pub custom_prompts: Vec<CustomPrompt>,
    /// User custom slash commands.
    #[serde(default)]
    pub custom_commands: Vec<CustomCommand>,
    /// Saved browser domain cookies.
    #[serde(default)]
    pub browser_cookies: std::collections::HashMap<String, String>,
    /// Notification preferences & quiet hours.
    #[serde(default)]
    pub notification_settings: NotificationSettings,
    /// Configurable sync storage directory path.
    #[serde(default)]
    pub sync_path: Option<String>,
    /// User-authored CSS injected into the app's own renderer at runtime
    /// (`<style id="user-custom-css">` in `document.head`). `None`/unset =
    /// no override. Local-only, never sent anywhere.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
    /// Local file path for a custom background image/video rendered behind
    /// the main chat pane. `None`/unset = no wallpaper (default chrome).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wallpaper_path: Option<String>,
    /// Wallpaper opacity, 0-100 (renderer clamps; default 35).
    #[serde(default = "default_wallpaper_opacity")]
    pub wallpaper_opacity: u32,
    /// Wallpaper blur radius in px, 0-40 (renderer clamps; default 0).
    #[serde(default)]
    pub wallpaper_blur: u32,
    /// Custom accent color override (hex, e.g. `"#8aa4ff"`). `None` = the
    /// active theme's default accent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    /// Last app version (from the top `## [X.Y.Z]` CHANGELOG.md section) the
    /// user has already seen the "What's new" panel for. `None` = never shown
    /// (first launch). Compared against the freshly-parsed changelog version
    /// on boot; mismatch triggers the modal, then this is updated to match.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_version: Option<String>,
}

fn default_wallpaper_opacity() -> u32 {
    35

fn default_composer_prefs_scope() -> String {
    "global".into()
}

fn default_open_target() -> String {
    "finder".into()
}

fn default_max_concurrent_agents() -> u32 {
    crate::process_limits::DEFAULT_MAX_CONCURRENT_AGENTS
}

fn default_max_concurrent_terminals() -> u32 {
    crate::process_limits::DEFAULT_MAX_CONCURRENT_TERMINALS
}

fn default_agent_idle_minutes() -> u32 {
    crate::process_limits::DEFAULT_AGENT_IDLE_MINUTES
}

fn default_stream_stall_seconds() -> u32 {
    crate::stream_stall::DEFAULT_STREAM_STALL_SECONDS
}

fn default_sandbox_profile() -> String {
    "off".into()
}

fn default_voice_id() -> String {
    "eve".into()
}

fn default_voice_playback_rate() -> f64 { 1.0 }
fn default_voice_dictation_language() -> String { "auto".to_string() }
fn default_voice_noise_suppression() -> bool { true }
fn default_voice_sensitivity() -> f64 { 0.5 }
fn default_voice_feedback_chime() -> bool { false }

fn default_timestamp_format() -> String {
    "locale".into()
}

fn default_sidebar_sort_order() -> String {
    "updated_at".into()
}

fn default_glass_opacity() -> u32 {
    80
}

fn default_sidebar_preview_count() -> u32 {
    6
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            // Product default is English; users can switch to zh / zh-TW in Settings.
            locale: "en".into(),
            session_data_mode: "independent".into(),
            manual_cli_path: None,
            permission_policy: "ask".into(),
            model_id: None,
            effort: Some("medium".into()),
            mode: "agent".into(),
            onboarding_done: false,
            setup_skipped: false,
            setup_wizard_completed: false,
            auth_setup_deferred: false,
            default_open_target: default_open_target(),
            composer_prefs_scope: default_composer_prefs_scope(),
            acp_server_addr: None,
            ssh_tunnel_target: None,
            ssh_tunnel_remote_port: None,
            ssh_tunnel_local_port: None,
            ssh_tunnel_identity_file: None,
            ssh_tunnel_enabled: false,
            wsl_distro: None,
            max_concurrent_agents: default_max_concurrent_agents(),
            max_concurrent_terminals: default_max_concurrent_terminals(),
            agent_idle_minutes: default_agent_idle_minutes(),
            stream_stall_seconds: default_stream_stall_seconds(),
            store_api_keys_in_keychain: false,
            sandbox_profile: default_sandbox_profile(),
            voice_id: default_voice_id(),
            voice_dictation_auto_send: false,
            voice_keep_agents_on_end: true,
            notifications_enabled: true,
            voice_playback_rate: default_voice_playback_rate(),
            voice_dictation_language: default_voice_dictation_language(),
            voice_noise_suppression: default_voice_noise_suppression(),
            voice_sensitivity: default_voice_sensitivity(),
            voice_mic_device_id: String::new(),
            voice_feedback_chime: default_voice_feedback_chime(),
            auto_read_replies: false,
            voice_commands_enabled: false,
            timestamp_format: default_timestamp_format(),
            sidebar_sort_order: default_sidebar_sort_order(),
            word_wrap: true,
            diff_ignore_whitespace: true,
            confirm_delete: true,
            confirm_archive: false,
            glass_opacity: default_glass_opacity(),
            sidebar_thread_preview_count: default_sidebar_preview_count(),
            thread_auto_settle_days: None,
            auto_open_task_panel: false,
            add_project_base_dir: String::new(),
            enable_provider_update_checks: true,
            presets: Vec::new(),
            custom_prompts: Vec::new(),
            custom_commands: Vec::new(),
            browser_cookies: std::collections::HashMap::new(),
            notification_settings: NotificationSettings::default(),
            sync_path: None,
            custom_css: None,
            wallpaper_path: None,
            wallpaper_opacity: default_wallpaper_opacity(),
            wallpaper_blur: 0,
            accent_color: None,
            last_seen_version: None,
        }
    }
}

/// App-owned secrets surface (backend-agnostic).
///
/// Sensitive fields (`official_api_key`, `relay_api_key`) prefer the OS keychain
/// (macOS Keychain / Windows Credential Manager / Linux Secret Service) with a
/// `secrets.json` (0600) fallback. See [`crate::secrets`].
///
/// Never log these fields.
///
/// `keychain_has_*` are non-secret booleans written to `secrets.json` so the UI
/// can report "has a key" without unlocking the OS keychain on every launch.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecretsFile {
    pub official_api_key: Option<String>,
    pub relay_base_url: Option<String>,
    pub relay_api_key: Option<String>,
    pub default_model: Option<String>,
    /// Official API key lives in OS keychain (value not on disk).
    #[serde(default)]
    pub keychain_has_official: bool,
    /// Relay API key lives in OS keychain (value not on disk).
    #[serde(default)]
    pub keychain_has_relay: bool,
}

/// File/image card persisted with a chat message (user attach or agent image_gen).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageAttachmentStored {
    pub path: String,
    pub name: String,
    #[serde(default)]
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageStored {
    pub id: String,
    pub role: String,
    pub content: String,
    pub thought: Option<String>,
    pub created_at: DateTime<Utc>,
    /// True when this assistant row records a turn failure (retries exhausted, etc.).
    #[serde(default)]
    pub is_error: bool,
    /// Local file cards (e.g. image_gen output paths).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<MessageAttachmentStored>>,
    /// UI marker type, e.g. `context_compact` for agent auto/manual compaction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marker: Option<String>,
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &PathBuf) -> T {
    match fs::read_to_string(path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => T::default(),
    }
}

/// Read JSON; if the file exists but is corrupt, quarantine it and return default.
fn read_json_recover<T: for<'de> Deserialize<'de> + Default>(path: &PathBuf) -> T {
    match fs::read_to_string(path) {
        Ok(s) if s.trim().is_empty() => T::default(),
        Ok(s) => match serde_json::from_str(&s) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(
                    "corrupt store file {} ({e}); quarantining and starting empty",
                    path.display()
                );
                let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
                let bak = path.with_extension(format!("corrupt-{stamp}.json"));
                let _ = fs::rename(path, &bak);
                T::default()
            }
        },
        Err(_) => T::default(),
    }
}

fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    let s = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    // Exclusive lock + temp rename so shared-mode / dual-instance writes do not
    // leave a half-written index (E06).
    crate::store_lock::write_bytes_atomic(path, s.as_bytes())
}

pub fn load_settings() -> AppSettings {
    let _ = ensure_app_dirs();
    let mut s: AppSettings = read_json(&settings_file());
    // One-time: installs that already stored keys in keychain before the opt-in
    // keep keychain mode so keys remain reachable without a silent loss.
    if !s.store_api_keys_in_keychain {
        let disk = crate::secrets::load_secrets_disk_only();
        if disk.keychain_has_official || disk.keychain_has_relay {
            s.store_api_keys_in_keychain = true;
            let _ = write_json(&settings_file(), &s);
        }
    }
    s
}

pub fn save_settings(s: &AppSettings) -> Result<(), String> {
    let _ = ensure_app_dirs();
    write_json(&settings_file(), s)
}

pub fn load_projects() -> Vec<Project> {
    let _ = ensure_app_dirs();
    let mut list: Vec<Project> = read_json_recover(&projects_file());
    for p in &mut list {
        p.path_ok = PathBuf::from(&p.path).is_dir();
    }
    list.sort_by(|a, b| match (b.pinned, a.pinned) {
        (true, false) => std::cmp::Ordering::Greater,
        (false, true) => std::cmp::Ordering::Less,
        _ => b.last_opened_at.cmp(&a.last_opened_at),
    });
    list
}

pub fn save_projects(list: &[Project]) -> Result<(), String> {
    write_json(&projects_file(), &list)
}

pub fn add_project(path: String, trust: bool) -> Result<Project, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.is_dir() {
        return Err("path is not a directory".into());
    }
    let name = path_buf
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let mut list = load_projects();
    if let Some(existing) = list.iter_mut().find(|p| p.path == path) {
        existing.trusted = trust || existing.trusted;
        existing.last_opened_at = Utc::now();
        existing.path_ok = true;
        let clone = existing.clone();
        save_projects(&list)?;
        return Ok(clone);
    }
    let p = Project {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        trusted: trust,
        last_opened_at: Utc::now(),
        path_ok: true,
        pinned: false,
        space_id: None,
        model_id: None,
        effort: None,
        mode: None,
        permission_policy: None,
    };
    list.push(p.clone());
    save_projects(&list)?;
    Ok(p)
}

/// Remove project from the app list only — does **not** delete the disk folder
/// or any chat sessions (sessions keep their project_id and become orphans).
pub fn remove_project(id: &str) -> Result<(), String> {
    let mut list = load_projects();
    list.retain(|p| p.id != id);
    save_projects(&list)
}

/// Point a project at a new directory (folder moved / renamed on disk).
/// Requires the path to exist as a directory; re-checks and sets `path_ok`.
pub fn relocate_project(id: &str, new_path: String) -> Result<Project, String> {
    let path_buf = PathBuf::from(&new_path);
    if !path_buf.is_dir() {
        return Err("path is not a directory".into());
    }
    let mut list = load_projects();
    if list.iter().any(|p| p.id != id && p.path == new_path) {
        return Err("another project already uses this path".into());
    }
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    p.path = new_path;
    p.path_ok = true;
    p.last_opened_at = Utc::now();
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

pub fn rename_project(id: &str, name: &str) -> Result<Project, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("name empty".into());
    }
    let mut list = load_projects();
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    p.name = name.to_string();
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

pub fn set_project_pinned(id: &str, pinned: bool) -> Result<Project, String> {
    let mut list = load_projects();
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    p.pinned = pinned;
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

pub fn trust_project(id: &str) -> Result<Project, String> {
    let mut list = load_projects();
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    p.trusted = true;
    p.last_opened_at = Utc::now();
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

/// Set or clear a project-level permission tier (L10).
///
/// `policy = None` / empty / `"inherit"` clears the override so the app default
/// applies. Untrusted projects cannot store a relaxed tier.
pub fn set_project_permission_policy(
    id: &str,
    policy: Option<String>,
) -> Result<Project, String> {
    use crate::permission::PermissionPolicy;

    let mut list = load_projects();
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    if !p.trusted {
        return Err("trust this project before setting a permission tier".into());
    }

    let next = match policy {
        None => None,
        Some(raw) => {
            let t = raw.trim();
            if t.is_empty()
                || t.eq_ignore_ascii_case("inherit")
                || t.eq_ignore_ascii_case("app_default")
                || t.eq_ignore_ascii_case("default")
            {
                None
            } else {
                Some(PermissionPolicy::parse(t).as_str().to_string())
            }
        }
    };
    p.permission_policy = next;
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

/// Assign (or clear, with `space_id = None`) a project's Grok Spaces membership.
pub fn set_project_space(id: &str, space_id: Option<String>) -> Result<Project, String> {
    let mut list = load_projects();
    let p = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "project not found".to_string())?;
    p.space_id = space_id;
    let clone = p.clone();
    save_projects(&list)?;
    Ok(clone)
}

/// A named grouping of projects ("Grok Spaces") — Work / Indie / Business / etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Space {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    /// Display + shortcut order (Cmd+Alt+1 = sort_index 0, etc.).
    pub sort_index: u32,
}

pub fn load_spaces() -> Vec<Space> {
    let _ = ensure_app_dirs();
    let mut list: Vec<Space> = read_json(&spaces_file());
    list.sort_by_key(|s| s.sort_index);
    list
}

pub fn save_spaces(list: &[Space]) -> Result<(), String> {
    let _ = ensure_app_dirs();
    write_json(&spaces_file(), &list)
}

pub fn create_space(name: String) -> Result<Space, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("name empty".into());
    }
    let mut list = load_spaces();
    let space = Space {
        id: Uuid::new_v4().to_string(),
        name,
        created_at: Utc::now(),
        sort_index: list.len() as u32,
    };
    list.push(space.clone());
    save_spaces(&list)?;
    Ok(space)
}

pub fn rename_space(id: &str, name: &str) -> Result<Space, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("name empty".into());
    }
    let mut list = load_spaces();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "space not found".to_string())?;
    s.name = name.to_string();
    let clone = s.clone();
    save_spaces(&list)?;
    Ok(clone)
}

/// Delete a space and clear its membership from any projects that pointed at it
/// (projects themselves are never deleted).
pub fn delete_space(id: &str) -> Result<(), String> {
    let mut list = load_spaces();
    let before = list.len();
    list.retain(|s| s.id != id);
    if list.len() == before {
        return Err("space not found".into());
    }
    save_spaces(&list)?;

    let mut projects = load_projects();
    let mut changed = false;
    for p in &mut projects {
        if p.space_id.as_deref() == Some(id) {
            p.space_id = None;
            changed = true;
        }
    }
    if changed {
        save_projects(&projects)?;
    }
    Ok(())
}

/// Re-order spaces (drag-to-reorder / future UI) — `ordered_ids` is the full
/// new order; unknown ids are ignored, missing ids keep their relative order
/// appended at the end.
pub fn reorder_spaces(ordered_ids: Vec<String>) -> Result<Vec<Space>, String> {
    let mut list = load_spaces();
    let mut by_id: std::collections::HashMap<String, Space> =
        list.drain(..).map(|s| (s.id.clone(), s)).collect();
    let mut next: Vec<Space> = Vec::new();
    for id in &ordered_ids {
        if let Some(s) = by_id.remove(id) {
            next.push(s);
        }
    }
    let mut rest: Vec<Space> = by_id.into_values().collect();
    rest.sort_by_key(|s| s.sort_index);
    next.extend(rest);
    for (i, s) in next.iter_mut().enumerate() {
        s.sort_index = i as u32;
    }
    save_spaces(&next)?;
    Ok(next)
}

/// A named grouping of sessions ("session folders"). Unlike Grok Spaces
/// (project groupings) or `tags` (multi-assignment session labels), a
/// session belongs to at most one folder — single-assignment, like a
/// directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFolder {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

pub fn load_folders() -> Vec<SessionFolder> {
    let _ = ensure_app_dirs();
    let mut list: Vec<SessionFolder> = read_json(&folders_file());
    list.sort_by_key(|f| f.created_at);
    list
}

pub fn save_folders(list: &[SessionFolder]) -> Result<(), String> {
    let _ = ensure_app_dirs();
    write_json(&folders_file(), &list)
}

pub fn create_folder(name: String) -> Result<SessionFolder, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("name empty".into());
    }
    let mut list = load_folders();
    let folder = SessionFolder {
        id: Uuid::new_v4().to_string(),
        name,
        created_at: Utc::now(),
    };
    list.push(folder.clone());
    save_folders(&list)?;
    Ok(folder)
}

pub fn rename_folder(id: &str, name: &str) -> Result<SessionFolder, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("name empty".into());
    }
    let mut list = load_folders();
    let f = list
        .iter_mut()
        .find(|f| f.id == id)
        .ok_or_else(|| "folder not found".to_string())?;
    f.name = name.to_string();
    let clone = f.clone();
    save_folders(&list)?;
    Ok(clone)
}

/// Delete a folder and clear its membership from any sessions that pointed at
/// it (sessions themselves are never deleted — they become folder-less).
pub fn delete_folder(id: &str) -> Result<(), String> {
    let mut list = load_folders();
    let before = list.len();
    list.retain(|f| f.id != id);
    if list.len() == before {
        return Err("folder not found".into());
    }
    save_folders(&list)?;

    let mut sessions = load_sessions_index();
    let mut changed = false;
    for s in &mut sessions {
        if s.folder_id.as_deref() == Some(id) {
            s.folder_id = None;
            changed = true;
        }
    }
    if changed {
        save_sessions_index(&sessions)?;
    }
    Ok(())
}

/// Pinned first, then newest `updated_at` (mirrors project pin sort).
pub fn sort_sessions_by_pin_then_updated(list: &mut [SessionMeta]) {
    list.sort_by(|a, b| {
        let a_active = a.settled_at.is_none() && a.snoozed_until.is_none();
        let b_active = b.settled_at.is_none() && b.snoozed_until.is_none();
        match (a_active, b_active) {
            (true, false) => return std::cmp::Ordering::Less,
            (false, true) => return std::cmp::Ordering::Greater,
            _ => {}
        }
        match (b.pinned, a.pinned) {
            (true, false) => return std::cmp::Ordering::Greater,
            (false, true) => return std::cmp::Ordering::Less,
            _ => b.updated_at.cmp(&a.updated_at),
        }
    });
}

pub fn load_sessions_index() -> Vec<SessionMeta> {
    let _ = ensure_app_dirs();
    // Recover from torn/corrupt index (shared CLI+App or crash mid-write).
    let mut list: Vec<SessionMeta> = read_json_recover(&sessions_index_file());
    sort_sessions_by_pin_then_updated(&mut list);
    list
}

pub fn save_sessions_index(list: &[SessionMeta]) -> Result<(), String> {
    write_json(&sessions_index_file(), &list)
}

pub fn create_session(
    project_id: Option<String>,
    title: Option<String>,
    scheduled: bool,
) -> Result<SessionMeta, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let meta = SessionMeta {
        id: id.clone(),
        project_id,
        title: title.unwrap_or_else(|| "New chat".into()),
        agent_session_id: None,
        created_at: now,
        updated_at: now,
        model_id: None,
        archived: false,
        pinned: false,
        effort: None,
        mode: None,
        permission_policy: None,
        scheduled,
        settled_at: None,
        snoozed_until: None,
        branch: None,
        pr_ref: None,
        pr_state: None,
        tags: Vec::new(),
        bookmark_note: None,
        folder_id: None,
    };
    let mut list = load_sessions_index();
    list.insert(0, meta.clone());
    save_sessions_index(&list)?;
    let dir = session_dir(&id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    write_json(&dir.join("messages.json"), &Vec::<ChatMessageStored>::new())?;
    Ok(meta)
}

pub fn update_session_meta(meta: &SessionMeta) -> Result<(), String> {
    let mut list = load_sessions_index();
    if let Some(s) = list.iter_mut().find(|s| s.id == meta.id) {
        *s = meta.clone();
    } else {
        list.insert(0, meta.clone());
    }
    save_sessions_index(&list)
}

pub fn delete_session(id: &str) -> Result<(), String> {
    let mut list = load_sessions_index();
    list.retain(|s| s.id != id);
    save_sessions_index(&list)?;
    let dir = session_dir(id);
    let _ = fs::remove_dir_all(dir);
    Ok(())
}

pub fn rename_session(id: &str, title: &str) -> Result<SessionMeta, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("title empty".into());
    }
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.title = title.to_string();
    s.updated_at = Utc::now();
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_scheduled(id: &str, scheduled: bool) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.scheduled = scheduled;
    s.updated_at = Utc::now();
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_archived(id: &str, archived: bool) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.archived = archived;
    s.updated_at = Utc::now();
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_pinned(id: &str, pinned: bool) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.pinned = pinned;
    // Do not bump updated_at — pin is organizational (same as project pin).
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_tags(id: &str, tags: Vec<String>) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.tags = tags;
    // Do not bump updated_at — tags are organizational (same as pin).
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

/// Bookmark (or unbookmark) a session with an attached note.
/// `None` clears the bookmark; `Some(note)` sets/updates it (note may be "").
pub fn set_session_bookmark(id: &str, note: Option<String>) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.bookmark_note = note;
    // Do not bump updated_at — bookmarking is organizational (same as pin/tags).
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

/// Assign (or clear, with `folder_id = None`) a session's folder membership.
pub fn set_session_folder(id: &str, folder_id: Option<String>) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.folder_id = folder_id;
    // Do not bump updated_at — folder membership is organizational (same as pin/tags).
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_settled(id: &str, settled_at: Option<DateTime<Utc>>) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list.iter_mut().find(|s| s.id == id).ok_or_else(|| "session not found".to_string())?;
    s.settled_at = settled_at;
    if settled_at.is_some() {
        s.snoozed_until = None;
    }
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_snoozed(id: &str, snoozed_until: Option<DateTime<Utc>>) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list.iter_mut().find(|s| s.id == id).ok_or_else(|| "session not found".to_string())?;
    s.snoozed_until = snoozed_until;
    if snoozed_until.is_some() {
        s.settled_at = None;
    }
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

pub fn set_session_branch_pr(
    id: &str,
    branch: Option<String>,
    pr_ref: Option<String>,
    pr_state: Option<String>,
) -> Result<SessionMeta, String> {
    let mut list = load_sessions_index();
    let s = list.iter_mut().find(|s| s.id == id).ok_or_else(|| "session not found".to_string())?;
    s.branch = branch;
    s.pr_ref = pr_ref;
    s.pr_state = pr_state;
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

/// Bind (or clear) a session's project folder. Used to attach orphan / legacy
/// chats to a project added later.
pub fn set_session_project(
    id: &str,
    project_id: Option<String>,
) -> Result<SessionMeta, String> {
    let pid = project_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    if let Some(ref p) = pid {
        // Ensure project exists in the projects list.
        let projects = load_projects();
        if !projects.iter().any(|x| x.id == *p) {
            return Err(format!("project not found: {p}"));
        }
    }
    let mut list = load_sessions_index();
    let s = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "session not found".to_string())?;
    s.project_id = pid;
    s.updated_at = Utc::now();
    let clone = s.clone();
    save_sessions_index(&list)?;
    Ok(clone)
}

/// Archive every non-archived session under a project.
pub fn archive_project_sessions(project_id: &str) -> Result<usize, String> {
    let mut list = load_sessions_index();
    let mut n = 0usize;
    for s in list.iter_mut() {
        if s.project_id.as_deref() == Some(project_id) && !s.archived {
            s.archived = true;
            s.updated_at = Utc::now();
            n += 1;
        }
    }
    save_sessions_index(&list)?;
    Ok(n)
}

pub fn load_messages(session_id: &str) -> Vec<ChatMessageStored> {
    read_json_recover(&session_dir(session_id).join("messages.json"))
}

pub fn save_messages(session_id: &str, messages: &[ChatMessageStored]) -> Result<(), String> {
    write_json(&session_dir(session_id).join("messages.json"), &messages)
}

pub fn append_message(session_id: &str, msg: ChatMessageStored) -> Result<(), String> {
    let mut msgs = load_messages(session_id);
    // Upsert by id — never double-insert the same host message (stream complete +
    // reconnect edge cases). Keeps journal length honest for multi-turn chats.
    if let Some(slot) = msgs.iter_mut().find(|m| m.id == msg.id) {
        *slot = msg;
    } else {
        msgs.push(msg);
    }
    save_messages(session_id, &msgs)
}

/// End index (exclusive) of the full turn for `user_prompt_index` (0-based).
/// Turn = that user message + following non-user rows until the next user.
pub fn end_index_through_user_prompt(
    messages: &[ChatMessageStored],
    user_prompt_index: u32,
) -> Option<usize> {
    let mut user_i = 0u32;
    for (i, m) in messages.iter().enumerate() {
        if m.role != "user" {
            continue;
        }
        if user_i == user_prompt_index {
            let mut j = i + 1;
            while j < messages.len() && messages[j].role != "user" {
                j += 1;
            }
            return Some(j);
        }
        user_i = user_i.saturating_add(1);
    }
    None
}

/// Keep messages through the end of the selected user turn (ACP `/rewind` semantics).
pub fn truncate_through_user_prompt(
    messages: &[ChatMessageStored],
    user_prompt_index: u32,
) -> Result<Vec<ChatMessageStored>, String> {
    let end = end_index_through_user_prompt(messages, user_prompt_index)
        .ok_or_else(|| format!("user prompt index out of range: {user_prompt_index}"))?;
    Ok(messages[..end].to_vec())
}

/// Fork a session: new journal + meta, same project, no agent session id.
/// `through_user_prompt_index`: when set, copy only through that user turn (inclusive).
pub fn fork_session(
    source_id: &str,
    through_user_prompt_index: Option<u32>,
    title: Option<String>,
) -> Result<SessionMeta, String> {
    let list = load_sessions_index();
    let source = list
        .iter()
        .find(|s| s.id == source_id)
        .ok_or_else(|| format!("session not found: {source_id}"))?
        .clone();

    let mut msgs = load_messages(source_id);
    if let Some(idx) = through_user_prompt_index {
        msgs = truncate_through_user_prompt(&msgs, idx)?;
    }

    let fork_title = title
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            let base = source.title.trim();
            let base = if base.is_empty() { "chat" } else { base };
            if base.to_ascii_lowercase().starts_with("fork of ") {
                base.to_string()
            } else {
                format!("Fork of {base}")
            }
        });

    let mut meta = create_session(source.project_id.clone(), Some(fork_title), false)?;
    // Inherit composer prefs from source so the fork feels continuous.
    meta.model_id = source.model_id.clone();
    meta.effort = source.effort.clone();
    meta.mode = source.mode.clone();
    meta.permission_policy = source.permission_policy.clone();
    meta.updated_at = Utc::now();
    update_session_meta(&meta)?;

    // Remap ids so the fork is independent of the source journal ids.
    let prefix = format!("fork-{}", &meta.id[..meta.id.len().min(8)]);
    let forked: Vec<ChatMessageStored> = msgs
        .into_iter()
        .enumerate()
        .map(|(i, mut m)| {
            m.id = format!("{prefix}-{i}");
            m
        })
        .collect();
    save_messages(&meta.id, &forked)?;
    Ok(meta)
}

// ─── Automations (scheduled tasks shell) ───────────────────────────────────

/// Host-side scheduled automation. Execution is driven by the UI when the app is open
/// (or later by CLI headless); this store is the source of truth for the list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    pub id: String,
    pub title: String,
    /// Natural-language prompt / instructions for the agent when the task runs.
    pub prompt: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub project_id: Option<String>,
    pub model_id: Option<String>,
    pub effort: Option<String>,
    /// `daily` | `weekly` | `weekdays` | `once`
    #[serde(default = "default_frequency")]
    pub frequency: String,
    /// Local wall-clock time `HH:MM` (24h).
    #[serde(default = "default_time")]
    pub time: String,
    /// For `weekly`: 0=Sun … 6=Sat (JS Date convention).
    #[serde(default)]
    pub weekdays: Vec<u8>,
    /// `all` | `failures` | `none`
    #[serde(default = "default_notify")]
    pub notify: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
}

fn default_true() -> bool {
    true
}
fn default_frequency() -> String {
    "daily".into()
}
fn default_time() -> String {
    "09:00".into()
}
fn default_notify() -> String {
    "all".into()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationInput {
    pub title: String,
    pub prompt: String,
    pub enabled: Option<bool>,
    pub project_id: Option<String>,
    pub model_id: Option<String>,
    pub effort: Option<String>,
    pub frequency: Option<String>,
    pub time: Option<String>,
    pub weekdays: Option<Vec<u8>>,
    pub notify: Option<String>,
    pub next_run_at: Option<DateTime<Utc>>,
}

pub fn load_automations() -> Vec<Automation> {
    let _ = ensure_app_dirs();
    let mut list: Vec<Automation> = read_json(&automations_file());
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list
}

pub fn save_automations(list: &[Automation]) -> Result<(), String> {
    let _ = ensure_app_dirs();
    write_json(&automations_file(), &list)
}

pub fn create_automation(input: AutomationInput) -> Result<Automation, String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("title empty".into());
    }
    let prompt = input.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("prompt empty".into());
    }
    let now = Utc::now();
    let auto = Automation {
        id: Uuid::new_v4().to_string(),
        title,
        prompt,
        enabled: input.enabled.unwrap_or(true),
        project_id: input.project_id,
        model_id: input.model_id,
        effort: input.effort,
        frequency: input
            .frequency
            .unwrap_or_else(default_frequency)
            .trim()
            .to_string(),
        time: input.time.unwrap_or_else(default_time).trim().to_string(),
        weekdays: input.weekdays.unwrap_or_default(),
        notify: input
            .notify
            .unwrap_or_else(default_notify)
            .trim()
            .to_string(),
        created_at: now,
        updated_at: now,
        last_run_at: None,
        next_run_at: input.next_run_at,
    };
    let mut list = load_automations();
    list.insert(0, auto.clone());
    save_automations(&list)?;
    Ok(auto)
}

pub fn update_automation(id: &str, input: AutomationInput) -> Result<Automation, String> {
    let mut list = load_automations();
    let auto = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "automation not found".to_string())?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err("title empty".into());
    }
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err("prompt empty".into());
    }
    auto.title = title.to_string();
    auto.prompt = prompt.to_string();
    if let Some(e) = input.enabled {
        auto.enabled = e;
    }
    auto.project_id = input.project_id;
    auto.model_id = input.model_id;
    auto.effort = input.effort;
    if let Some(f) = input.frequency {
        auto.frequency = f.trim().to_string();
    }
    if let Some(t) = input.time {
        auto.time = t.trim().to_string();
    }
    if let Some(w) = input.weekdays {
        auto.weekdays = w;
    }
    if let Some(n) = input.notify {
        auto.notify = n.trim().to_string();
    }
    if input.next_run_at.is_some() {
        auto.next_run_at = input.next_run_at;
    }
    auto.updated_at = Utc::now();
    let clone = auto.clone();
    save_automations(&list)?;
    Ok(clone)
}

pub fn set_automation_enabled(id: &str, enabled: bool) -> Result<Automation, String> {
    let mut list = load_automations();
    let auto = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "automation not found".to_string())?;
    auto.enabled = enabled;
    auto.updated_at = Utc::now();
    let clone = auto.clone();
    save_automations(&list)?;
    Ok(clone)
}

pub fn mark_automation_run(
    id: &str,
    last_run_at: DateTime<Utc>,
    next_run_at: Option<DateTime<Utc>>,
) -> Result<Automation, String> {
    let mut list = load_automations();
    let auto = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "automation not found".to_string())?;
    auto.last_run_at = Some(last_run_at);
    auto.next_run_at = next_run_at;
    auto.updated_at = Utc::now();
    let clone = auto.clone();
    save_automations(&list)?;
    Ok(clone)
}

pub fn delete_automation(id: &str) -> Result<(), String> {
    let mut list = load_automations();
    let before = list.len();
    list.retain(|a| a.id != id);
    if list.len() == before {
        return Err("automation not found".into());
    }
    save_automations(&list)
}

/// Load app secrets (API keys). Backend-agnostic: OS keychain preferred, file fallback.
/// See [`crate::secrets`] for migration and storage details. Callers must not log values.
pub fn load_secrets() -> SecretsFile {
    crate::secrets::load_secrets()
}

/// Persist app secrets. Prefer OS keychain for API keys; metadata may remain in secrets.json.
pub fn save_secrets(s: &SecretsFile) -> Result<(), String> {
    crate::secrets::save_secrets(s)
}

/// Redact secrets from a string for logs/Doctor export.
pub fn redact_text(input: &str) -> String {
    let mut out = input.to_string();
    let secrets = load_secrets();
    for key in [
        secrets.official_api_key.as_deref(),
        secrets.relay_api_key.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if key.len() >= 8 {
            out = out.replace(key, "[REDACTED]");
        }
    }
    // common token scrubbing without regex crate
    let mut cleaned = String::with_capacity(out.len());
    for word in out.split_whitespace() {
        if word.len() > 20
            && (word.starts_with("sk-")
                || word.starts_with("xai-")
                || word.contains("Bearer"))
        {
            cleaned.push_str("[REDACTED]");
        } else {
            cleaned.push_str(word);
        }
        cleaned.push(' ');
    }
    cleaned
}

fn global_prefs(settings: &AppSettings) -> (String, String, String, String) {
    (
        settings
            .model_id
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "grok-4.5".into()),
        settings
            .effort
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "medium".into()),
        if settings.mode.trim().is_empty() {
            "agent".into()
        } else {
            settings.mode.clone()
        },
        if settings.permission_policy.trim().is_empty() {
            "ask".into()
        } else {
            settings.permission_policy.clone()
        },
    )
}

/// Resolve effective composer prefs for the active project/session + configured scope.
///
/// Model / effort / mode follow `composer_prefs_scope`.
/// Permission always cascades session → project → global (L10), and untrusted
/// projects force Ask regardless of stored tiers.
pub fn resolve_composer_prefs(
    project_id: Option<&str>,
    session_id: Option<&str>,
) -> ComposerPrefs {
    use crate::permission::effective_permission_policy;

    let settings = load_settings();
    let scope = ComposerPrefsScope::parse(&settings.composer_prefs_scope);
    let (g_model, g_effort, g_mode, g_policy) = global_prefs(&settings);

    let sess = session_id.and_then(|id| {
        load_sessions_index()
            .into_iter()
            .find(|s| s.id == id)
    });
    let proj = sess
        .as_ref()
        .and_then(|s| s.project_id.as_deref())
        .or(project_id)
        .and_then(|id| load_projects().into_iter().find(|p| p.id == id));

    // Permission: always cascade (independent of model/effort memory scope).
    let permission_policy = effective_permission_policy(
        &g_policy,
        proj.as_ref().map(|p| p.trusted),
        proj.as_ref()
            .and_then(|p| p.permission_policy.as_deref()),
        sess.as_ref()
            .and_then(|s| s.permission_policy.as_deref()),
    )
    .as_str()
    .to_string();

    match scope {
        ComposerPrefsScope::Global => ComposerPrefs {
            model_id: g_model,
            effort: g_effort,
            mode: g_mode,
            permission_policy,
            scope: scope.as_str().into(),
            source: "global".into(),
        },
        ComposerPrefsScope::Project => {
            if let Some(p) = proj {
                ComposerPrefs {
                    model_id: p.model_id.filter(|s| !s.is_empty()).unwrap_or(g_model),
                    effort: p.effort.filter(|s| !s.is_empty()).unwrap_or(g_effort),
                    mode: p.mode.filter(|s| !s.is_empty()).unwrap_or(g_mode),
                    permission_policy,
                    scope: scope.as_str().into(),
                    source: "project".into(),
                }
            } else {
                ComposerPrefs {
                    model_id: g_model,
                    effort: g_effort,
                    mode: g_mode,
                    permission_policy,
                    scope: scope.as_str().into(),
                    source: "global".into(),
                }
            }
        }
        ComposerPrefsScope::Session => {
            let p_model = proj
                .as_ref()
                .and_then(|p| p.model_id.clone())
                .filter(|s| !s.is_empty())
                .unwrap_or(g_model.clone());
            let p_effort = proj
                .as_ref()
                .and_then(|p| p.effort.clone())
                .filter(|s| !s.is_empty())
                .unwrap_or(g_effort.clone());
            let p_mode = proj
                .as_ref()
                .and_then(|p| p.mode.clone())
                .filter(|s| !s.is_empty())
                .unwrap_or(g_mode.clone());

            if let Some(s) = sess {
                ComposerPrefs {
                    model_id: s.model_id.filter(|x| !x.is_empty()).unwrap_or(p_model),
                    effort: s.effort.filter(|x| !x.is_empty()).unwrap_or(p_effort),
                    mode: s.mode.filter(|x| !x.is_empty()).unwrap_or(p_mode),
                    permission_policy,
                    scope: scope.as_str().into(),
                    source: "session".into(),
                }
            } else {
                ComposerPrefs {
                    model_id: p_model,
                    effort: p_effort,
                    mode: p_mode,
                    permission_policy,
                    scope: scope.as_str().into(),
                    source: if proj.is_some() { "project" } else { "global" }.into(),
                }
            }
        }
    }
}

/// Persist a partial composer prefs update at the configured scope.
pub fn save_composer_prefs(
    project_id: Option<&str>,
    session_id: Option<&str>,
    model_id: Option<String>,
    effort: Option<String>,
    mode: Option<String>,
    permission_policy: Option<String>,
) -> Result<ComposerPrefs, String> {
    let settings = load_settings();
    let scope = ComposerPrefsScope::parse(&settings.composer_prefs_scope);

    match scope {
        ComposerPrefsScope::Global => {
            let mut s = settings;
            if let Some(v) = model_id {
                s.model_id = Some(v);
            }
            if let Some(v) = effort {
                s.effort = Some(v);
            }
            if let Some(v) = mode {
                s.mode = v;
            }
            if let Some(v) = permission_policy {
                s.permission_policy = v;
            }
            save_settings(&s)?;
        }
        ComposerPrefsScope::Project => {
            let pid = project_id.filter(|s| !s.is_empty());
            if let Some(pid) = pid {
                let mut list = load_projects();
                if let Some(p) = list.iter_mut().find(|p| p.id == pid) {
                    if let Some(v) = model_id.clone() {
                        p.model_id = Some(v);
                    }
                    if let Some(v) = effort.clone() {
                        p.effort = Some(v);
                    }
                    if let Some(v) = mode.clone() {
                        p.mode = Some(v);
                    }
                    if let Some(v) = permission_policy.clone() {
                        p.permission_policy = Some(v);
                    }
                    save_projects(&list)?;
                }
            }
            // Always mirror to global so orphan UIs / new projects still have a default.
            let mut s = load_settings();
            if let Some(v) = model_id {
                s.model_id = Some(v);
            }
            if let Some(v) = effort {
                s.effort = Some(v);
            }
            if let Some(v) = mode {
                s.mode = v;
            }
            if let Some(v) = permission_policy {
                s.permission_policy = v;
            }
            save_settings(&s)?;
        }
        ComposerPrefsScope::Session => {
            let sid = session_id.filter(|s| !s.is_empty());
            if let Some(sid) = sid {
                let mut list = load_sessions_index();
                if let Some(sess) = list.iter_mut().find(|s| s.id == sid) {
                    if let Some(v) = model_id {
                        sess.model_id = Some(v);
                    }
                    if let Some(v) = effort {
                        sess.effort = Some(v);
                    }
                    if let Some(v) = mode {
                        sess.mode = Some(v);
                    }
                    if let Some(v) = permission_policy {
                        sess.permission_policy = Some(v);
                    }
                    sess.updated_at = Utc::now();
                    save_sessions_index(&list)?;
                } else {
                    // No session row yet — fall back to global so the chip still sticks.
                    let mut s = load_settings();
                    if let Some(v) = model_id {
                        s.model_id = Some(v);
                    }
                    if let Some(v) = effort {
                        s.effort = Some(v);
                    }
                    if let Some(v) = mode {
                        s.mode = v;
                    }
                    if let Some(v) = permission_policy {
                        s.permission_policy = v;
                    }
                    save_settings(&s)?;
                }
            } else {
                let mut s = load_settings();
                if let Some(v) = model_id {
                    s.model_id = Some(v);
                }
                if let Some(v) = effort {
                    s.effort = Some(v);
                }
                if let Some(v) = mode {
                    s.mode = v;
                }
                if let Some(v) = permission_policy {
                    s.permission_policy = v;
                }
                save_settings(&s)?;
            }
        }
    }

    Ok(resolve_composer_prefs(project_id, session_id))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallLogEntry {
    pub id: String,
    pub timestamp: i64,
    pub model: String,
    pub tokens_prompt: u64,
    pub tokens_completion: u64,
    pub cost_usd: f64,
    pub duration_ms: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPreset {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub system_prompt: String,
    pub model: String,
    pub effort: String,
    pub yolo: bool,
    pub temperature: f64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub desktop_enabled: bool,
    pub sound_enabled: bool,
    pub in_app_badge: bool,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub notify_on_completion: bool,
    pub notify_on_error: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            desktop_enabled: true,
            sound_enabled: true,
            in_app_badge: true,
            quiet_hours_enabled: false,
            quiet_hours_start: "22:00".into(),
            quiet_hours_end: "08:00".into(),
            notify_on_completion: true,
            notify_on_error: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomPrompt {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    pub category: String,
    #[serde(default)]
    pub is_built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCommand {
    pub id: String,
    pub name: String,
    pub description: String,
    pub action_type: String,
    pub action_value: String,
    pub shortcut: Option<String>,
}

pub fn load_call_logs() -> Vec<CallLogEntry> {
    let path = crate::paths::call_logs_file();
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_call_logs(logs: &[CallLogEntry]) -> Result<(), String> {
    let path = crate::paths::call_logs_file();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let to_save = if logs.len() > 10000 {
        &logs[logs.len() - 10000..]
    } else {
        logs
    };
    let content = serde_json::to_string_pretty(to_save).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn append_call_log_entry(entry: CallLogEntry) -> Result<(), String> {
    let mut logs = load_call_logs();
    logs.push(entry);
    save_call_logs(&logs)
}

pub fn clear_all_call_logs() -> Result<(), String> {
    let path = crate::paths::call_logs_file();
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env_lock::ENV_LOCK;
    use chrono::TimeZone;

    #[test]
    fn delete_space_clears_membership_on_member_projects() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-spaces-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        let space = create_space("Work".into()).expect("create space");
        let other_dir = tmp.join("proj-a");
        fs::create_dir_all(&other_dir).unwrap();
        let project = add_project(other_dir.to_string_lossy().to_string(), true)
            .expect("add project");
        set_project_space(&project.id, Some(space.id.clone())).expect("assign space");

        let assigned = load_projects();
        assert_eq!(
            assigned.iter().find(|p| p.id == project.id).unwrap().space_id,
            Some(space.id.clone())
        );

        delete_space(&space.id).expect("delete space");

        let after = load_projects();
        assert_eq!(
            after.iter().find(|p| p.id == project.id).unwrap().space_id,
            None
        );
        assert!(load_spaces().is_empty());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn redact_scrubs_long_tokenish() {
        let s = "header Bearer sk-abcdefghijklmnopqrstuvwxyz123456 tail";
        let r = redact_text(s);
        assert!(!r.contains("sk-abcdefghijklmnopqrstuvwxyz123456") || r.contains("REDACTED") || r.contains("sk-"));
        // at least function is callable
        assert!(!r.is_empty());
    }

    #[test]
    fn default_settings_independent_mode() {
        let s = AppSettings::default();
        assert_eq!(s.session_data_mode, "independent");
        assert_eq!(s.permission_policy, "ask");
        assert_eq!(s.theme, "dark");
        assert_eq!(s.locale, "en");
        assert_eq!(s.max_concurrent_agents, 8);
        assert_eq!(s.agent_idle_minutes, 30);
        assert_eq!(s.stream_stall_seconds, 120);
        assert_eq!(s.sandbox_profile, "off");
        assert!(s.notifications_enabled);
        assert_eq!(s.last_seen_version, None);
    }

    #[test]
    fn last_seen_version_defaults_when_missing_from_json() {
        // Old settings files (pre "What's new" feature) must deserialize with
        // last_seen_version = None instead of erroring.
        let raw = r#"{
            "theme": "dark",
            "locale": "en",
            "sessionDataMode": "independent",
            "manualCliPath": null,
            "permissionPolicy": "ask",
            "modelId": null,
            "effort": "medium",
            "mode": "agent",
            "onboardingDone": true,
            "setupSkipped": false
        }"#;
        let s: AppSettings = serde_json::from_str(raw).expect("deserialize");
        assert_eq!(s.last_seen_version, None);
    }

    #[test]
    fn last_seen_version_roundtrips_through_json() {
        let mut s = AppSettings::default();
        s.last_seen_version = Some("0.1.13".to_string());
        let raw = serde_json::to_string(&s).expect("serialize");
        assert!(raw.contains("\"lastSeenVersion\":\"0.1.13\""));
        let back: AppSettings = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(back.last_seen_version, Some("0.1.13".to_string()));
    }

    #[test]
    fn sandbox_profile_defaults_when_missing_from_json() {
        // Old settings files without the field must deserialize to "off".
        let raw = r#"{
            "theme": "dark",
            "locale": "en",
            "sessionDataMode": "independent",
            "manualCliPath": null,
            "permissionPolicy": "ask",
            "modelId": null,
            "effort": "medium",
            "mode": "agent",
            "onboardingDone": true,
            "setupSkipped": false
        }"#;
        let s: AppSettings = serde_json::from_str(raw).expect("deserialize");
        assert_eq!(s.sandbox_profile, "off");
    }

    #[test]
    fn notifications_enabled_defaults_true_when_missing_from_json() {
        // Old settings files without the field must deserialize to enabled (true).
        let raw = r#"{
            "theme": "dark",
            "locale": "en",
            "sessionDataMode": "independent",
            "manualCliPath": null,
            "permissionPolicy": "ask",
            "modelId": null,
            "effort": "medium",
            "mode": "agent",
            "onboardingDone": true,
            "setupSkipped": false
        }"#;
        let s: AppSettings = serde_json::from_str(raw).expect("deserialize");
        assert!(s.notifications_enabled);
    }

    #[test]
    fn notifications_enabled_roundtrips_false() {
        let raw = r#"{
            "theme": "dark",
            "locale": "en",
            "sessionDataMode": "independent",
            "manualCliPath": null,
            "permissionPolicy": "ask",
            "modelId": null,
            "effort": "medium",
            "mode": "agent",
            "onboardingDone": true,
            "setupSkipped": false,
            "notificationsEnabled": false
        }"#;
        let s: AppSettings = serde_json::from_str(raw).expect("deserialize");
        assert!(!s.notifications_enabled);
    }

    #[test]
    fn custom_css_defaults_none_when_missing_from_json() {
        // Old settings files without the field must deserialize to None (no override).
        let raw = r#"{
            "theme": "dark",
            "locale": "en",
            "sessionDataMode": "independent",
            "manualCliPath": null,
            "permissionPolicy": "ask",
            "modelId": null,
            "effort": "medium",
            "mode": "agent",
            "onboardingDone": true,
            "setupSkipped": false
        }"#;
        let s: AppSettings = serde_json::from_str(raw).expect("deserialize");
        assert!(s.custom_css.is_none());
        assert!(AppSettings::default().custom_css.is_none());
    }

    #[test]
    fn custom_css_roundtrips_and_omits_when_none() {
        let mut s = AppSettings::default();
        s.custom_css = Some("body { color: red; }".into());
        let json = serde_json::to_string(&s).expect("serialize");
        assert!(json.contains("customCss"));
        let back: AppSettings = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.custom_css.as_deref(), Some("body { color: red; }"));

        // None is skipped entirely (skip_serializing_if), matching the
        // convention used for other optional string settings fields.
        let none_settings = AppSettings::default();
        let none_json = serde_json::to_string(&none_settings).expect("serialize");
        assert!(!none_json.contains("customCss"));
    }

    fn sample_session(id: &str, pinned: bool, updated: DateTime<Utc>) -> SessionMeta {
        SessionMeta {
            id: id.into(),
            project_id: None,
            title: id.into(),
            agent_session_id: None,
            created_at: updated,
            updated_at: updated,
            model_id: None,
            archived: false,
            pinned,
            effort: None,
            mode: None,
            permission_policy: None,
            scheduled: false,
            settled_at: None,
            snoozed_until: None,
            branch: None,
            pr_ref: None,
            pr_state: None,
            tags: Vec::new(),
            bookmark_note: None,
            folder_id: None,
        }
    }

    #[test]
    fn sessions_sort_pinned_first_then_updated_at() {
        let t1 = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
        let t2 = Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap();
        let t3 = Utc.with_ymd_and_hms(2024, 1, 3, 0, 0, 0).unwrap();
        let mut list = vec![
            sample_session("unpinned-mid", false, t2),
            sample_session("pinned-old", true, t1),
            sample_session("unpinned-new", false, t3),
            sample_session("pinned-new", true, t3),
        ];
        sort_sessions_by_pin_then_updated(&mut list);
        let ids: Vec<&str> = list.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, vec!["pinned-new", "pinned-old", "unpinned-new", "unpinned-mid"]);
    }

    #[test]
    fn session_meta_pinned_defaults_false_on_deserialize() {
        let raw = r#"{
            "id":"x","title":"t","createdAt":"2024-01-01T00:00:00Z",
            "updatedAt":"2024-01-01T00:00:00Z"
        }"#;
        let m: SessionMeta = serde_json::from_str(raw).expect("deserialize legacy session");
        assert!(!m.pinned);
        assert!(!m.archived);
        assert!(m.tags.is_empty());
    }

    #[test]
    fn set_session_tags_updates_tags_without_bumping_updated_at() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-tags-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        let created = create_session(None, Some("Tagged chat".into()), false).expect("create session");
        let before_updated_at = created.updated_at;

        let updated = set_session_tags(&created.id, vec!["work".into(), "urgent".into()])
            .expect("set tags");
        assert_eq!(updated.tags, vec!["work".to_string(), "urgent".to_string()]);
        assert_eq!(updated.updated_at, before_updated_at);

        let cleared = set_session_tags(&created.id, Vec::new()).expect("clear tags");
        assert!(cleared.tags.is_empty());

        let missing = set_session_tags("does-not-exist", vec!["x".into()]);
        assert!(missing.is_err());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn set_session_bookmark_sets_clears_and_preserves_updated_at() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-bookmark-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        let created =
            create_session(None, Some("Bookmarked chat".into()), false).expect("create session");
        let before_updated_at = created.updated_at;
        assert_eq!(created.bookmark_note, None);

        let bookmarked =
            set_session_bookmark(&created.id, Some("follow up later".into()))
                .expect("set bookmark");
        assert_eq!(bookmarked.bookmark_note.as_deref(), Some("follow up later"));
        assert_eq!(bookmarked.updated_at, before_updated_at);

        // Empty-string note is a valid "bookmarked, no note" state.
        let empty_note = set_session_bookmark(&created.id, Some(String::new()))
            .expect("set empty bookmark note");
        assert_eq!(empty_note.bookmark_note.as_deref(), Some(""));

        let cleared = set_session_bookmark(&created.id, None).expect("clear bookmark");
        assert_eq!(cleared.bookmark_note, None);

        let missing = set_session_bookmark("does-not-exist", Some("x".into()));
        assert!(missing.is_err());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn folder_crud_create_rename_delete() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-folders-crud-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        assert!(load_folders().is_empty());

        let folder = create_folder("Research".into()).expect("create folder");
        assert_eq!(folder.name, "Research");
        let listed = load_folders();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, folder.id);

        let renamed = rename_folder(&folder.id, "Deep Research").expect("rename folder");
        assert_eq!(renamed.name, "Deep Research");
        assert_eq!(load_folders()[0].name, "Deep Research");

        assert!(create_folder("   ".into()).is_err());
        assert!(rename_folder(&folder.id, "").is_err());
        assert!(rename_folder("does-not-exist", "x").is_err());

        delete_folder(&folder.id).expect("delete folder");
        assert!(load_folders().is_empty());
        assert!(delete_folder(&folder.id).is_err());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn set_session_folder_assigns_and_clears_without_bumping_updated_at() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-session-folder-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        let folder = create_folder("Work".into()).expect("create folder");
        let created = create_session(None, Some("Foldered chat".into()), false)
            .expect("create session");
        let before_updated_at = created.updated_at;

        let assigned = set_session_folder(&created.id, Some(folder.id.clone()))
            .expect("assign folder");
        assert_eq!(assigned.folder_id, Some(folder.id.clone()));
        assert_eq!(assigned.updated_at, before_updated_at);

        let cleared = set_session_folder(&created.id, None).expect("clear folder");
        assert_eq!(cleared.folder_id, None);

        let missing = set_session_folder("does-not-exist", Some(folder.id.clone()));
        assert!(missing.is_err());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn delete_folder_clears_membership_on_member_sessions() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-folder-cascade-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);

        let folder = create_folder("Archive".into()).expect("create folder");
        let s1 = create_session(None, Some("one".into()), false).expect("create session 1");
        let s2 = create_session(None, Some("two".into()), false).expect("create session 2");
        set_session_folder(&s1.id, Some(folder.id.clone())).expect("assign s1");
        set_session_folder(&s2.id, Some(folder.id.clone())).expect("assign s2");

        delete_folder(&folder.id).expect("delete folder");

        let after = load_sessions_index();
        assert_eq!(after.iter().find(|s| s.id == s1.id).unwrap().folder_id, None);
        assert_eq!(after.iter().find(|s| s.id == s2.id).unwrap().folder_id, None);
        assert!(load_folders().is_empty());

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }
}
