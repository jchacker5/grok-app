/** Pure zoom-range helpers for `EmbeddedBrowser` (resource pane preview toolbar). */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1.0;

/** Clamp + round a zoom factor to the supported range/step (avoids float drift). */
export function clampZoom(z: number): number {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  return Math.round(clamped * 100) / 100;
}
