//! Read-only viewer support for Grok Build's on-disk memory store
//! (`{GROK_HOME}/memory/`): a global `MEMORY.md`, one `{slug}/MEMORY.md` per
//! project (slug = `{basename}-{hash}`, minted by the CLI — we only match on
//! basename, we don't reimplement the hash), and per-project `sessions/*.md`
//! interval notes. There is also a semantic `index.sqlite` per project, which
//! is Grok Build's internal state — this module never reads or writes it.
//!
//! "Clear" only resets the human-readable `MEMORY.md` text; it never touches
//! `index.sqlite` or `sessions/*.md`.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::paths::resolve_agent_grok_home;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDoc {
    pub path: String,
    pub content: String,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySessionFile {
    pub name: String,
    pub modified_at: i64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentMemorySnapshot {
    /// Resolved GROK_HOME (independent agent-home, or `~/.grok` in shared mode).
    pub home: String,
    /// Whether `{home}/memory/` exists at all.
    pub available: bool,
    pub global: Option<MemoryDoc>,
    pub project: Option<MemoryDoc>,
    /// Directory name actually matched under `memory/` (e.g. `grok-app-56f7cce4`).
    pub project_slug: Option<String>,
    /// Interval notes under the matched project's `sessions/` dir, newest first.
    pub sessions: Vec<MemorySessionFile>,
    /// Other project memory dirs found (not matched to the current cwd) — surfaced
    /// so the UI can explain "found memory for other projects" instead of silence.
    pub other_projects: Vec<String>,
}

fn mtime_secs(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn read_doc(path: &Path) -> Option<MemoryDoc> {
    let content = fs::read_to_string(path).ok()?;
    Some(MemoryDoc {
        path: path.display().to_string(),
        content,
        modified_at: mtime_secs(path),
    })
}

/// Best-match project memory dir for `cwd`'s basename under `memory_root`.
/// Grok Build names these `{basename}-{hash8}`; ties broken by most-recently
/// modified `MEMORY.md`.
fn find_project_memory_dir(memory_root: &Path, cwd: &str) -> Option<(PathBuf, String)> {
    let base = Path::new(cwd.trim_end_matches(['/', '\\']))
        .file_name()?
        .to_str()?
        .to_string();
    if base.is_empty() {
        return None;
    }
    let entries = fs::read_dir(memory_root).ok()?;
    let mut best: Option<(PathBuf, String, i64)> = None;
    for ent in entries.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        let name = ent.file_name().to_string_lossy().to_string();
        if name != base && !name.starts_with(&format!("{base}-")) {
            continue;
        }
        let mtime = mtime_secs(&path.join("MEMORY.md"));
        if best.as_ref().map(|(_, _, t)| mtime > *t).unwrap_or(true) {
            best = Some((path, name, mtime));
        }
    }
    best.map(|(p, n, _)| (p, n))
}

fn list_session_files(project_dir: &Path) -> Vec<MemorySessionFile> {
    let sessions_dir = project_dir.join("sessions");
    let Ok(rd) = fs::read_dir(&sessions_dir) else {
        return Vec::new();
    };
    let mut files: Vec<MemorySessionFile> = rd
        .flatten()
        .filter_map(|ent| {
            let path = ent.path();
            if !path.is_file() {
                return None;
            }
            let name = ent.file_name().to_string_lossy().to_string();
            if !name.to_ascii_lowercase().ends_with(".md") {
                return None;
            }
            let size = fs::metadata(&path).ok()?.len();
            Some(MemorySessionFile {
                name,
                modified_at: mtime_secs(&path),
                size,
            })
        })
        .collect();
    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    files
}

pub fn read_snapshot(session_data_mode: &str, cwd: Option<&str>) -> AgentMemorySnapshot {
    let home = resolve_agent_grok_home(session_data_mode);
    let memory_root = home.join("memory");

    let mut snapshot = AgentMemorySnapshot {
        home: home.display().to_string(),
        ..Default::default()
    };

    if !memory_root.is_dir() {
        return snapshot;
    }
    snapshot.available = true;
    snapshot.global = read_doc(&memory_root.join("MEMORY.md"));

    let mut all_dirs: Vec<String> = Vec::new();
    if let Ok(rd) = fs::read_dir(&memory_root) {
        for ent in rd.flatten() {
            if ent.path().is_dir() {
                all_dirs.push(ent.file_name().to_string_lossy().to_string());
            }
        }
    }
    all_dirs.sort();

    if let Some(cwd) = cwd.filter(|s| !s.is_empty()) {
        if let Some((dir, slug)) = find_project_memory_dir(&memory_root, cwd) {
            snapshot.project = read_doc(&dir.join("MEMORY.md"));
            snapshot.sessions = list_session_files(&dir);
            all_dirs.retain(|d| d != &slug);
            snapshot.project_slug = Some(slug);
        }
    }

    snapshot.other_projects = all_dirs;
    snapshot
}

/// Read one interval note by bare filename (must be a direct, non-traversing
/// child of the matched project's `sessions/` dir).
pub fn read_session_file(
    session_data_mode: &str,
    cwd: &str,
    name: &str,
) -> Result<String, String> {
    if name.is_empty() || name.contains(['/', '\\']) || name.contains("..") {
        return Err("invalid session file name".into());
    }
    let home = resolve_agent_grok_home(session_data_mode);
    let memory_root = home.join("memory");
    let (dir, _) =
        find_project_memory_dir(&memory_root, cwd).ok_or_else(|| "no project memory".to_string())?;
    let path = dir.join("sessions").join(name);
    // Re-confirm the resolved path stays inside sessions/ (defense in depth).
    let sessions_dir = dir.join("sessions");
    match (path.canonicalize(), sessions_dir.canonicalize()) {
        (Ok(p), Ok(s)) if p.starts_with(&s) => {}
        _ => return Err("session file not found".into()),
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Reset only the human-readable `MEMORY.md` text for the requested scope
/// (`"global"` | `"project"` | `"all"`). Never touches `index.sqlite` or
/// `sessions/*.md` — those are Grok Build's internal state.
pub fn clear_scope(
    session_data_mode: &str,
    cwd: Option<&str>,
    scope: &str,
) -> Result<AgentMemorySnapshot, String> {
    let home = resolve_agent_grok_home(session_data_mode);
    let memory_root = home.join("memory");

    const RESET_GLOBAL: &str = "# Global Memory\n\n> This file is automatically managed by Grok's memory system.\n> You can also edit it manually — changes will be indexed on next session.\n\n## Preferences\n\n<!-- Add any cross-project preferences here -->\n";
    const RESET_PROJECT: &str =
        "# Project Memory\n\n<!-- Cleared from Grok App's Agent Memory viewer. -->\n";

    if scope == "global" || scope == "all" {
        let p = memory_root.join("MEMORY.md");
        if p.is_file() {
            fs::write(&p, RESET_GLOBAL).map_err(|e| e.to_string())?;
        }
    }
    if scope == "project" || scope == "all" {
        if let Some(cwd) = cwd.filter(|s| !s.is_empty()) {
            if let Some((dir, _)) = find_project_memory_dir(&memory_root, cwd) {
                let p = dir.join("MEMORY.md");
                if p.is_file() {
                    fs::write(&p, RESET_PROJECT).map_err(|e| e.to_string())?;
                }
            }
        } else if scope == "project" {
            return Err("no active project".into());
        }
    }

    Ok(read_snapshot(session_data_mode, cwd))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env_lock::ENV_LOCK;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_tmp_dir(label: &str) -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        std::env::temp_dir().join(format!(
            "grok-mem-{label}-{}-{}-{n}",
            std::process::id(),
            line!(),
        ))
    }

    fn touch(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn missing_memory_dir_is_unavailable_not_error() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = unique_tmp_dir("missing");
        let _ = fs::remove_dir_all(&tmp);
        std::env::set_var("GROK_APP_HOME", &tmp);

        let snap = read_snapshot("independent", None);
        assert!(!snap.available);
        assert!(snap.global.is_none());
        assert!(snap.home.contains("agent-home"));

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn finds_project_by_basename_prefix() {
        let root = unique_tmp_dir("proj");
        let proj_dir = root.join("memory").join("myapp-abc12345");
        touch(&proj_dir.join("MEMORY.md"), "# Project Memory\n- **thing**: value\n");
        touch(&proj_dir.join("sessions").join("2026-01-01-a.md"), "note");

        let memory_root = root.join("memory");
        let found = find_project_memory_dir(&memory_root, "/Users/x/Documents/myapp");
        assert!(found.is_some());
        let (dir, slug) = found.unwrap();
        assert_eq!(slug, "myapp-abc12345");
        assert_eq!(dir, proj_dir);

        let sessions = list_session_files(&proj_dir);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].name, "2026-01-01-a.md");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn clear_scope_resets_memory_md_but_not_sessions() {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = unique_tmp_dir("clear");
        let _ = fs::remove_dir_all(&tmp);
        std::env::set_var("GROK_APP_HOME", &tmp);

        let mem_root = tmp.join("agent-home").join("memory");
        touch(&mem_root.join("MEMORY.md"), "stale global content");
        let cwd = "/Users/x/Documents/app-deadbeef";
        let proj_dir = mem_root.join("app-deadbeef-1234abcd");
        touch(&proj_dir.join("MEMORY.md"), "stale project content");
        touch(&proj_dir.join("sessions").join("s.md"), "keep me");

        let snap = clear_scope("independent", Some(cwd), "all").expect("clear ok");
        assert!(!snap
            .global
            .as_ref()
            .unwrap()
            .content
            .contains("stale global"));
        assert!(!snap
            .project
            .as_ref()
            .unwrap()
            .content
            .contains("stale project"));
        // Session interval note is Grok Build's internal state — never touched.
        assert_eq!(
            fs::read_to_string(proj_dir.join("sessions").join("s.md")).unwrap(),
            "keep me"
        );

        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn read_session_file_rejects_traversal() {
        let err = read_session_file("independent", "/tmp/nonexistent-cwd", "../../etc/passwd");
        assert!(err.is_err());
        let err2 = read_session_file("independent", "/tmp/nonexistent-cwd", "sub/dir.md");
        assert!(err2.is_err());
    }
}
