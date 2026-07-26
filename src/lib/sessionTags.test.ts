import { describe, expect, it } from "vitest";
import {
  addTag,
  computeKnownTags,
  matchesTagFilters,
  normalizeTagInput,
  toggleTag,
} from "./sessionTags";

describe("computeKnownTags", () => {
  it("returns a sorted, de-duplicated list across sessions", () => {
    const sessions = [
      { tags: ["work", "urgent"] },
      { tags: ["personal"] },
      { tags: ["urgent", "work"] },
      { tags: [] },
      {},
    ];
    expect(computeKnownTags(sessions)).toEqual([
      "personal",
      "urgent",
      "work",
    ]);
  });

  it("trims whitespace and drops empty tags", () => {
    const sessions = [{ tags: ["  work  ", "", "   "] }];
    expect(computeKnownTags(sessions)).toEqual(["work"]);
  });

  it("returns an empty array when no sessions have tags", () => {
    expect(computeKnownTags([{}, { tags: [] }])).toEqual([]);
  });
});

describe("matchesTagFilters", () => {
  it("matches everything when the filter set is empty", () => {
    expect(matchesTagFilters({ tags: ["a"] }, new Set())).toBe(true);
    expect(matchesTagFilters({}, new Set())).toBe(true);
  });

  it("matches when the session has at least one active tag (OR)", () => {
    const active = new Set(["work", "urgent"]);
    expect(matchesTagFilters({ tags: ["work"] }, active)).toBe(true);
    expect(matchesTagFilters({ tags: ["urgent", "other"] }, active)).toBe(
      true,
    );
  });

  it("does not match when none of the session's tags are active", () => {
    const active = new Set(["work"]);
    expect(matchesTagFilters({ tags: ["personal"] }, active)).toBe(false);
    expect(matchesTagFilters({}, active)).toBe(false);
  });
});

describe("normalizeTagInput", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeTagInput("  my   tag  ")).toBe("my tag");
  });

  it("returns null for empty/whitespace-only input", () => {
    expect(normalizeTagInput("   ")).toBeNull();
    expect(normalizeTagInput("")).toBeNull();
  });
});

describe("toggleTag", () => {
  it("adds a tag when absent", () => {
    expect(toggleTag(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a tag when present", () => {
    expect(toggleTag(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("addTag", () => {
  it("adds a new normalized freeform tag", () => {
    expect(addTag(["a"], "  new tag  ")).toEqual(["a", "new tag"]);
  });

  it("does not duplicate an existing tag", () => {
    expect(addTag(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  it("ignores empty freeform input", () => {
    expect(addTag(["a"], "   ")).toEqual(["a"]);
  });
});
