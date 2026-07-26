/**
 * Session folders — pure helpers for the sidebar folder grouping.
 *
 * A folder is a *single-assignment* container: a session belongs to at most
 * one folder (`folderId`), like a directory. This is deliberately distinct
 * from:
 *   - Grok Spaces (`src/lib/spaces.ts`), which group *projects*, not sessions.
 *   - `tags` (`src/lib/sessionTags.ts`), which allow *multiple* labels per
 *     session (multi-select chip filter, OR semantics).
 *
 * A session assigned to a folder renders under that folder's section instead
 * of under its plain project (or "Other sessions") bucket in the sidebar.
 */

export interface FolderableSession {
  folderId?: string | null;
}

export interface SessionFolderLike {
  id: string;
  name: string;
}

/** Whether a session currently belongs to any folder. */
export function isFoldered(session: FolderableSession): boolean {
  return !!session.folderId;
}

/** Sessions assigned to a specific folder id (does not filter archived/tags — callers compose that). */
export function sessionsForFolderId<T extends FolderableSession>(
  sessions: T[],
  folderId: string,
): T[] {
  return sessions.filter((s) => s.folderId === folderId);
}

/** One entry per known folder (in the given order), each holding its member sessions. */
export interface FolderGroup<
  T extends FolderableSession,
  F extends SessionFolderLike,
> {
  folder: F;
  sessions: T[];
}

/**
 * Group a flat session list by folder. Folders with zero matching sessions
 * are still included (empty group) so the sidebar can render a collapsible,
 * empty folder section rather than hiding it.
 */
export function groupSessionsByFolder<
  T extends FolderableSession,
  F extends SessionFolderLike,
>(sessions: T[], folders: F[]): FolderGroup<T, F>[] {
  return folders.map((folder) => ({
    folder,
    sessions: sessionsForFolderId(sessions, folder.id),
  }));
}
