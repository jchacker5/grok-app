import { describe, expect, it } from "vitest";
import { fuzzyFilterFiles, fuzzyScore } from "./fuzzyFile";

describe("fuzzyScore", () => {
  it("ranks an exact match highest", () => {
    const exact = fuzzyScore("app.tsx", "app.tsx");
    // Same characters "a p p . t s x", in order, but scattered — a genuine
    // (looser) subsequence match that should score far below the exact one.
    const loose = fuzzyScore("app.tsx", "aXXpXXpXX.XXtXXsXXxXXtrailing");
    expect(exact).not.toBeNull();
    expect(loose).not.toBeNull();
    expect(exact as number).toBeGreaterThan(loose as number);
  });

  it("matches a subsequence even when not contiguous", () => {
    // "abc" is a subsequence of "aXbXc"
    expect(fuzzyScore("abc", "aXbXc")).not.toBeNull();
    // Real-world style: "apptsx" subsequence-matches "src/App.tsx"
    expect(fuzzyScore("apptsx", "src/App.tsx")).not.toBeNull();
  });

  it("returns null when query is not a subsequence", () => {
    expect(fuzzyScore("xyz", "abc")).toBeNull();
    // "cba" reversed order — not a subsequence of "abc"
    expect(fuzzyScore("cba", "abc")).toBeNull();
    expect(fuzzyScore("app.rs", "app.tsx")).toBeNull();
  });

  it("excludes empty candidates but matches everything for an empty query", () => {
    expect(fuzzyScore("x", "")).toBeNull();
    expect(fuzzyScore("", "anything.ts")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("ABC", "abcdef")).not.toBeNull();
    expect(fuzzyScore("abc", "ABCDEF")).not.toBeNull();
    const upper = fuzzyScore("APP", "App.tsx");
    const lower = fuzzyScore("app", "App.tsx");
    expect(upper).toBe(lower);
  });

  it("scores consecutive runs and start-of-string matches higher", () => {
    // Query "app" appears contiguous+at-start in "app.tsx" vs scattered in "a-p-p.tsx"
    const tight = fuzzyScore("app", "app.tsx");
    const scattered = fuzzyScore("app", "z-a-p-p.tsx");
    expect(tight).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(tight as number).toBeGreaterThan(scattered as number);
  });

  it("rewards path-segment boundary matches", () => {
    // "voice" matches right after a `/` boundary in one candidate, and
    // mid-word in another of otherwise similar shape.
    const boundary = fuzzyScore("voice", "src/voice/host.ts");
    const midword = fuzzyScore("voice", "src/somevoicehost.ts");
    expect(boundary).not.toBeNull();
    expect(midword).not.toBeNull();
    expect(boundary as number).toBeGreaterThan(midword as number);
  });
});

describe("fuzzyFilterFiles", () => {
  const files = [
    "src/App.tsx",
    "src/components/VoiceOrb.tsx",
    "src/lib/api.ts",
    "src-tauri/src/voice_host.rs",
    "README.md",
  ];

  it("excludes files that don't match at all", () => {
    const results = fuzzyFilterFiles("zzzzz", files);
    expect(results).toEqual([]);
  });

  it("ranks results by descending score", () => {
    const results = fuzzyFilterFiles("voice", files);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
    expect(results.some((r) => r.path === "src/components/VoiceOrb.tsx")).toBe(true);
  });

  it("returns every file, unranked-but-included, for an empty query", () => {
    const results = fuzzyFilterFiles("", files);
    expect(results.length).toBe(files.length);
  });

  it("respects the limit parameter", () => {
    const many = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const results = fuzzyFilterFiles("file", many, 5);
    expect(results.length).toBe(5);
  });
});
