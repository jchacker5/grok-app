/**
 * Grok Spaces — named groupings of projects (Work / Indie / Business / ...).
 * Host stores the space list + each project's `spaceId`; this module also
 * holds the pure helpers used by both the sidebar UI and the keyboard
 * shortcut dispatcher.
 */

export interface Space {
  id: string;
  name: string;
  createdAt: string;
  sortIndex: number;
}

const LS_KEY = "grok-app.spaces";

/** Browser / fallback store when Tauri is unavailable. */
export function loadSpacesLocal(): Space[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Space[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSpacesLocal(list: Space[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

/** Stable sort by `sortIndex` (creation/display/shortcut order). */
export function sortSpaces(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => a.sortIndex - b.sortIndex);
}

/**
 * Resolve a Cmd+Alt+<digit> shortcut index to a target:
 * - 0 → "all" (clear the active space filter)
 * - 1-9 → the nth space (1-indexed, in sortSpaces order), or `null` if there
 *   aren't that many spaces yet.
 */
export function spaceForShortcutIndex(
  spaces: Pick<Space, "id" | "sortIndex">[],
  index: number,
): string | "all" | null {
  if (index === 0) return "all";
  if (index < 1 || index > 9) return null;
  const ordered = sortSpaces(spaces as Space[]);
  const space = ordered[index - 1];
  return space ? space.id : null;
}

const SPACE_COLORS = [
  "#60a5fa", // blue
  "#34d399", // green
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#94a3b8", // slate (wraps here for the 8th+ space)
];

/** Deterministic swatch color for a space by its position — no color picker needed. */
export function colorForSpaceIndex(i: number): string {
  const idx = ((i % SPACE_COLORS.length) + SPACE_COLORS.length) % SPACE_COLORS.length;
  return SPACE_COLORS[idx]!;
}
