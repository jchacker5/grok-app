import type { CSSProperties } from "react";
import { resolveImageSrcSync } from "../lib/imageSrc";
import {
  clampWallpaperBlur,
  clampWallpaperOpacity,
  isWallpaperVideo,
} from "../lib/wallpaper";

/**
 * Custom chat background: rendered as the first child of `.main` (behind the
 * chat surface, which has no opaque background of its own — see `.main` in
 * app.css). Purely presentational; all persistence/state lives in App.tsx.
 */
export function WallpaperLayer({
  path,
  opacity,
  blur,
}: {
  path: string | null;
  opacity: number;
  blur: number;
}) {
  if (!path) return null;
  const src = resolveImageSrcSync(path);
  if (!src) return null;
  const style: CSSProperties = {
    opacity: clampWallpaperOpacity(opacity) / 100,
  };
  const blurPx = clampWallpaperBlur(blur);
  if (blurPx > 0) style.filter = `blur(${blurPx}px)`;
  return (
    <div className="wallpaper-layer" aria-hidden="true" style={style}>
      {isWallpaperVideo(path) ? (
        <video
          className="wallpaper-layer__media"
          src={src}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img className="wallpaper-layer__media" src={src} alt="" />
      )}
    </div>
  );
}
