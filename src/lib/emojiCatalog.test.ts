import { describe, expect, it } from "vitest";
import {
  EMOJI_CATALOG,
  EMOJI_CATEGORIES,
  filterEmoji,
  type EmojiEntry,
} from "./emojiCatalog";

describe("EMOJI_CATALOG", () => {
  it("is a bundled catalog roughly 300-600 entries", () => {
    expect(EMOJI_CATALOG.length).toBeGreaterThanOrEqual(300);
    expect(EMOJI_CATALOG.length).toBeLessThanOrEqual(600);
  });

  it("every entry has a non-empty char/name/category and keywords array", () => {
    for (const e of EMOJI_CATALOG) {
      expect(e.char.length).toBeGreaterThan(0);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.category.length).toBeGreaterThan(0);
      expect(Array.isArray(e.keywords)).toBe(true);
    }
  });

  it("every category in EMOJI_CATEGORIES has at least one entry", () => {
    for (const cat of EMOJI_CATEGORIES) {
      expect(EMOJI_CATALOG.some((e) => e.category === cat)).toBe(true);
    }
  });

  it("every entry's category is a known EMOJI_CATEGORIES member", () => {
    const known = new Set(EMOJI_CATEGORIES);
    for (const e of EMOJI_CATALOG) {
      expect(known.has(e.category)).toBe(true);
    }
  });

  it("has no duplicate emoji chars", () => {
    const seen = new Set<string>();
    for (const e of EMOJI_CATALOG) {
      expect(seen.has(e.char)).toBe(false);
      seen.add(e.char);
    }
  });
});

describe("filterEmoji", () => {
  it("empty query returns the full catalog (no category)", () => {
    expect(filterEmoji("")).toEqual(EMOJI_CATALOG);
  });

  it("empty query scoped to a category returns only that category, grouped", () => {
    const result = filterEmoji("", "animals");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e: EmojiEntry) => e.category === "animals")).toBe(
      true,
    );
  });

  it("matches by name (case-insensitive substring)", () => {
    const result = filterEmoji("DOG");
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((e) => e.name.includes("dog"))).toBe(true);
  });

  it("matches by keyword even when name differs", () => {
    // "happy" is a keyword on several smiley entries, not necessarily the name.
    const result = filterEmoji("happy");
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (e) =>
          e.name.toLowerCase().includes("happy") ||
          e.keywords.some((k) => k.toLowerCase().includes("happy")),
      ),
    ).toBe(true);
  });

  it("query + category combines scope and match", () => {
    const result = filterEmoji("rice", "food");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.category === "food")).toBe(true);
    expect(
      result.every(
        (e) =>
          e.name.toLowerCase().includes("rice") ||
          e.keywords.some((k) => k.toLowerCase().includes("rice")),
      ),
    ).toBe(true);
    // A same-name match outside "food" (none here) must not leak in.
    expect(filterEmoji("rice", "animals").length).toBe(0);
  });

  it("no match returns an empty array", () => {
    expect(filterEmoji("zzzznotarealemoji12345")).toEqual([]);
  });
});
