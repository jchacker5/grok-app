/**
 * Custom chat background (wallpaper): pure helpers only. Rendering is a plain
 * React component (`WallpaperLayer`) — no DOM side effects live here.
 */

export const DEFAULT_WALLPAPER_OPACITY = 35;
export const MAX_WALLPAPER_OPACITY = 100;
export const MAX_WALLPAPER_BLUR = 40;

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

/** Clamp a stored/typed opacity value to a sane 0-100 range. */
export function clampWallpaperOpacity(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_WALLPAPER_OPACITY;
  return Math.min(MAX_WALLPAPER_OPACITY, Math.max(0, Math.round(n)));
}

/** Clamp a stored/typed blur radius (px) to a sane 0-40 range. */
export function clampWallpaperBlur(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_WALLPAPER_BLUR, Math.max(0, Math.round(n)));
}

/** Extension-based sniff: video files render via `<video>`, else `<img>`. */
export function isWallpaperVideo(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}
