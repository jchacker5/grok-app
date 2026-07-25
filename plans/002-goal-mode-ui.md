## Summary
Polish the Goal Mode UI to make goal state (active goal, completion status, sub-goals) visible at a glance. Currently goal mode exists in `App.tsx` as `goalMode` state with `goalConfig`, but the UI is minimal — no floating indicator, no goal progress, no way to see the current goal without opening a panel.

## Current State

**`src/App.tsx`**:
```tsx
// ~line 120
const [goalMode, setGoalMode] = useState(false);
const [goalConfig, setGoalConfig] = useState<GoalConfig | null>(null);
// ~line 950 — rendered as a toggle button + config panel
```

**`src/lib/draftDoc.ts`** — `GoalConfig` interface:
```tsx
export interface GoalConfig {
  goal: string;
  subgoals: string[];
  context: string;
  completedSubgoals: number[];
}
```

**`src/components/BottomBar.tsx`** (or `Composer.tsx`) — goal mode indicator could live here.

**`src/i18n/messages.ts`** — `GoalMode` section does **not** yet exist.

## Steps

1. **`src/components/GoalIndicator.tsx`** (new): Create a compact floating chip (or top bar pill) showing:
   - Goal icon + truncated goal text (ellipsis at 40 chars)
   - Sub-goal progress: `[{completedSubgoals.length}/{subgoals.length}]`
   - Click → opens GoalConfig panel
   - Color: accent blue when active, green when all sub-goals complete
   - Position: fixed bottom-left above composer (or right of breadcrumb)

   Use `<span className="goal-indicator">` with existing CSS variables (`--c-accent`, `--c-bg-tertiary`).

   Props: `goalConfig: GoalConfig | null`, `onOpen: () => void`, `onCancel: () => void`.

2. **`src/App.tsx`**: Import and render `<GoalIndicator>` at the top of the composer area (before `<BottomBar>`). Wire `onOpen` to `setGoalConfigPanelOpen(true)` and `onCancel` to `setGoalMode(false)` + `setGoalConfig(null)`.

3. **`src/styles/components/GoalIndicator.css`** (new): Style the indicator:
   ```css
   .goal-indicator { display: inline-flex; align-items: center; gap: 8px;
     padding: 4px 12px; border-radius: 20px; background: var(--c-bg-tertiary);
     font-size: 13px; cursor: pointer; border: 1px solid var(--c-accent); }
   .goal-indicator--complete { border-color: var(--c-success); }
   .goal-indicator__cancel { opacity: 0.5; font-size: 16px; }
   ```

4. **`src/i18n/messages.ts`**: Add section `GoalMode` with keys:
   - `goal_mode`: "Goal Mode"
   - `subgoal_progress`: "{completed}/{total}"
   - `cancel_goal`: "Cancel Goal"
   - `goal_complete`: "All sub-goals complete"

5. **`src/components/GoalPanel.tsx`** (new, if not exists): Extract the goal config panel from `App.tsx` into a dedicated component. Show full goal text, sub-goal checklist (checkable), context field. Use existing `GlassModal` pattern.

## Verification Gates

- [ ] Enter goal mode → compact indicator shows with goal text and progress
- [ ] Complete sub-goals → progress updates in real time
- [ ] All sub-goals complete → indicator turns green + "Goal Complete" badge
- [ ] Click indicator → GoalPanel opens for editing
- [ ] Cancel → indicator disappears, goal mode exits
- [ ] i18n keys for `GoalMode` exist

## Hard Boundaries / STOP Conditions

- Do **not** change the goal execution logic in `App.tsx` (the loops, the `LoopController` integration) — only the UI.
- Do **not** add animation libraries; use CSS transitions only.
- If `goalConfig` is null, the indicator must not render (return null).
- Keep the indicator under 50px height — it must not crowd the composer.

## Dependencies
- None
