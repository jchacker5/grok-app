## Summary
Add a session diff/compare view that shows side-by-side or unified diff between two sessions. Users select two sessions from the sidebar, then see which messages differ, what changed in message content, and the message timeline diff. Useful for comparing different model responses or before/after edits.

## Current State

**`src/App.tsx`** — sessions listed in sidebar, single-selection. No multi-select or comparison.

**`src/lib/draftDoc.ts`** — `DraftDoc` / `DraftMessage`:
```tsx
export interface DraftMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: number;
}
```

**No diff library** in the project yet. Will need `diff` (npm package) for text diffing.

**`src/i18n/messages.ts`** — no session diff keys.

## Steps

1. **`src/lib/sessionDiff.ts`** (new): Implement diff logic:
   ```tsx
   import { diffArrays } from 'diff';

   export interface SessionDiff {
     messagesAdded: DraftMessage[];
     messagesRemoved: DraftMessage[];
     messagesChanged: { messageId: string; before: string; after: string; hunks: DiffHunk[] }[];
     timelineShift: number; // total time difference in ms
   }

   export interface DiffHunk {
     type: 'added' | 'removed' | 'unchanged';
     value: string;
     lineNumberBefore?: number;
     lineNumberAfter?: number;
   }

   export function computeSessionDiff(a: DraftDoc, b: DraftDoc): SessionDiff {
     // Align messages by ID (or by index if IDs differ)
     // For matching messages, compute text diff using `diffWords` or `diffLines`
     // For unmatched messages, classify as added/removed
   }
   ```

2. **`package.json`**: Add `diff` dependency: `npm install diff` and `@types/diff`.

3. **`src/components/SessionDiffView.tsx`** (new):
   - Step 1: Session selector. When user selects two sessions (hold Ctrl/Cmd to multi-select in sidebar, or pick from two dropdowns), show the comparison.
   - Step 2: Top summary bar: "Session A: N messages vs Session B: M messages | X added, Y removed, Z changed".
   - Step 3: Message timeline diff — a vertical timeline showing messages from both sessions aligned:
     - Green: added messages (only in B)
     - Red: removed messages (only in A)
     - Yellow: changed (same ID, different content)
     - Gray: unchanged (same in both)
   - Step 4: For changed messages, show a detailed text diff (side-by-side or unified toggle).
   - Use the unified diff view from the workspace diff (plan 008) as the text diff renderer — extract it into a shared `<DiffRenderer>` component.
   - Keyboard: `←`/`→` to switch between change blocks.

4. **`src/components/DiffRenderer.tsx`** (shared, new): Extract from workspace diff:
   ```tsx
   interface DiffRendererProps {
     hunks: DiffHunk[];
     mode: 'unified' | 'side-by-side';
   }
   ```
   Both session diff and workspace diff use this.

5. **`src/App.tsx`**: Add multi-select mode to session list. When exactly 2 sessions selected, show "Compare" button in the toolbar (or context menu). Click → opens `<SessionDiffView>` in a `GlassModal` or right panel.

6. **`src/i18n/messages.ts`**: Add `SessionDiff` section with keys: `title`, `select_two_sessions`, `messages_added`, `messages_removed`, `messages_changed`, `unchanged`, `mode_unified`, `mode_side_by_side`, `no_diff`, `session_a`, `session_b`, `changed_message`.

## Verification Gates

- [ ] Select two sessions → "Compare" button appears
- [ ] Summary bar shows correct counts
- [ ] Changed messages show highlighted text diff (added lines green, removed red)
- [ ] Unified/side-by-side toggle works
- [ ] Unchanged messages collapsed by default (expandable)
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** support comparing >2 sessions at once.
- Do **not** auto-save diff results — it's a transient view.
- If sessions have >200 messages each, show a warning before computing diff (it may be slow).
- If message IDs don't match (completely different conversations), fall back to index-aligned diff.
- Do **not** handle real-time updates — diff is computed once when opened.
- The diff library (`diff`) is tiny (~10KB); don't use any larger diff engine.

## Dependencies
- Plan 008 (Workspace diff staging) — extract shared `<DiffRenderer>` component. But 012 can be implemented independently if the DiffRenderer is generic enough.
