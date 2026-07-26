/**
 * Undo-close-session — pure stack logic for the "reopen last closed chat"
 * fast path (⌘⇧T). In-memory only (held in a `useRef` in App.tsx), NOT
 * persisted to disk: archive state is already durably persisted and
 * restorable via Settings → Archived, so losing this stack on app restart is
 * expected and fine. This module only owns the pure push/pop/cap-at-N logic
 * so it is unit-testable without React.
 */

export interface ClosedSessionEntry {
  id: string;
  title: string;
  projectId: string | null;
}

/** Max entries retained — oldest closes fall off the back. */
export const CLOSED_SESSION_STACK_LIMIT = 5;

/**
 * Push a newly-closed (archived) session onto the front of the stack.
 * De-dupes by id (re-closing the same session just moves it to the front)
 * and caps the result at `CLOSED_SESSION_STACK_LIMIT`.
 */
export function pushClosedSession(
  stack: ClosedSessionEntry[],
  entry: ClosedSessionEntry,
): ClosedSessionEntry[] {
  const deduped = stack.filter((e) => e.id !== entry.id);
  return [entry, ...deduped].slice(0, CLOSED_SESSION_STACK_LIMIT);
}

export interface PopClosedSessionResult {
  entry: ClosedSessionEntry | null;
  rest: ClosedSessionEntry[];
}

/** Pop the most-recently-closed entry off the front. No-op (entry: null) when empty. */
export function popClosedSession(
  stack: ClosedSessionEntry[],
): PopClosedSessionResult {
  if (stack.length === 0) return { entry: null, rest: stack };
  const [entry, ...rest] = stack;
  return { entry: entry ?? null, rest };
}
