/**
 * Session tags/labels — pure helpers for the sidebar tag-chip filter.
 *
 * Deliberately no separate Rust "known tags" registry: the known-tag list is
 * derived client-side from whatever tags are currently attached to loaded
 * sessions, avoiding a second source of truth that could drift from the
 * per-session `tags` array persisted in `SessionMeta`.
 */

export interface TaggableSession {
  tags?: string[];
}

/** Sorted, de-duplicated list of every tag used across the given sessions. */
export function computeKnownTags(sessions: TaggableSession[]): string[] {
  const set = new Set<string>();
  for (const s of sessions) {
    for (const t of s.tags ?? []) {
      const trimmed = t.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Whether a session passes the active tag filter set.
 * Empty filter set = no filtering (everything matches). Otherwise a session
 * matches when it carries at least one of the active tags (OR / multi-select).
 */
export function matchesTagFilters(
  session: TaggableSession,
  activeTagFilters: Set<string>,
): boolean {
  if (activeTagFilters.size === 0) return true;
  const tags = session.tags ?? [];
  return tags.some((t) => activeTagFilters.has(t));
}

/** Normalize freeform tag input: trim, collapse whitespace, drop empties. */
export function normalizeTagInput(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t ? t : null;
}

/** Toggle a tag in/out of a session's tag list (add if absent, remove if present). */
export function toggleTag(tags: string[], tag: string): string[] {
  const has = tags.includes(tag);
  return has ? tags.filter((t) => t !== tag) : [...tags, tag];
}

/** Add a new freeform tag (deduped, normalized) to a session's tag list. */
export function addTag(tags: string[], rawTag: string): string[] {
  const tag = normalizeTagInput(rawTag);
  if (!tag) return tags;
  if (tags.includes(tag)) return tags;
  return [...tags, tag];
}
