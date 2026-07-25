/**
 * Inline diff review comments (Changes panel).
 * Pure, framework-free model + helpers — in-memory only for v1 (App.tsx keeps
 * state per-session, not disk-persisted; cleared on restart / session switch).
 */

/** Anchor identifying which diff line a comment is attached to. */
export interface DiffCommentAnchor {
  path: string;
  stableId: string;
  contentHash: string;
  side: "old" | "new";
  lineNumber: number;
}

export interface DiffComment {
  id: string;
  path: string;
  stableId: string;
  contentHash: string;
  side: "old" | "new";
  lineNumber: number;
  body: string;
  createdAt: number;
}

function makeCommentId(): string {
  return `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a new comment (no-op when body is blank). Returns a new array. */
export function addComment(
  list: DiffComment[],
  anchor: DiffCommentAnchor,
  body: string,
  opts?: { id?: string; createdAt?: number },
): DiffComment[] {
  const trimmed = body.trim();
  if (!trimmed) return list;
  const comment: DiffComment = {
    id: opts?.id ?? makeCommentId(),
    path: anchor.path,
    stableId: anchor.stableId,
    contentHash: anchor.contentHash,
    side: anchor.side,
    lineNumber: anchor.lineNumber,
    body: trimmed,
    createdAt: opts?.createdAt ?? Date.now(),
  };
  return [...list, comment];
}

/** Remove a comment by id. Returns a new array (same ref when not found). */
export function removeComment(list: DiffComment[], id: string): DiffComment[] {
  if (!list.some((c) => c.id === id)) return list;
  return list.filter((c) => c.id !== id);
}

/** Replace a comment's body in place (used for the inline "edit" affordance). */
export function editCommentBody(
  list: DiffComment[],
  id: string,
  body: string,
): DiffComment[] {
  const trimmed = body.trim();
  if (!trimmed) return list;
  return list.map((c) => (c.id === id ? { ...c, body: trimmed } : c));
}

export function listCommentsForPath(
  list: DiffComment[],
  path: string,
): DiffComment[] {
  return list.filter((c) => c.path === path);
}

export function listCommentsForStableId(
  list: DiffComment[],
  stableId: string,
): DiffComment[] {
  return list.filter((c) => c.stableId === stableId);
}

const REVIEW_PREFIX_HEADER =
  "[INTERNAL — pending inline diff review comments left by the user on the Changes panel. " +
  "Address these directly as part of this turn's work; do not quote this block verbatim or " +
  "mention \"internal\"/\"review comments block\" to the user.]";

/** Silent-prefix block bundled into the next agent turn (see automationSetup.ts precedent). */
export function formatReviewCommentsBlock(comments: DiffComment[]): string {
  if (!comments.length) return "";
  const lines = [REVIEW_PREFIX_HEADER];
  for (const c of comments) {
    lines.push(`- ${c.path}:${c.lineNumber} (${c.side}): ${c.body}`);
  }
  return lines.join("\n");
}

/** Prepend the review-comments block to an outgoing agent prompt (no-op when empty). */
export function prependReviewComments(
  agentText: string,
  comments: DiffComment[],
): string {
  const block = formatReviewCommentsBlock(comments);
  if (!block) return agentText;
  return `${block}\n\n${agentText}`;
}
