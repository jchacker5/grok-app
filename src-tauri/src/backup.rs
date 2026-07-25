//! Manual backup / restore: bundle the local session + settings store into a
//! single portable `.grokbackup` zip so a user can move it between machines
//! via their own cloud-synced folder (iCloud Drive, Dropbox, a USB stick, …).
//!
//! This is a deliberately small slice of plans/020-sync-across-machines.md —
//! no daemon, no background watcher, no CRDT. The user explicitly exports and
//! explicitly imports; nothing runs automatically.
//!
//! Never includes `secrets.json`, OS keychain material, or account auth
//! snapshots — API keys and tokens are excluded on principle even though they
//! never lived in the files this module touches.

use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

use crate::paths;
use crate::store::{self, Automation, Project, SessionMeta, Space};

/// Bump if the on-disk shape of the bundle changes in a way that needs
/// forward/backward-compat handling on import.
const BUNDLE_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    format_version: u32,
    app_version: String,
    generated_at: String,
    session_count: usize,
    project_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackupImportSummary {
    pub sessions_added: usize,
    pub sessions_updated: usize,
    pub sessions_skipped: usize,
    pub projects_added: usize,
    pub projects_updated: usize,
    pub projects_skipped: usize,
    pub spaces_added: usize,
    pub automations_added: usize,
    pub settings_restored: bool,
}

/// Build the backup zip under the system temp dir; caller moves/reveals it.
pub fn write_backup_bundle() -> Result<PathBuf, String> {
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let out = std::env::temp_dir().join(format!("grok-app-backup-{stamp}.grokbackup"));

    let sessions = store::load_sessions_index();
    let projects = store::load_projects();
    let spaces = store::load_spaces();
    let automations = store::load_automations();
    let settings = store::load_settings();

    let manifest = BackupManifest {
        format_version: BUNDLE_FORMAT_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        generated_at: Utc::now().to_rfc3339(),
        session_count: sessions.len(),
        project_count: projects.len(),
    };

    let file = fs::File::create(&out).map_err(|e| format!("create backup: {e}"))?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    write_zip_json(&mut zip, opts, "manifest.json", &manifest)?;
    write_zip_json(&mut zip, opts, "settings.json", &settings)?;
    write_zip_json(&mut zip, opts, "projects.json", &projects)?;
    write_zip_json(&mut zip, opts, "sessions_index.json", &sessions)?;
    write_zip_json(&mut zip, opts, "spaces.json", &spaces)?;
    write_zip_json(&mut zip, opts, "automations.json", &automations)?;

    for s in &sessions {
        let messages = store::load_messages(&s.id);
        write_zip_json(
            &mut zip,
            opts,
            &format!("sessions/{}/messages.json", s.id),
            &messages,
        )?;
    }

    let readme = "Grok App backup\n\
\n\
Contents: settings, projects, sessions (with messages), spaces, and\n\
automations from ~/.grok-app (or your configured GROK_APP_HOME).\n\
\n\
Restore via Settings > Backup > Restore Backup on any machine. Importing\n\
merges sessions/projects/spaces/automations by id (newer wins) and does not\n\
delete anything already on the target machine; settings.json is applied as-is.\n\
\n\
This file never contains API keys, tokens, or account auth snapshots.\n\
";
    zip.start_file("README.txt", opts)
        .map_err(|e| format!("zip readme: {e}"))?;
    zip.write_all(readme.as_bytes())
        .map_err(|e| format!("write readme: {e}"))?;

    zip.finish().map_err(|e| format!("finish zip: {e}"))?;
    Ok(out)
}

fn write_zip_json<W: Write + std::io::Seek, T: Serialize>(
    zip: &mut ZipWriter<W>,
    opts: SimpleFileOptions,
    name: &str,
    value: &T,
) -> Result<(), String> {
    let s = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    zip.start_file(name, opts)
        .map_err(|e| format!("zip {name}: {e}"))?;
    zip.write_all(s.as_bytes())
        .map_err(|e| format!("write {name}: {e}"))?;
    Ok(())
}

fn read_zip_json<T: for<'de> Deserialize<'de> + Default>(
    archive: &mut zip::ZipArchive<fs::File>,
    name: &str,
) -> T {
    let Ok(mut entry) = archive.by_name(name) else {
        return T::default();
    };
    let mut buf = String::new();
    if entry.read_to_string(&mut buf).is_err() {
        return T::default();
    }
    serde_json::from_str(&buf).unwrap_or_default()
}

