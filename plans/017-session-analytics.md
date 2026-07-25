## Summary
Add a session analytics view showing per-session and aggregate stats: total messages, token usage (by model), response times, session duration, message length trends, and daily/weekly activity charts. Accessible from the sidebar or Account panel.

## Current State

**`src/App.tsx`** — sessions stored in `sessions` state. Each `DraftDoc` has message array with `model`, `timestamp`, `content`. No analytics computed.

**`src-tauri/src/store.rs`** — `session_store` has `get_all_sessions()`. Token counts are stored per message if available (from API response).

**`src/components/AccountPanel.tsx`** — has Quota and Heatmap tabs but no session-level analytics.

## Steps

1. **`src/lib/sessionAnalytics.ts`** (new): Implement analytics computations:
   ```tsx
   export interface SessionStats {
     totalSessions: number;
     totalMessages: number;
     totalTokens: { prompt: number; completion: number; total: number };
     messagesByModel: Record<string, number>;
     tokensByModel: Record<string, { prompt: number; completion: number }>;
     avgResponseTime: number;    // ms
     avgResponseLength: number;  // chars
     sessionDurationAvg: number; // ms
     dailyActivity: { date: string; messages: number; sessions: number }[];
     messageTimeline: { date: string; avgLength: number }[];
   }

   export function computeSessionStats(sessions: DraftDoc[]): SessionStats { … }
   export function computeSingleSessionStats(session: DraftDoc): SingleSessionStats { … }
   ```

2. **`src/components/SessionAnalyticsPanel.tsx`** (new):
   - Two modes: "Overview" (all sessions) and "Per Session" (selected session).
   - Overview tab:
     - Summary cards: total sessions, total messages, total token usage.
     - Model breakdown pie/bar chart (use CSS bar charts — no chart library needed).
     - Daily activity bar chart (simple CSS bars: 7-day rolling).
     - Top 5 longest sessions list.
   - Per Session tab:
     - Session selector dropdown.
     - Message count, token count, duration.
     - Response time trend (simple number + arrow: up/down vs average).
     - Message length trend (first message vs last message length).
   - Use CSS-only charts (div bars) to avoid chart library dependency. If recharts/d3 is already in the project, use that.

3. **`src/components/AccountPanel.tsx`**: Add "Analytics" tab that renders `<SessionAnalyticsPanel>`.

4. **`src/styles/components/SessionAnalytics.css`** (new): Style analytics:
   ```css
   .analytics-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
   .analytics-card { background: var(--c-bg-tertiary); border-radius: 8px; padding: 16px; text-align: center; }
   .analytics-bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; }
   .analytics-bar { flex: 1; background: var(--c-accent); border-radius: 2px 2px 0 0; min-height: 2px; }
   ```

5. **`src/i18n/messages.ts`**: Add `Analytics` section with keys: `title`, `overview`, `per_session`, `total_sessions`, `total_messages`, `total_tokens`, `model_breakdown`, `daily_activity`, `avg_response_time`, `avg_response_length`, `session_duration`, `message_trend`, `no_data`, `select_session`.

## Verification Gates

- [ ] "Analytics" tab visible in Account panel
- [ ] Overview shows summary cards with correct numbers
- [ ] Model breakdown shows bars for each model used
- [ ] Daily activity shows bars for last 7–30 days
- [ ] Per Session view shows stats for selected session
- [ ] Stats update when new messages are sent (refresh button)
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** add external chart library unless one is already in the project. CSS-only bar charts suffice.
- Do **not** compute token counts from message content (character count × heuristic) — use actual token counts from API responses where available, fall back to character count estimate.
- If there are 0 sessions, show "No sessions yet. Start a conversation to see analytics."
- Analytics are computed client-side from loaded sessions — no backend command needed for computation, but may need a `get_all_sessions_for_analytics` command that returns lightweight session summaries (without full message content) for faster loading.

## Dependencies
- None
