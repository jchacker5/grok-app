import { describe, expect, it } from "vitest";
import { deriveAccentVars, isValidAccentColor } from "./accentColor";

describe("isValidAccentColor", () => {
  it("accepts strict 6-digit hex, with or without leading #", () => {
    expect(isValidAccentColor("#8aa4ff")).toBe(true);
    expect(isValidAccentColor("8aa4ff")).toBe(true);
    expect(isValidAccentColor("#8AA4FF")).toBe(true);
  });

  it("rejects short hex, non-hex, and garbage", () => {
    expect(isValidAccentColor("#fff")).toBe(false);
    expect(isValidAccentColor("red")).toBe(false);
    expect(isValidAccentColor("")).toBe(false);
    expect(isValidAccentColor("#zzzzzz")).toBe(false);
  });
});

describe("deriveAccentVars", () => {
  it("normalizes accent to lowercase with a leading #", () => {
    const vars = deriveAccentVars("#8AA4FF");
    expect(vars?.accent).toBe("#8aa4ff");
  });

  it("derives a low-alpha muted rgba tint", () => {
    const vars = deriveAccentVars("#8aa4ff");
    expect(vars?.accentMuted).toBe("rgba(138, 164, 255, 0.14)");
  });

  it("derives a lighter hover shade", () => {
    const vars = deriveAccentVars("#8aa4ff");
    expect(vars?.accentHover).toBe("rgb(152, 175, 255)");
  });

  it("returns null for invalid input", () => {
    expect(deriveAccentVars("not-a-color")).toBeNull();
  });
});
