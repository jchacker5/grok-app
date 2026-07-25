## Summary
Upgrade session content search with: result snippets (showing matched line in context), per-session result grouping, keyboard navigation (↑↓ to select results), and instant-open on Enter. The current search (`App.tsx` `handleSearch`) merges session titles + content hits but shows only a flat list of session names.

## Current State

**`src/App.tsx`** — search state and UI (~line 850):
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
// Search triggered in handleSearch — calls sessionSearch.search
// Results rendered as flat <div class="search-result">{session.title}</div>
```

**`src/lib/sessionSearch.ts`** — `search(query)` returns `SearchResult[]` with `{ sessionId, title, matches: Match[] }`. Each `Match` has `{ lineNumber, lineContent, score }`. The `lineContent` is available but not used in UI.

**`src-tauri/src/session_content_search.rs`** — Rust full-text search returns match positions and line content.

**`src/components/SearchPanel.tsx`** (maybe inline in App.tsx) — search input + results list.

## Steps

1. **`src/components/SearchPanel.tsx`** (extract from App.tsx if inline, or enhance existing):
   - Group results by session: `<div class="search-result-group">` with session title as header.
   - For each match inside a session, render a snippet row:
     ```
     "…{before}**<matched>**{after}…" — line 42
     ```
     Use `lineContent` with the matched portion highlighted via `<mark>`.
   - Keyboard navigation: track `selectedIndex` state; on `ArrowDown`/`ArrowUp` move it; `Enter` opens that session + jumps to the matching message (scroll message into view).
   - Limit to top 5 results per session + "Show all N results in this session" expand link.
   - Input debounce: 300ms.

2. **`src/App.tsx`**: Replace inline search rendering with `<SearchPanel>`. Pass `searchResults`, `searchQuery`, `onSelectResult`, `onQueryChange`. Remove the flat `.search-result` list.

3. **`src/styles/components/SearchPanel.css`** (new): Style the grouped results:
   ```css
   .search-result-group { border-bottom: 1px solid var(--c-border); padding: 8px 0; }
   .search-result-group__title { font-weight: 600; font-size: 14px; }
   .search-result-match { padding: 4px 8px; cursor: pointer; border-radius: 4px; font-size: 13px; }
   .search-result-match:hover, .search-result-match--selected { background: var(--c-bg-tertiary); }
   .search-result-match__snippet { color: var(--c-text-secondary); }
   .search-result-match__snippet mark { background: var(--c-accent-alpha); }
   .search-result-match__line { color: var(--c-text-tertiary); font-size: 11px; }
   ```

4. **`src/i18n/messages.ts`**: Add search section keys if not present: `search_no_results`, `show_all_results`, `n_results_in_session`.

5. **`src/lib/sessionSearch.ts`** (if needed): Expose a `getMessageIndexByLine(sessionId, lineNumber)` helper to convert a file line number to a message index for scroll-to.

## Verification Gates

- [ ] Search "foo" → results grouped by session, each showing snippet with highlighted match
- [ ] ↑↓ navigates results visually (blue highlight follows)
- [ ] Enter on selected result → session opens and scrolls to matched message
- [ ] More than 5 matches per session → "Show all N results" link
- [ ] Input debounce prevents search on every keystroke (check with 50ms typing)
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** change the Rust search engine (`session_content_search.rs`) — only use its existing output.
- Do **not** add pagination (scroll-based infinite) — just "truncate to 5" + expand.
- If search query is empty or <2 chars, show nothing (don't search).
- Keep SearchPanel lightweight — no heavy dependencies.

## Dependencies
- None
