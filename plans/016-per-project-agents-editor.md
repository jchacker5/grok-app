## Summary
Add an in-app editor for `AGENTS.md` (or `CLAUDE.md` / `COPILOT_INSTRUCTIONS.md`) — the per-project agent configuration file. Users can open, edit, and save these files without leaving the app. Includes syntax highlighting, a file picker for multi-root workspaces, and validation.

## Current State

**`src/App.tsx`** — no AGENTS.md editor. The file is managed externally (users edit it in their code editor). The app reads it via `readWorkspaceFile` but only for display (e.g., in settings or resource viewer).

**`src-tauri/src/fs_browser.rs`** — has `read_workspace_file(path)` and `write_workspace_file(path, content)` commands.

**`src/components/ResourceViewer.tsx`** — shows file content but read-only.

**`src/i18n/messages.ts`** — no AGENTS.md editor keys.

## Steps

1. **`src-tauri/src/commands.rs`**: Add (or reuse existing):
   - `find_agents_files(project_path: String) -> Vec<String>` — searches for `AGENTS.md`, `CLAUDE.md`, `COPILOT_INSTRUCTIONS.md` in project root + `.claude/` subdirectory.
   - `read_agents_file(path: String) -> String` — read file content.
   - `write_agents_file(path: String, content: String) -> Result` — write file content (creates if not exists).

2. **`src-tauri/src/lib.rs`**: Register commands.

3. **`src/lib/api.ts`**: Add wrappers.

4. **`src/components/AgentsEditor.tsx`** (new):
   - Top bar: dropdown to pick which AGENTS.md variant to edit (if multiple exist in the project).
   - Status indicator: "Current project: <project name>" with path.
   - Editor area: use a `<textarea>` with basic monospace styling, or integrate [CodeMirror 6](https://codemirror.net/) / [Monaco](https://microsoft.github.io/monaco-editor/) for syntax highlighting.
   - **Recommendation**: Use a `<textarea>` initially (minimal, works well). Syntax highlighting can be added later. If the project already has a code editor dependency, use that.
   - "Save" button (⌘S shortcut).
   - "Open in external editor" button.
   - "Create AGENTS.md" button if none exists.
   - "Revert" button to reset to last saved.
   - Template button: inserts a starter AGENTS.md template.

5. **`src/components/ResourceViewer.tsx`**: Add "Agent Config" tab when a project is open. Shows `<AgentsEditor>`.

6. **`src/styles/components/AgentsEditor.css`** (new):
   ```css
   .agents-editor { display: flex; flex-direction: column; height: 100%; }
   .agents-editor__textarea { flex: 1; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 14px;
     line-height: 1.5; padding: 16px; background: var(--c-bg-code); color: var(--c-text); border: none;
     resize: none; outline: none; tab-size: 2; }
   .agents-editor__toolbar { display: flex; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--c-border); }
   ```

7. **`src/components/AgentsEditor.tsx`**: Add autosave (save on ⌘S, save on blur after 2s debounce if changed).

8. **`src/i18n/messages.ts`**: Add `AgentsEditor` section with keys: `title`, `save`, `saving`, `saved`, `revert`, `revert_confirm`, `open_external`, `create_file`, `create_confirm`, `file_picker_label`, `template`, `no_files_found`, `file_created`.

## Verification Gates

- [ ] "Agent Config" tab visible in Resource Viewer
- [ ] Can open existing AGENTS.md and edit it
- [ ] Save button persists content to disk (verify file changed externally)
- [ ] ⌘S keyboard shortcut saves
- [ ] "Create AGENTS.md" creates the file with a starter template
- [ ] "Open in external editor" opens the file in the default system editor
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** add markdown preview — plain text editing only.
- Do **not** auto-save on every keystroke — save on explicit action or ⌘S.
- If file is >100KB, show a warning before opening (it may slow down the editor with a `<textarea>`).
- Do **not** manage multiple agent config files at once — one at a time.
- "Open in external editor" uses `tauri::api::shell::open` (or `opener` crate).

## Dependencies
- None
