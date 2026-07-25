## Summary
Add "Export Session" to Markdown and JSON. A button in the session header exports the current session's full message history as a downloadable file. Foundation for the GitHub integration (plan 018) and multi-model comparison (plan 015).

## Current State

**`src-tauri/src/support_bundle.rs`** — has `generate_support_bundle` which exports session + logs for debugging. Not user-facing.

**`src-tauri/src/commands.rs`** — no session export command.

**`src/components/App.tsx`** — session header has a "..." menu with "Rename", "Delete", "Copy Link" (if applicable). No "Export".

**`src/lib/draftDoc.ts`** — `DraftDoc` interface with messages array. Each message has `role`, `content`, `model`, `timestamp`.

## Steps

1. **`src-tauri/src/commands.rs`**: Add `export_session(session_id: String, format: String) -> String`:
   - Load session from store.
   - If `format == "json"`, serialize the session to pretty-printed JSON via `serde_json::to_string_pretty`.
   - If `format == "markdown"`, build a Markdown string: `# {session.title}\n\n` then for each message: `## {role}\n\n{content}\n\n` with `---` separators. Use `model` and `timestamp` as frontmatter or inline headers.
   - Return the string content (let frontend handle file save dialog).

2. **`src-tauri/src/lib.rs`**: Register `export_session`.

3. **`src/lib/api.ts`**: Add `exportSession(sessionId, format) -> Promise<string>`.

4. **`src/App.tsx`**: Add "Export" option in the session context menu (three-dot menu). When clicked, show a submenu or dialog: "Export as Markdown" / "Export as JSON". On click:
   ```tsx
   const content = await exportSession(sessionId, format);
   const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a'); a.href = url;
   a.download = `${sessionTitle.replace(/\s+/g, '_')}.${format === 'markdown' ? 'md' : 'json'}`;
   a.click();
   URL.revokeObjectURL(url);
   ```
   Or use Tauri's `dialog.save()` for native file picker.

5. **`src/i18n/messages.ts`**: Add `Session.export` keys: `export_session`, `export_markdown`, `export_json`, `export_success`.

## Verification Gates

- [ ] Right-click session / open menu → "Export" option present
- [ ] Export as Markdown → file downloads with `.md` extension, valid Markdown with all messages
- [ ] Export as JSON → file downloads with `.json` extension, valid JSON parseable
- [ ] Exported file includes role, content, model, timestamp for each message
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** include system prompts or internal state in export (only messages).
- Do **not** export the entire `DraftDoc` internal structure — only user-facing content.
- Do **not** add cloud export (save to cloud storage) — file download only.
- If session has >1000 messages, split into multiple files (markdown only) or warn the user.
- Maximum file size: if content exceeds 10MB, warn and offer to truncate.

## Dependencies
- None
