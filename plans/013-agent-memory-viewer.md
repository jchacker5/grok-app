## Summary
Add a read-only viewer for the agent's memory/knowledge store. When the agent is running in a project with a `~/.grok-app/agent-home/` (containing a memory file or vector store), display the stored memories: key-value facts, chunk summaries, and timestamps. This helps users understand what the agent remembers about them.

## Current State

**`src-tauri/src/commands.rs`** — `get_agent_home()` returns the `GROK_HOME` path used by the current agent process. No memory-reading command.

**Agent memory format**: The agent stores memories in `~/.grok-app/agent-home/memory.json` (or similar, format TBD — likely a JSON array of `{ key, value, timestamp, source }` objects). If semantic memory exists, it's in a vector store file or SQLite DB.

**`src-tauri/src/fs_browser.rs`** — has file-reading commands that can be reused.

**`src/components/ResourceViewer.tsx`** — shows resources (files, browser state). Could host the memory viewer as a new tab.

## Steps

1. **Investigation**: First, determine the actual memory format by reading:
   - `~/.grok-app/agent-home/memory.json` (if exists)
   - Or `~/.grok-app/agent-home/*.sqlite` for vector store
   - Or check `agent-home/config.toml` for memory configuration

   (The executor should implement this as: read the known file paths, parse whatever format is found.)

2. **`src-tauri/src/commands.rs`**: Add `read_agent_memories() -> Vec<MemoryEntry>`:
   ```rust
   pub struct MemoryEntry {
     pub key: String,
     pub value: String,
     pub timestamp: i64,
     pub source: String,    // "user_input" | "derived" | "file"
     pub category: String,  // "fact" | "preference" | "context"
     pub confidence: f64,   // 0.0–1.0
   }
   ```
   Implement by reading the memory file. If JSON: parse directly. If SQLite: query with `rusqlite` (add to `Cargo.toml` if needed). If neither exists, return empty vec.

3. **`src-tauri/src/lib.rs`**: Register command.

4. **`src/lib/api.ts`**: Add `readAgentMemories() -> Promise<MemoryEntry[]>`.

5. **`src/components/AgentMemoryViewer.tsx`** (new):
   - Search bar to filter memories by key/value.
   - Category tabs: All, Facts, Preferences, Context.
   - Sort by: recency, confidence, alphabetical.
   - Each memory rendered as a card:
     ```
     ┌─────────────────────────────────┐
     │ key                               │
     │ value                             │
     │ timestamp | source | confidence ★★★│
     └─────────────────────────────────┘
     ```
   - Empty state: "No memories stored yet. The agent builds memory as you interact."
   - "Refresh" button.
   - "Clear All" button with `GlassModal` confirmation (only clears readable store, not agent-internal state).

6. **`src/components/ResourceViewer.tsx`**: Add "Agent Memory" tab when agent home is available. Renders `<AgentMemoryViewer>`.

7. **`src/i18n/messages.ts`**: Add `AgentMemory` section with keys: `title`, `search`, `category_facts`, `category_preferences`, `category_context`, `no_memories`, `clear_all`, `clear_confirm`, `cleared`, `refresh`, `source_user`, `source_derived`, `source_file`.

## Verification Gates

- [ ] Tab visible when agent home has memory file
- [ ] Memories displayed as cards with key/value/timestamp
- [ ] Search filters in real time
- [ ] Category tabs filter correctly
- [ ] Clear All → confirmation → memories cleared
- [ ] Tab hidden (or shows "No agent memory") when no memory file
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- **Read-only by default** — only "Clear All" writes. Do not add individual memory edit/delete (to avoid corrupting agent state).
- If memory file format is unknown/unparseable, show "Unable to read memory format" + the raw file content.
- Do **not** read files outside the agent home directory.
- If the agent is not running, show "Agent not active" — do not start the agent just for viewing memory.
- Confidence stars: 0.0–0.2 = 1 star, 0.2–0.4 = 2, 0.4–0.6 = 3, 0.6–0.8 = 4, 0.8–1.0 = 5.

## Dependencies
- None
