import { describe, expect, it } from "vitest";
import {
  clampWallpaperBlur,
  clampWallpaperOpacity,
  isWallpaperVideo,
} from "./wallpaper";

describe("clampWallpaperOpacity", () => {
  it("clamps into 0-100", () => {
    expect(clampWallpaperOpacity(-5)).toBe(0);
    expect(clampWallpaperOpacity(35)).toBe(35);
    expect(clampWallpaperOpacity(150)).toBe(100);
  });

  it("rounds fractional values", () => {
    expect(clampWallpaperOpacity(35.6)).toBe(36);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampWallpaperOpacity(NaN)).toBe(35);
    expect(clampWallpaperOpacity(Infinity)).toBe(35);
  });
});

describe("clampWallpaperBlur", () => {
  it("clamps into 0-40", () => {
    expect(clampWallpaperBlur(-5)).toBe(0);
    expect(clampWallpaperBlur(20)).toBe(20);
    expect(clampWallpaperBlur(999)).toBe(40);
  });

  it("falls back to 0 for non-finite input", () => {
    expect(clampWallpaperBlur(NaN)).toBe(0);
  });
});

describe("isWallpaperVideo", () => {
  it("recognizes common video extensions case-insensitively", () => {
    expect(isWallpaperVideo("/a/b/clip.mp4")).toBe(true);
    expect(isWallpaperVideo("/a/b/clip.WEBM")).toBe(true);
    expect(isWallpaperVideo("/a/b/clip.mov")).toBe(true);
    expect(isWallpaperVideo("/a/b/clip.m4v")).toBe(true);
  });

  it("treats everything else as an image", () => {
    expect(isWallpaperVideo("/a/b/photo.png")).toBe(false);
    expect(isWallpaperVideo("/a/b/photo.jpg")).toBe(false);
    expect(isWallpaperVideo("/a/b/noext")).toBe(false);
  });
});
