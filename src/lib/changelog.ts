/**
 * Parse the "What's new" entry out of the raw `CHANGELOG.md` markdown
 * (Keep a Changelog format: `## [X.Y.Z] - date` section headers).
 *
 * The Rust `read_changelog` command hands back the *whole file* — parsing
 * lives here so it's unit-testable without Tauri IPC, and so the same logic
 * can filter out the `## [Unreleased]` placeholder section (which has no
 * concrete version and should never be shown as "what's new" or compared
 * against `lastSeenVersion`).
 *
 * The top released section is treated as authoritative for "the app's
 * current version" — this repo's own maintainer rule (see CHANGELOG.md's
 * header comment) requires completing `## [X.Y.Z]` before every version tag,
 * so the top non-Unreleased section always matches the running build.
 */

export interface ChangelogEntry {
  /** e.g. "0.1.13" (no leading `v`). */
  version: string;
  /** e.g. "2026-07-26", or null if the header omitted a date. */
  date: string | null;
  /** Section body markdown (between this header and the next `## `), trimmed. */
  body: string;
}

const SECTION_HEADER_RE = /^##\s*\[([^\]]+)\]\s*(?:-\s*(.+))?\s*$/;

/**
 * Extract the top-most concrete-version `## [X.Y.Z]` section from raw
 * CHANGELOG.md text. Skips `## [Unreleased]` (case-insensitive). Returns
 * `null` when the file has no such section (empty/malformed changelog).
 */
export function parseLatestChangelogEntry(raw: string): ChangelogEntry | null {
  if (!raw) return null;
  const lines = raw.split(/\r?\n/);
  const headers: Array<{ index: number; version: string; date: string | null }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = SECTION_HEADER_RE.exec(lines[i].trim());
    if (!m) continue;
    headers.push({ index: i, version: m[1].trim(), date: m[2]?.trim() || null });
  }

  for (let h = 0; h < headers.length; h++) {
    const { index, version, date } = headers[h];
    if (version.toLowerCase() === "unreleased") continue;
    const bodyStart = index + 1;
    const bodyEnd = h + 1 < headers.length ? headers[h + 1].index : lines.length;
    const body = lines.slice(bodyStart, bodyEnd).join("\n").trim();
    return { version, date, body };
  }
  return null;
}
