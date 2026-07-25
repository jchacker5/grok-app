## Summary
Add a "Stage hunks" UI to the workspace git diff panel. Currently `workspaceGit.ts` shows unstaged diffs; this adds the ability to stage individual hunks or files, commit with a message, and see staged vs unstaged split.

## Current State

**`src/lib/workspaceGit.ts`** — `getGitStatus()` returns `{ files: GitFile[] }` with per-file diffs. The frontend renders them as a unified diff view. No stage/commit UI.

```tsx
// workspaceGit.ts
export interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  hunks: { oldStart: number; newStart: number; content: string }[];
}
```

**`src-tauri/src/commands.rs`** — no git stage/commit commands.

**`src/components/ResourceViewer.tsx`** — shows workspace files with diff rendering.

**`src/i18n/messages.ts`** — "Workspace" section with `diff`, `file_status` keys but no stage/commit.

## Steps

1. **`src-tauri/src/commands.rs`**: Add Tauri commands:
   - `git_stage_file(path: String)` — runs `git add <path>`.
   - `git_unstage_file(path: String)` — runs `git reset HEAD <path>`.
   - `git_stage_hunk(path: String, old_start: u32, new_start: u32)` — runs `git add -p <path>` with patch input; this is complex. **Simpler**: use `git diff <path> | git apply --cached --unidiff-zero` with a constructed patch for just that hunk.
   - `git_commit(message: String)` — runs `git commit -m <message>`. Returns `{ success: bool, output: String }`.
   - `git_get_staged_diff()` — runs `git diff --staged`, returns parsed hunks.
   - All commands take `project_path: String`.

2. **`src-tauri/src/lib.rs`**: Register new commands.

3. **`src/lib/api.ts`**: Add frontend wrappers.

4. **`src/lib/workspaceGit.ts`**: Add types for staged files: `StagedGitFile`. `getGitStatus()` now returns `{ unstaged: GitFile[], staged: StagedGitFile[] }`.

5. **`src/components/WorkspaceDiffView.tsx`** (new or enhance existing): Add "Stage" button per hunk and per file. Split view into two columns: "Unstaged" (left) and "Staged" (right). Each hunk row has a `+ Stage hunk` button. Each file header has `+ Stage file` and `+ Stage all`. Bottom has a commit panel: `textarea` for commit message + `Commit` button.

6. **`src/i18n/messages.ts`**: Add `Workspace` keys: `stage_hunk`, `stage_file`, `stage_all`, `unstage`, `staged_files`, `unstaged_files`, `commit_message`, `commit`, `commit_success`, `commit_failed`, `no_staged`, `no_unstaged`.

## Verification Gates

- [ ] Open workspace panel → unstaged files shown with diff
- [ ] Click "Stage file" → file moves to "Staged" column
- [ ] Click "Stage hunk" on one hunk → only that hunk staged, rest stays unstaged
- [ ] "Unstage" button moves file back
- [ ] Commit with message → `git log -1` shows the commit with that message
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** implement `git add -p` interactive mode (too complex) — hunk staging via constructed patch strings only.
- Do **not** handle merge conflicts — `git commit` must fail if conflicts exist (let Git error bubble up).
- Do **not** add branch management — this is stage + commit only.
- If `git` is not in PATH, show a clear error message and disable the panel.
- If project is not a git repo, show "Not a git repository" message.
- Commit message must be non-empty; validate before calling backend.

## Dependencies
- Plan 012 (Session diff/compare) — this plan's diff view can be reused for session comparison. But 012 does not block 008; they share the diff viewer component.
