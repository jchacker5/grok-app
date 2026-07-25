## Summary
Add sync across machines: sessions, settings, presets, custom prompts, and custom commands are synced via a cloud backend (or a self-hosted relay). This is the largest feature — requires a sync daemon, conflict resolution, and encryption.

## Current State

**`src-tauri/src/store.rs`** — all data is local. Files stored in `~/.grok-app/`. No remote storage or sync.

**`src/App.tsx`** — loads sessions from local store via `loadSessions()`. No sync concept.

**`src/lib/grokApi.ts`** — has server communication but for API calls, not data sync.

## Architecture Decision

Three approaches, from simplest to most complex:

- **A. Filesystem sync** (iCloud / Dropbox / Syncthing): Just store data in a syncable folder. Lowest effort, works passively. No conflict resolution.
- **B. Git-based sync**: Use the project's git repo (if the app store is inside a repo). Sessions committed as files. Limited.
- **C. Custom cloud relay**: Server component with WebSocket sync, CRDT-based conflict resolution. Full control but high effort.

**Recommendation**: Start with **A** (iCloud/Dropbox) as an MVP, then evaluate if custom cloud sync is needed.

## Steps (Approach A — Filesystem Sync)

1. **`src-tauri/src/store.rs`**: Change storage location from `~/.grok-app/` to a configurable path. Add `SYNC_STORE_PATH` env var or setting. Default: `~/Library/Mobile Documents/com~apple~CloudDocs/grok-app/` (macOS iCloud) or `~/Dropbox/Apps/grok-app/`. On Linux, `~/grok-app-sync/`.

2. **`src/App.tsx`**: Add sync status indicator in the bottom bar:
   - Green dot: files are in a syncable location (detected by checking if parent dir is within a known sync service path).
   - Gray dot: not synced.
   - Click → tooltip "Synced via iCloud" / "Not synced — change location in Settings".

3. **`src/components/SettingsPage.tsx`**: Add "Sync" tab:
   - Sync method: dropdown (iCloud, Dropbox, Custom Folder, None).
   - Current sync location path display.
   - "Change Location" button → folder picker dialog.
   - "Sync Now" button (for non-real-time sync services).
   - Status: "Last synced: <timestamp>" (approximated by checking file modification times).

4. **`src-tauri/src/commands.rs`**: Add:
   - `get_sync_status() -> SyncStatus { method: String, path: String, last_synced: Option<i64>, is_active: bool }`
   - `set_sync_path(path: String)`
   - `migrate_to_sync_path()` — copies all data from current location to the sync path.

5. **Conflict resolution** (for filesystem sync): Use "last-writer-wins" — the most recent `mtime` wins. Files are small enough that this is acceptable. No CRDT needed for v1.

## Steps (Approach C — Custom Cloud Relay, Future)

(Not implemented now — design doc only.)

- Backend: Rust + WebSocket server on a small VPS (or serverless via Cloudflare Workers + Durable Objects).
- Client: Tauri process spawns a background sync thread that watches store files with `notify` crate and sends diffs.
- Conflict resolution: Use `automerge` or `y-crdt` for CRDT-based sync of session data.
- Encryption: End-to-end encrypted with a user-provided passphrase (derived key from PBKDF2). Server never sees plaintext.
- Auth: Use the existing Grok App account token for server authentication.

## Verification Gates (Approach A)

- [ ] Setting sync path to iCloud → files appear in iCloud Drive
- [ ] Sync indicator shows green when in syncable location
- [ ] Open app on another machine with same iCloud account → sessions appear (after file sync)
- [ ] "Migrate to Sync Path" copies all existing data
- [ ] Changing path moves data to new location
- [ ] Last-writer-wins: editing session on machine A, then machine B keeps the later edit

## Hard Boundaries / STOP Conditions

- Do **not** attempt fine-grained conflict resolution in v1 — last-writer-wins only.
- Do **not** sync API keys or tokens — only sessions, settings, prompts, commands.
- Do **not** add a custom cloud server in v1 — filesystem sync only.
- If the sync folder doesn't exist (e.g., iCloud not set up), show a clear message and fall back to local storage.
- Database-level sync (SQLite) requires a migration step; plain JSON files are easier to sync at the file level.
- Warn users: "Do not open the app simultaneously on two machines — last-writer-wins may lose data."

## Dependencies
- All other plans (sessions, settings, prompts, commands must be synced) — but 020 is inherently last in priority, so other features should be stable before adding sync.
