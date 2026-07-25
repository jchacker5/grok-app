## Summary
Add a "Call Logs" tab in the Account panel showing recent Grok API calls with timestamp, model, token count, and cost. Currently the Account panel shows profile, membership, quota, and heatmap — but no per-request history.

## Current State

**`src/components/AccountPanel.tsx`** — tabs: Profile, Membership, Quota, Heatmap. The Quota tab shows current usage bar. No call log view.

**`src-tauri/src/commands.rs`** — `get_account_info` returns `{ profile, membership, quota, heatmap }`. No call log data.

**`src/lib/grokApi.ts`** — API calls store request metadata in memory (`this.lastRequest`), not persisted.

**`src-tauri/src/store.rs`** — `AppStore` has `sessions`, `settings`, `projects` but no call log table.

## Steps

1. **Backend — `src-tauri/src/store.rs`**: Add `call_logs: Vec<CallLogEntry>` field to `AppStore` (or create a separate store file `call_log_store.rs` if size is a concern). `CallLogEntry` struct:
   ```rust
   pub struct CallLogEntry {
     pub id: String,
     pub timestamp: i64,
     pub model: String,
     pub tokens_prompt: u64,
     pub tokens_completion: u64,
     pub cost_usd: f64,
     pub duration_ms: u64,
     pub status: String, // "success" | "error"
   }
   ```
   Add `append_call_log`, `get_call_logs(limit: u64, offset: u64)`, `clear_call_logs` methods. Store in `~/.grok-app/call_logs.json` (separate file to avoid locking main store). Use `serde_json::from_reader`/`to_writer`.

2. **Backend — `src-tauri/src/commands.rs`**: Add Tauri commands:
   - `get_call_logs(limit?: u64, offset?: u64) -> Vec<CallLogEntry>`
   - `clear_call_logs()`
   - `append_call_log(entry: CallLogEntry)` — also wire this into the API response handler so every Grok API call auto-logs.

3. **Backend — `src-tauri/src/lib.rs`**: Register new commands.

4. **Frontend — `src/lib/api.ts`**: Add `getCallLogs`, `clearCallLogs`, `appendCallLog` wrappers.

5. **Frontend — `src/components/AccountPanel.tsx`**: Add "Call Logs" tab. Render a table with columns: Timestamp, Model, Tokens (prompt/completion), Cost, Duration, Status. Paginate with "Load more" button (20 per page). "Clear logs" button with `GlassModal` confirmation. Format timestamps with `Intl.DateTimeFormat`.

6. **Frontend — `src/i18n/messages.ts`**: Add `Account.call_logs` section with keys: `title`, `timestamp`, `model`, `tokens`, `cost`, `duration`, `status`, `clear`, `clear_confirm`, `load_more`, `no_logs`, `success`, `error`.

7. **Frontend — `src/styles/components/AccountPanel.css`**: Add `.call-logs-table` styles — compact rows, monospace for token counts, right-align costs, color-coded status badges.

## Verification Gates

- [ ] Call Logs tab visible in Account panel
- [ ] Table shows paginated log entries with all columns
- [ ] New API calls auto-appear after page refresh (or poll every 10s)
- [ ] Clear logs → confirmation modal → logs cleared
- [ ] Cost column shows $0.0000 format with 4 decimal places
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** log API key or request content — only metadata.
- Do **not** block the API call path — logging must be `fire-and-forget` (don't `await` the write).
- If `call_logs.json` grows beyond 10MB, auto-prune to last 10,000 entries.
- Do **not** add real-time websocket streaming — just periodic refresh (every 10s) or manual reload.
- If the store file is corrupted, truncate and start fresh — log an error, don't crash.

## Dependencies
- None
