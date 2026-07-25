import { describe, expect, it } from "vitest";
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom } from "./embeddedBrowserZoom";

describe("clampZoom", () => {
  it("passes through values already in range", () => {
    expect(clampZoom(ZOOM_DEFAULT)).toBe(1.0);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("clamps below the minimum", () => {
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(-5)).toBe(ZOOM_MIN);
  });

  it("clamps above the maximum", () => {
    expect(clampZoom(10)).toBe(ZOOM_MAX);
  });

  it("rounds to avoid float drift when stepping repeatedly", () => {
    let z = ZOOM_DEFAULT;
    for (let i = 0; i < 5; i++) {
      z = clampZoom(z + ZOOM_STEP);
    }
    expect(z).toBe(1.5);
  });
});
