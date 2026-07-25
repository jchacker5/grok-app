/** Pure fake amplitude driver for the voice orb in mock/demo mode (no live mic/API). */

/** Deterministic 0..1 amplitude signal as a function of elapsed time, in ms. */
export function fakeRms(tMs: number): number {
  const t = tMs / 1000;
  const wave =
    0.5 +
    0.28 * Math.sin(t * 2.4) +
    0.14 * Math.sin(t * 5.3 + 1.1) +
    0.08 * Math.sin(t * 11.7 + 2.3);
  return Math.max(0, Math.min(1, wave));
}
