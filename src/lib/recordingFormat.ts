/**
 * Pure helpers for the resource-pane recording UI (Live Preview Panel v2,
 * Stage 4) — kept dependency-free (no MediaRecorder/canvas) so they're
 * testable without a browser media stack.
 */

/** Format milliseconds as `m:ss` (e.g. 65_000 -> "1:05"). Clamped at 0. */
export function formatElapsedMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Pick the first candidate MIME type `isSupported` accepts, falling back to
 * the last candidate if none report support (some engines' `isTypeSupported`
 * is overly conservative — better to try than to refuse to record at all).
 */
export function pickSupportedMimeType(
  candidates: string[],
  isSupported: (mime: string) => boolean,
): string {
  for (const c of candidates) {
    if (isSupported(c)) return c;
  }
  return candidates[candidates.length - 1] ?? "video/webm";
}

/** Default MIME-type candidates, most-preferred first (vp9 → vp8 → generic). */
export const RECORDING_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];
