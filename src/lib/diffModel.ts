/**
 * Structured diff model shared by both diff sources used in the Changes panel:
 * - session LCS diffs (`buildUnifiedDiff` in `sessionChanges.ts`)
 * - git-sourced unified-diff strings (`gitFileDiff` → `git_file_diff` Rust command)
 *
 * Both already emit standard unified-diff text (`--- a/`, `+++ b/`,
 * `@@ -x,y +a,b @@`), so a single `parseUnifiedDiff()` covers both — no need
 * for two parsers.
 */

/** One rendered row inside a hunk (context / add / remove). */
export interface DiffLine {
  /** Deterministic id across re-renders of the same diff (see buildStableId). */
  stableId: string;
  /** Short non-crypto hash of `content`, used to detect anchor drift later. */
  contentHash: string;
  hunkIndex: number;
  side: "old" | "new" | "both";
  kind: "add" | "remove" | "context";
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface DiffHunk {
  /** Raw `@@ -x,y +a,b @@ ...` header line (kept verbatim, incl. any trailing context text). */
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface ParsedDiff {
  path: string;
  hunks: DiffHunk[];
}

/** `@@ -oldStart[,oldCount] +newStart[,newCount] @@[ trailing context]` */
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/;

/**
 * Deterministic per-line id — stable across re-renders of the same diff text.
 * NOT stable across a diff that has been regenerated after further edits
 * (line numbers / hunk index can shift); that's what `contentHash` is for.
 */
export function buildStableId(
  path: string,
  hunkIndex: number,
  kind: DiffLine["kind"],
  oldLineNumber: number | null,
  newLineNumber: number | null,
): string {
  return `${path}#${hunkIndex}#${kind}#${oldLineNumber ?? ""}:${newLineNumber ?? ""}`;
}

/**
 * Short, fast, non-cryptographic string hash (djb2 variant). Good enough to
 * cheaply detect "this anchored line's text changed" — not a security primitive.
 */
export function hashLineContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Parse a standard unified-diff string into a structured `ParsedDiff`.
 * Tolerant of leading `diff --git` / `index` / `--- a/` / `+++ b/` preamble
 * lines (skipped) and of the special "@@ empty diff @@" marker emitted by
 * `buildUnifiedDiff()` for a no-op diff (yields zero hunks).
 */
export function parseUnifiedDiff(unified: string, path: string): ParsedDiff {
  if (!unified) return { path, hunks: [] };

  const rawLines = unified.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Drop a single trailing empty entry produced by a final newline in the
  // source string — not a real diff line.
  if (rawLines.length && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const hunks: DiffHunk[] = [];
  let i = 0;
  let hunkIndex = 0;

  while (i < rawLines.length) {
    const headerLine = rawLines[i]!;
    const m = HUNK_HEADER_RE.exec(headerLine);
    if (!m) {
      i++;
      continue;
    }
    const oldStart = Number(m[1]);
    const oldCount = m[2] !== undefined ? Number(m[2]) : 1;
    const newStart = Number(m[3]);
    const newCount = m[4] !== undefined ? Number(m[4]) : 1;
    i++;

    const lines: DiffLine[] = [];
    let oldLn = oldStart;
    let newLn = newStart;

    while (i < rawLines.length) {
      const bodyLine = rawLines[i]!;
      if (HUNK_HEADER_RE.test(bodyLine)) break;
      if (bodyLine.startsWith("\\")) {
        // "\ No newline at end of file" — not a content row.
        i++;
        continue;
      }

      let kind: DiffLine["kind"];
      let side: DiffLine["side"];
      let content: string;
      if (bodyLine.startsWith("+")) {
        kind = "add";
        side = "new";
        content = bodyLine.slice(1);
      } else if (bodyLine.startsWith("-")) {
        kind = "remove";
        side = "old";
        content = bodyLine.slice(1);
      } else {
        kind = "context";
        side = "both";
        content = bodyLine.startsWith(" ") ? bodyLine.slice(1) : bodyLine;
      }

      const oldLineNumber = kind === "add" ? null : oldLn;
      const newLineNumber = kind === "remove" ? null : newLn;
      lines.push({
        stableId: buildStableId(path, hunkIndex, kind, oldLineNumber, newLineNumber),
        contentHash: hashLineContent(content),
        hunkIndex,
        side,
        kind,
        oldLineNumber,
        newLineNumber,
        content,
      });
      if (kind !== "add") oldLn++;
      if (kind !== "remove") newLn++;
      i++;
    }

    hunks.push({
      header: headerLine,
      oldStart,
      oldLines: oldCount,
      newStart,
      newLines: newCount,
      lines,
    });
    hunkIndex++;
  }

  return { path, hunks };
}

/** Flatten all lines across all hunks (helper for lookups / drift checks). */
export function allDiffLines(model: ParsedDiff): DiffLine[] {
  return model.hunks.flatMap((h) => h.lines);
}

/** Find a line by its stableId (used to check for content-hash drift). */
export function findLineByStableId(
  model: ParsedDiff,
  stableId: string,
): DiffLine | null {
  for (const hunk of model.hunks) {
    for (const line of hunk.lines) {
      if (line.stableId === stableId) return line;
    }
  }
  return null;
}
