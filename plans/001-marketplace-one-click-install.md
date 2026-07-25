## Summary
Add one-click plugin install with real-time CLI progress display. The catalog browser exists (`ExtensionsPanel.tsx`); the install via `invoke('install_grok_plugin')` exists (`commands.rs`). What's missing: a progress modal showing CLI output (download, extraction, verification steps), post-install status update, and error recovery.

## Current State

**`src/components/ExtensionsPanel.tsx`** — catalog UI is built (search, source tabs, install-status badges). Install button calls `handleInstallPlugin`:

```tsx
// ExtensionsPanel.tsx ~line 340
const handleInstallPlugin = async (plugin: PluginManifest, repoKey: string) => {
  try {
    await installGrokPlugin(plugin.name, repoKeyWithVersion(repoKey, manifest.version));
    // … sets installing state, then refreshes
  } catch (e) { … }
}
```

**`src-tauri/src/commands.rs`** — `install_grok_plugin` runs a `Command::new("grok")` with `output()` (blocking, no streaming):

```rust
// commands.rs ~line 3400
let output = Command::new("grok")
  .args(["plugins", "install", &name, "--from", &source])
  .output()
  .context("failed to install plugin")?;
```

**`src/components/GlassModal.tsx`** — available for showing progress.

**`src/i18n/messages.ts`** — `Extensions` section exists with keys like `install`, `uninstall`, `repository`.

## Steps

1. **`src-tauri/src/commands.rs`**: Add `install_grok_plugin_with_progress` that spawns `Command::new("grok")` with `stdout(std::process::Stdio::piped())` and `stderr(std::process::Stdio::piped())`, reads lines from both in a Tokio `spawn_blocking` loop, emits `tauri::Window::emit("plugin-install-progress", line)` for each line. Return final `{ success: bool, output: String }`.

2. **`src-tauri/src/lib.rs`**: Register `install_grok_plugin_with_progress` command and remove or deprecate `install_grok_plugin`.

3. **`src/lib/api.ts`**: Add `installGrokPluginWithProgress(name: string, source: string, onProgress: (line: string) => void): Promise<InstallResult>`. Use `listen('plugin-install-progress')` from `@tauri-apps/api/event` to forward lines to the callback.

4. **`src/components/ExtensionsPanel.tsx`**: When install is clicked, open a `GlassModal` with a `<pre class="install-log">` area. Pass `onProgress` to append each line. On success show green checkmark + "Installed". On error show red output + "Retry" button. Reuse `handleInstallPlugin` logic but swap to new API call.

5. **`src/i18n/messages.ts`**: Add keys: `install_progress_title`, `install_success`, `install_failed`, `install_retry`.

6. **`src/styles/components/GlassModal.css`** (or relevant CSS module): Add `.install-log` style — `max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 8px; white-space: pre-wrap;`.

## Verification Gates

- [ ] Click "Install" on any plugin → modal opens with live CLI output streaming in
- [ ] Successful install → modal shows green badge, status badge in catalog updates to "installed"
- [ ] Failed install → modal shows red error output, Retry button re-runs installation
- [ ] `install_grok_plugin` (old, blocking) is removed or deprecated
- [ ] i18n keys exist in all supported locales (fallback to English for missing)

## Hard Boundaries / STOP Conditions

- Do **not** change the plugin scanning/loading logic (`load_plugins`, `PluginState`) — that's stable.
- Do **not** refactor `GlassModal` — use it as-is.
- If CLI output is >500 lines, truncate the middle (keep first 50 + last 50) to avoid UI freeze.
- If `grok` CLI is not found, show a clear error "Grok CLI not found. Install it first." — do not crash the app.
- If the Tauri event channel gets backed up, batch lines (emit at most 60 events/second).

## Dependencies
- None
