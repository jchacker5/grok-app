//! Read the repo-root `CHANGELOG.md` for the in-app "What's new" panel.
//!
//! **Resolution strategy** (most robust first):
//! 1. Tauri's bundled resource dir (`app.path().resource_dir()`), where
//!    `CHANGELOG.md` lands in packaged installs because it's listed under
//!    `bundle.resources` in `tauri.conf.json`. This is the only location that
//!    reliably exists for an *installed* app — the source tree isn't shipped.
//! 2. Dev-mode fallback: walk up from `CARGO_MANIFEST_DIR` (`src-tauri/`) to
//!    the repo root and read `CHANGELOG.md` directly. `cargo tauri dev` /
//!    `pnpm tauri dev` always run from a full checkout, so the file exists at
//!    `<repo>/CHANGELOG.md` even though no bundle has been produced yet.
//!
//! Parsing (extracting just the top `## [X.Y.Z]` section) is intentionally
//! left to the frontend (`src/lib/changelog.ts`) — this command hands back
//! the raw markdown so the same parser can be unit-tested independent of
//! Tauri's IPC layer.

use std::path::{Path, PathBuf};

/// Dev-mode fallback: `<repo-root>/CHANGELOG.md`, derived from this crate's
/// manifest dir (`src-tauri/Cargo.toml`'s parent is the repo root).
fn dev_changelog_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("CHANGELOG.md"))
        .unwrap_or_else(|| PathBuf::from("CHANGELOG.md"))
}

/// Locate `CHANGELOG.md`, preferring a bundled resource dir when given one.
pub fn resolve_changelog_path(resource_dir: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(dir) = resource_dir {
        let candidate = dir.join("CHANGELOG.md");
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    let dev = dev_changelog_path();
    if dev.is_file() {
        return Some(dev);
    }
    None
}

/// Read the changelog's raw markdown text (whole file — the frontend parses
/// out just the top version section for display).
pub fn read_changelog_text(resource_dir: Option<PathBuf>) -> Result<String, String> {
    let path = resolve_changelog_path(resource_dir)
        .ok_or_else(|| "CHANGELOG.md not found (bundled resource or dev checkout)".to_string())?;
    std::fs::read_to_string(&path).map_err(|e| format!("read {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_path_points_at_repo_root_changelog() {
        let p = dev_changelog_path();
        assert!(p.ends_with("CHANGELOG.md"));
    }

    #[test]
    fn resolve_falls_back_to_dev_path_when_resource_dir_missing_file() {
        let missing = std::env::temp_dir().join(format!(
            "grok-app-changelog-test-missing-{}",
            std::process::id()
        ));
        // Directory intentionally does not exist / has no CHANGELOG.md.
        let resolved = resolve_changelog_path(Some(missing));
        // Falls back to the real dev-mode repo CHANGELOG.md, which exists in
        // this checkout (this crate lives inside the repo under test).
        assert!(resolved.is_some(), "expected dev-mode fallback to resolve");
    }

    #[test]
    fn resolve_prefers_resource_dir_when_file_present() {
        let dir = std::env::temp_dir().join(format!(
            "grok-app-changelog-test-present-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("CHANGELOG.md"), "# Changelog\n\n## [9.9.9] - 2099-01-01\n").unwrap();
        let resolved = resolve_changelog_path(Some(dir.clone())).unwrap();
        assert_eq!(resolved, dir.join("CHANGELOG.md"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_changelog_text_reads_real_dev_file() {
        // No resource dir supplied → dev fallback → real repo CHANGELOG.md.
        let text = read_changelog_text(None).expect("read changelog");
        assert!(text.contains("# Changelog"));
        assert!(text.contains("## ["));
    }
}
