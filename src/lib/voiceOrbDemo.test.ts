import { describe, expect, it } from "vitest";
import { fakeRms } from "./voiceOrbDemo";

describe("fakeRms", () => {
  it("stays within 0..1 across a wide spread of time", () => {
    for (let t = 0; t < 20000; t += 37) {
      const v = fakeRms(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for the same input", () => {
    expect(fakeRms(1234)).toBe(fakeRms(1234));
  });

  it("actually varies over time (not a static value)", () => {
    const samples = new Set<number>();
    for (let t = 0; t < 4000; t += 100) {
      samples.add(Math.round(fakeRms(t) * 1000));
    }
    expect(samples.size).toBeGreaterThan(5);
  });
});
