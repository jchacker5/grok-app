import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PROMPTS,
  filterPrompts,
  normalizePromptCategory,
  promptMatchesQuery,
  toLibraryPrompt,
  type CustomPrompt,
} from "./promptLibrary";

describe("promptLibrary built-ins", () => {
  it("ships at least 8 built-in prompts across multiple categories", () => {
    expect(BUILT_IN_PROMPTS.length).toBeGreaterThanOrEqual(8);
    const cats = new Set(BUILT_IN_PROMPTS.map((p) => p.category));
    expect(cats.size).toBeGreaterThan(1);
    expect(BUILT_IN_PROMPTS.every((p) => p.isBuiltIn)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = new Set(BUILT_IN_PROMPTS.map((p) => p.id));
    expect(ids.size).toBe(BUILT_IN_PROMPTS.length);
  });
});

describe("promptMatchesQuery / filterPrompts", () => {
  it("matches by name or description, case-insensitively", () => {
    const p = BUILT_IN_PROMPTS.find((x) => x.id === "code-review")!;
    expect(promptMatchesQuery(p, "CODE")).toBe(true);
    expect(promptMatchesQuery(p, "bugs")).toBe(true);
    expect(promptMatchesQuery(p, "zzz-no-match")).toBe(false);
  });

  it("empty query matches everything", () => {
    const p = BUILT_IN_PROMPTS[0]!;
    expect(promptMatchesQuery(p, "")).toBe(true);
    expect(promptMatchesQuery(p, "   ")).toBe(true);
  });

  it("filters by category and query together", () => {
    const codingOnly = filterPrompts(BUILT_IN_PROMPTS, {
      category: "coding",
      query: "",
    });
    expect(codingOnly.length).toBeGreaterThan(0);
    expect(codingOnly.every((p) => p.category === "coding")).toBe(true);

    const all = filterPrompts(BUILT_IN_PROMPTS, { category: "all", query: "" });
    expect(all.length).toBe(BUILT_IN_PROMPTS.length);

    const none = filterPrompts(BUILT_IN_PROMPTS, {
      category: "coding",
      query: "definitely-not-present",
    });
    expect(none.length).toBe(0);
  });
});

describe("normalizePromptCategory", () => {
  it("recognizes known categories case-insensitively", () => {
    expect(normalizePromptCategory("Coding")).toBe("coding");
    expect(normalizePromptCategory("WRITING")).toBe("writing");
    expect(normalizePromptCategory("analysis")).toBe("analysis");
    expect(normalizePromptCategory("general")).toBe("general");
  });

  it("falls back to custom for unknown categories", () => {
    expect(normalizePromptCategory("something-else")).toBe("custom");
    expect(normalizePromptCategory("")).toBe("custom");
  });
});

describe("toLibraryPrompt", () => {
  it("maps a stored CustomPrompt into a non-built-in LibraryPrompt", () => {
    const custom: CustomPrompt = {
      id: "abc",
      name: "My Prompt",
      description: "desc",
      content: "content",
      category: "coding",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const lib = toLibraryPrompt(custom);
    expect(lib.isBuiltIn).toBe(false);
    expect(lib.category).toBe("coding");
    expect(lib.id).toBe("abc");
  });
});