/// Restore a backup bundle produced by [`write_backup_bundle`].
///
/// Merge policy (no daemon, no CRDT — see module docs): sessions and projects
/// merge by id, newer `updated_at` / `last_opened_at` wins; spaces and
/// automations are additive-only (existing local entries are never touched).
/// `settings.json` is applied as-is since this is an explicit, user-initiated
/// restore rather than a background sync.
pub fn restore_backup_bundle(path: &std::path::Path) -> Result<BackupImportSummary, String> {
    let file = fs::File::open(path).map_err(|e| format!("open backup: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("read backup zip: {e}"))?;

    // Fail fast on an obviously-wrong file rather than silently importing nothing.
    if archive.by_name("manifest.json").is_err() {
        return Err("Not a Grok App backup file (missing manifest.json).".into());
    }

    let incoming_settings: Option<store::AppSettings> = {
        let mut entry = archive
            .by_name("settings.json")
            .map_err(|_| "Backup is missing settings.json".to_string())?;
        let mut buf = String::new();
        entry
            .read_to_string(&mut buf)
            .map_err(|e| format!("read settings.json: {e}"))?;
        serde_json::from_str(&buf).ok()
    };

    let incoming_projects: Vec<Project> = read_zip_json(&mut archive, "projects.json");
    let incoming_sessions: Vec<SessionMeta> = read_zip_json(&mut archive, "sessions_index.json");
    let incoming_spaces: Vec<Space> = read_zip_json(&mut archive, "spaces.json");
    let incoming_automations: Vec<Automation> = read_zip_json(&mut archive, "automations.json");

    // Collect message payloads before mutating any on-disk state, so a
    // corrupt archive entry aborts before we've written anything.
    let mut session_messages: Vec<(String, Vec<store::ChatMessageStored>)> = Vec::new();
    for s in &incoming_sessions {
        let name = format!("sessions/{}/messages.json", s.id);
        let msgs: Vec<store::ChatMessageStored> = read_zip_json(&mut archive, &name);
        session_messages.push((s.id.clone(), msgs));
    }

    let mut summary = BackupImportSummary::default();

    // ── projects: merge by id, newer last_opened_at wins ────────────────────
    let mut projects = store::load_projects();
    for incoming in incoming_projects {
        match projects.iter_mut().find(|p| p.id == incoming.id) {
            Some(existing) => {
                if incoming.last_opened_at > existing.last_opened_at {
                    *existing = incoming;
                    summary.projects_updated += 1;
                } else {
                    summary.projects_skipped += 1;
                }
            }
            None => {
                projects.push(incoming);
                summary.projects_added += 1;
            }
        }
    }
    store::save_projects(&projects)?;

    // ── sessions: merge by id, newer updated_at wins ────────────────────────
    let mut sessions = store::load_sessions_index();
    for incoming in incoming_sessions {
        let id = incoming.id.clone();
        match sessions.iter_mut().find(|s| s.id == id) {
            Some(existing) => {
                if incoming.updated_at > existing.updated_at {
                    *existing = incoming;
                    summary.sessions_updated += 1;
                } else {
                    summary.sessions_skipped += 1;
                    continue;
                }
            }
            None => {
                sessions.push(incoming);
                summary.sessions_added += 1;
            }
        }
        if let Some((_, msgs)) = session_messages.iter().find(|(mid, _)| mid == &id) {
            let dir = paths::app_data_root().join("sessions").join(&id);
            let _ = fs::create_dir_all(&dir);
            store::save_messages(&id, msgs)?;
        }
    }
    store::sort_sessions_by_pin_then_updated(&mut sessions);
    store::save_sessions_index(&sessions)?;

    // ── spaces: additive only (no timestamp to arbitrate on) ────────────────
    let mut spaces = store::load_spaces();
    for incoming in incoming_spaces {
        if !spaces.iter().any(|s| s.id == incoming.id) {
            spaces.push(incoming);
            summary.spaces_added += 1;
        }
    }
    store::save_spaces(&spaces)?;

    // ── automations: additive only ───────────────────────────────────────────
    let mut automations = store::load_automations();
    for incoming in incoming_automations {
        if !automations.iter().any(|a| a.id == incoming.id) {
            automations.push(incoming);
            summary.automations_added += 1;
        }
    }
    store::save_automations(&automations)?;

    // ── settings: explicit restore, applied as-is ────────────────────────────
    if let Some(settings) = incoming_settings {
        store::save_settings(&settings)?;
        summary.settings_restored = true;
    }

    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env_lock::ENV_LOCK;

    /// Point `GROK_APP_HOME` at a fresh temp dir for the duration of `f`.
    fn with_isolated_home<T>(tag: &str, f: impl FnOnce() -> T) -> T {
        let _g = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "grok-app-backup-test-{tag}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("GROK_APP_HOME", &tmp);
        let result = f();
        std::env::remove_var("GROK_APP_HOME");
        let _ = fs::remove_dir_all(&tmp);
        result
    }

    #[test]
    fn export_then_restore_round_trip_is_additive() {
        // Machine A: create a session, export a backup.
        let zip_path = with_isolated_home("machine-a", || {
            let meta = store::create_session(None, Some("From A".into()), false)
                .expect("create session");
            store::append_message(
                &meta.id,
                store::ChatMessageStored {
                    id: "m1".into(),
                    role: "user".into(),
                    content: "hello from A".into(),
                    thought: None,
                    created_at: Utc::now(),
                    is_error: false,
                    attachments: None,
                    marker: None,
                },
            )
            .expect("append message");
            write_backup_bundle().expect("export backup")
        });

        // Machine B: starts with its own unrelated session, then restores A's backup.
        with_isolated_home("machine-b", || {
            let local = store::create_session(None, Some("Local to B".into()), false)
                .expect("create local session");

            let summary = restore_backup_bundle(&zip_path).expect("restore backup");
            assert_eq!(summary.sessions_added, 1);
            assert_eq!(summary.sessions_updated, 0);
            assert!(summary.settings_restored);

            let sessions = store::load_sessions_index();
            assert_eq!(sessions.len(), 2, "local session must survive the import");
            assert!(sessions.iter().any(|s| s.id == local.id));
            let imported = sessions
                .iter()
                .find(|s| s.title == "From A")
                .expect("imported session present");
            let messages = store::load_messages(&imported.id);
            assert_eq!(messages.len(), 1);
            assert_eq!(messages[0].content, "hello from A");
        });

        let _ = fs::remove_file(&zip_path);
    }

    /// Hand-build a minimal `.grokbackup` zip carrying a single session (and no
    /// messages), so tests can exercise `restore_backup_bundle`'s merge logic
    /// against an arbitrary (possibly stale) `SessionMeta` without needing a
    /// second isolated home.
    fn build_backup_zip_with_session(session: &SessionMeta) -> PathBuf {
        let out = std::env::temp_dir().join(format!(
            "grok-app-backup-test-manual-{}-{}.grokbackup",
            session.id,
            std::process::id()
        ));
        let file = fs::File::create(&out).unwrap();
        let mut zip = ZipWriter::new(file);
        let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let manifest = BackupManifest {
            format_version: BUNDLE_FORMAT_VERSION,
            app_version: "test".into(),
            generated_at: Utc::now().to_rfc3339(),
            session_count: 1,
            project_count: 0,
        };
        write_zip_json(&mut zip, opts, "manifest.json", &manifest).unwrap();
        write_zip_json(&mut zip, opts, "settings.json", &store::AppSettings::default()).unwrap();
        write_zip_json(&mut zip, opts, "projects.json", &Vec::<Project>::new()).unwrap();
        write_zip_json(&mut zip, opts, "sessions_index.json", &vec![session.clone()]).unwrap();
        write_zip_json(&mut zip, opts, "spaces.json", &Vec::<Space>::new()).unwrap();
        write_zip_json(&mut zip, opts, "automations.json", &Vec::<Automation>::new()).unwrap();
        write_zip_json(
            &mut zip,
            opts,
            &format!("sessions/{}/messages.json", session.id),
            &Vec::<store::ChatMessageStored>::new(),
        )
        .unwrap();
        zip.finish().unwrap();
        out
    }

    #[test]
    fn restore_skips_stale_session_but_applies_newer_one() {
        with_isolated_home("newer-wins", || {
            let local = store::create_session(None, Some("Title v1".into()), false)
                .expect("create session");

            // An incoming version strictly older than what's on disk: restoring
            // it must be a no-op (skipped), not an overwrite.
            let mut stale = local.clone();
            stale.title = "Stale title".into();
            stale.updated_at = local.updated_at - chrono::Duration::hours(1);
            let stale_zip = build_backup_zip_with_session(&stale);

            let summary = restore_backup_bundle(&stale_zip).expect("restore stale");
            assert_eq!(summary.sessions_skipped, 1);
            assert_eq!(summary.sessions_updated, 0);
            assert_eq!(summary.sessions_added, 0);
            let after_stale = store::load_sessions_index();
            assert_eq!(
                after_stale.iter().find(|s| s.id == local.id).unwrap().title,
                "Title v1",
                "stale incoming session must not overwrite the newer local one"
            );

            // An incoming version strictly newer than what's on disk: restoring
            // it must win and replace the local title.
            let mut newer = local.clone();
            newer.title = "Title v2".into();
            newer.updated_at = local.updated_at + chrono::Duration::hours(1);
            let newer_zip = build_backup_zip_with_session(&newer);

            let summary = restore_backup_bundle(&newer_zip).expect("restore newer");
            assert_eq!(summary.sessions_updated, 1);
            assert_eq!(summary.sessions_skipped, 0);
            let after_newer = store::load_sessions_index();
            assert_eq!(
                after_newer.iter().find(|s| s.id == local.id).unwrap().title,
                "Title v2"
            );

            let _ = fs::remove_file(&stale_zip);
            let _ = fs::remove_file(&newer_zip);
        });
    }
}
