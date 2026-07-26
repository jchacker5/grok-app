//! Find-in-files content search across a project's workspace.
//!
//! Distinct from `session_content_search.rs` (greps chat message journals)
//! and the filename fuzzy finder (matches names, not file bodies). This
//! module greps file *contents*, preferring `rg` (ripgrep) when present on
//! PATH — fast, respects `.gitignore` automatically — and falling back to a
//! basic recursive substring walker with a hardcoded exclusion list when it
//! is not (no `ignore`/gitignore-parsing crate is a dependency here).

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

/// Hard cap on results returned to the UI regardless of backend.
pub const DEFAULT_MAX_RESULTS: u32 = 500;

/// Directories skipped by the hand-rolled fallback walker (rg honors
/// `.gitignore` on its own and does not need this list).
const EXCLUDED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    ".turbo",
    "vendor",
    ".cache",
];

/// Skip files larger than this in the fallback walker (avoid huge reads).
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
/// Bytes inspected from the head of a file to decide "looks binary".
const BINARY_SNIFF_BYTES: usize = 8000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchHit {
    pub path: String,
    pub line_number: u32,
    pub line_text: String,
    pub match_start: u32,
    pub match_end: u32,
}

pub fn is_excluded_dir(name: &str) -> bool {
    EXCLUDED_DIRS.contains(&name)
}

/// Small-prefix null-byte sniff — the standard cheap binary-file heuristic.
pub fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(BINARY_SNIFF_BYTES).any(|&b| b == 0)
}

/// Locate the (start, end) char-index span of the first case-sensitive
/// occurrence of `query` in `line`. `None` when absent or query is empty.
pub fn find_match_span(line: &str, query: &str) -> Option<(u32, u32)> {
    if query.is_empty() {
        return None;
    }
    let byte_idx = line.find(query)?;
    // Convert byte offsets to char offsets so the UI can index safely
    // regardless of backend (rg vs fallback both go through this helper).
    let start_chars = line[..byte_idx].chars().count() as u32;
    let end_chars = start_chars + query.chars().count() as u32;
    Some((start_chars, end_chars))
}

/// `rg --line-number --no-heading --fixed-strings` output parser for a
/// single stdout line: `<relative-path>:<line-number>:<content>`. Content
/// may itself contain colons, so we scan for a `:<digits>:` delimiter pair
/// rather than a naive two-way split.
pub fn parse_rg_line(line: &str) -> Option<(String, u32, String)> {
    let first_colon = line.find(':')?;
    let mut idx = first_colon + 1;
    while let Some(rel) = line[idx..].find(':') {
        let seg_end = idx + rel;
        let seg = &line[idx..seg_end];
        if !seg.is_empty() && seg.chars().all(|c| c.is_ascii_digit()) {
            let path = line[..first_colon].to_string();
            let line_no: u32 = seg.parse().ok()?;
            let content = line[seg_end + 1..].to_string();
            return Some((path, line_no, content));
        }
        idx = seg_end + 1;
    }
    None
}

/// Entry point: choose `rg` when available, else the fallback walker.
/// Infallible by design (soft-fail convention) — worst case returns `[]`.
pub fn search_workspace_content(
    project_root: &Path,
    query: &str,
    max_results: u32,
) -> Vec<WorkspaceSearchHit> {
    let cap = max_results.clamp(1, DEFAULT_MAX_RESULTS);
    if query.trim().is_empty() {
        return Vec::new();
    }
    if which::which("rg").is_ok() {
        if let Some(hits) = rg_search(project_root, query, cap) {
            return hits;
        }
        // rg present but the call itself failed unexpectedly — fall back
        // rather than surfacing a hard error to the UI.
    }
    walk_search(project_root, query, cap)
}

