/**
 * Small, dependency-free fuzzy subsequence matcher for the ⌘P file finder.
 *
 * Classic fzf-style scoring: every character of `query` must appear in
 * `candidate`, in order (not necessarily contiguous). Case-insensitive.
 * Among matches, score rewards (highest to lowest weight):
 *   1. Exact full-string match (query === candidate, case-insensitive).
 *   2. Consecutive runs of matched characters ("density").
 *   3. Matches at the start of the string or right after a path/word
 *      separator (`/ _ - . space` or a lower→upper camelCase boundary).
 *   4. Matching earlier in the string over later.
 *   5. Shorter candidates over longer ones (all else equal), so a precise
 *      short match doesn't get buried under long incidental matches.
 *
 * Returns `null` when `query` is not a subsequence of `candidate` at all —
 * callers should exclude `null` results rather than treat them as score 0.
 */

const CONSECUTIVE_BONUS = 15;
const BOUNDARY_BONUS = 10;
const START_BONUS = 20;
const EXACT_MATCH_SCORE = 100000;

function isBoundary(candidate: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = candidate[index - 1];
  const cur = candidate[index];
  if (/[/_\-.\s]/.test(prev)) return true;
  // camelCase boundary: previous is lowercase, current is uppercase (check
  // against the *original*-case candidate, not the lowercased copy).
  if (/[a-z]/.test(prev) && /[A-Z]/.test(cur)) return true;
  return false;
}

/**
 * Score `candidate` against `query`. Returns `null` when `query`'s
 * characters do not all appear, in order, in `candidate` (case-insensitive).
 * Higher scores rank first; an empty `query` matches everything with score 0
 * (so an empty search shows the full, unranked file list).
 */
export function fuzzyScore(query: string, candidate: string): number | null {
  if (query.length === 0) return 0;
  if (candidate.length === 0) return null;

  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  if (q === c) {
    // Shorter exact matches (rare — same length here) still rank by length.
    return EXACT_MATCH_SCORE - candidate.length;
  }

  let qi = 0;
  let score = 0;
  let consecutiveRun = 0;
  let prevMatchIndex = -1;

  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] !== q[qi]) continue;

    const consecutive = prevMatchIndex === ci - 1;
    consecutiveRun = consecutive ? consecutiveRun + 1 : 1;

    score += 1;
    if (consecutive) score += CONSECUTIVE_BONUS * Math.min(consecutiveRun, 5);
    if (isBoundary(candidate, ci)) score += BOUNDARY_BONUS;
    if (ci === 0) score += START_BONUS;
    // Earlier matches score slightly higher than later ones (small, capped
    // falloff so it never swamps consecutive/boundary bonuses).
    score += Math.max(0, 10 - ci * 0.1);

    prevMatchIndex = ci;
    qi += 1;
  }

  if (qi < q.length) return null; // not a subsequence — excluded, not score 0

  // Mild preference for shorter candidates among otherwise-similar matches.
  score -= candidate.length * 0.05;
  return score;
}

export interface FuzzyFileResult {
  path: string;
  score: number;
}

/**
 * Filter + rank a list of file paths against `query`, highest score first.
 * Non-matches are excluded entirely (never included with a null/zero score).
 */
export function fuzzyFilterFiles(
  query: string,
  files: readonly string[],
  limit = 200,
): FuzzyFileResult[] {
  const q = query.trim();
  const scored: FuzzyFileResult[] = [];
  for (const path of files) {
    const score = fuzzyScore(q, path);
    if (score === null) continue;
    scored.push({ path, score });
  }
  scored.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  return scored.slice(0, limit);
}