fn rg_search(project_root: &Path, query: &str, cap: u32) -> Option<Vec<WorkspaceSearchHit>> {
    let out = Command::new("rg")
        .current_dir(project_root)
        .args([
            "--line-number",
            "--no-heading",
            "--fixed-strings",
            "--max-count",
            &cap.to_string(),
            "--",
            query,
            ".",
        ])
        .output()
        .ok()?;
    // rg exits 1 when there are simply no matches — still a valid, empty result.
    if !out.status.success() && out.status.code() != Some(1) {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut hits = Vec::new();
    for line in text.lines() {
        if hits.len() >= cap as usize {
            break;
        }
        if let Some((path, line_no, content)) = parse_rg_line(line) {
            let clean_path = path.strip_prefix("./").unwrap_or(&path).replace('\\', "/");
            if let Some((start, end)) = find_match_span(&content, query) {
                hits.push(WorkspaceSearchHit {
                    path: clean_path,
                    line_number: line_no,
                    line_text: content,
                    match_start: start,
                    match_end: end,
                });
            }
        }
    }
    Some(hits)
}

/// Recursive substring walker used when `rg` is not on PATH.
pub fn walk_search(project_root: &Path, query: &str, cap: u32) -> Vec<WorkspaceSearchHit> {
    let mut hits = Vec::new();
    let mut stack: Vec<PathBuf> = vec![project_root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if hits.len() >= cap as usize {
            break;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if hits.len() >= cap as usize {
                break;
            }
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if file_type.is_dir() {
                if is_excluded_dir(&name_str) {
                    continue;
                }
                stack.push(path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            search_one_file(&path, project_root, query, cap, &mut hits);
        }
    }
    hits
}

fn search_one_file(
    path: &Path,
    project_root: &Path,
    query: &str,
    cap: u32,
    hits: &mut Vec<WorkspaceSearchHit>,
) {
    let meta = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };
    if meta.len() > MAX_FILE_BYTES {
        return;
    }
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(_) => return,
    };
    if looks_binary(&bytes) {
        return;
    }
    let text = String::from_utf8_lossy(&bytes);
    let rel = path
        .strip_prefix(project_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"));
    for (idx, line) in text.lines().enumerate() {
        if hits.len() >= cap as usize {
            break;
        }
        if let Some((start, end)) = find_match_span(line, query) {
            hits.push(WorkspaceSearchHit {
                path: rel.clone(),
                line_number: (idx + 1) as u32,
                line_text: line.to_string(),
                match_start: start,
                match_end: end,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tempfile_dir() -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("grok-wsearch-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn excluded_dirs_cover_common_toolchains() {
        assert!(is_excluded_dir("node_modules"));
        assert!(is_excluded_dir(".git"));
        assert!(is_excluded_dir("target"));
        assert!(is_excluded_dir("dist"));
        assert!(!is_excluded_dir("src"));
        assert!(!is_excluded_dir("components"));
    }

    #[test]
    fn binary_sniff_detects_null_byte() {
        assert!(looks_binary(&[0x00, 0x01, 0x02]));
        assert!(!looks_binary(b"plain text content"));
    }

    #[test]
    fn match_span_finds_substring_char_offsets() {
        assert_eq!(find_match_span("hello world", "world"), Some((6, 11)));
        assert_eq!(find_match_span("hello world", "missing"), None);
        assert_eq!(find_match_span("héllo world", "world"), Some((6, 11)));
        assert_eq!(find_match_span("anything", ""), None);
    }

    #[test]
    fn parse_rg_line_handles_colon_in_content() {
        let (path, line_no, content) =
            parse_rg_line("src/main.rs:42:let x: usize = foo();").unwrap();
        assert_eq!(path, "src/main.rs");
        assert_eq!(line_no, 42);
        assert_eq!(content, "let x: usize = foo();");
    }

    #[test]
    fn parse_rg_line_rejects_malformed() {
        assert!(parse_rg_line("no colons here").is_none());
    }

    #[test]
    fn walk_search_finds_match_and_skips_excluded_dirs() {
        let dir = tempfile_dir();
        fs::write(dir.join("hit.txt"), "alpha needle beta\nsecond line\n").unwrap();
        let nm = dir.join("node_modules");
        fs::create_dir_all(&nm).unwrap();
        fs::write(nm.join("skip.txt"), "needle should not be found here").unwrap();

        let hits = walk_search(&dir, "needle", 500);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "hit.txt");
        assert_eq!(hits[0].line_number, 1);
        assert_eq!(hits[0].line_text, "alpha needle beta");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn walk_search_skips_binary_files() {
        let dir = tempfile_dir();
        fs::write(dir.join("bin.dat"), [0x00u8, b'n', b'e', b'e', b'd', b'l', b'e']).unwrap();
        fs::write(dir.join("text.txt"), "needle in text").unwrap();

        let hits = walk_search(&dir, "needle", 500);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "text.txt");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn walk_search_respects_cap() {
        let dir = tempfile_dir();
        let mut body = String::new();
        for _ in 0..20 {
            body.push_str("needle line\n");
        }
        fs::write(dir.join("many.txt"), body).unwrap();

        let hits = walk_search(&dir, "needle", 5);
        assert_eq!(hits.len(), 5);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn empty_query_yields_no_hits() {
        let dir = tempfile_dir();
        fs::write(dir.join("a.txt"), "content").unwrap();
        assert!(search_workspace_content(&dir, "", 500).is_empty());
        assert!(search_workspace_content(&dir, "   ", 500).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
