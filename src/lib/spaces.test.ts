import { describe, expect, it } from "vitest";
import {
  colorForSpaceIndex,
  sortSpaces,
  spaceForShortcutIndex,
  type Space,
} from "./spaces";

function space(id: string, sortIndex: number): Space {
  return { id, name: id, createdAt: "2026-01-01T00:00:00Z", sortIndex };
}

describe("sortSpaces", () => {
  it("orders by sortIndex regardless of input order", () => {
    const list = [space("c", 2), space("a", 0), space("b", 1)];
    expect(sortSpaces(list).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const list = [space("b", 1), space("a", 0)];
    const copy = [...list];
    sortSpaces(list);
    expect(list).toEqual(copy);
  });
});

describe("spaceForShortcutIndex", () => {
  const spaces = [space("s0", 0), space("s1", 1), space("s2", 2)];

  it("maps index 0 to 'all'", () => {
    expect(spaceForShortcutIndex(spaces, 0)).toBe("all");
  });

  it("maps 1-9 to the nth space in sort order", () => {
    expect(spaceForShortcutIndex(spaces, 1)).toBe("s0");
    expect(spaceForShortcutIndex(spaces, 2)).toBe("s1");
    expect(spaceForShortcutIndex(spaces, 3)).toBe("s2");
  });

  it("returns null when there aren't that many spaces", () => {
    expect(spaceForShortcutIndex(spaces, 4)).toBeNull();
    expect(spaceForShortcutIndex(spaces, 9)).toBeNull();
  });

  it("returns null for out-of-range indices", () => {
    expect(spaceForShortcutIndex(spaces, -1)).toBeNull();
    expect(spaceForShortcutIndex(spaces, 10)).toBeNull();
  });

  it("resolves against unsorted input by sorting first", () => {
    const shuffled = [space("s2", 2), space("s0", 0), space("s1", 1)];
    expect(spaceForShortcutIndex(shuffled, 1)).toBe("s0");
  });
});

describe("colorForSpaceIndex", () => {
  it("is deterministic", () => {
    expect(colorForSpaceIndex(3)).toBe(colorForSpaceIndex(3));
  });

  it("wraps around after the palette length", () => {
    expect(colorForSpaceIndex(0)).toBe(colorForSpaceIndex(8));
  });

  it("handles negative indices without throwing", () => {
    expect(() => colorForSpaceIndex(-1)).not.toThrow();
    expect(colorForSpaceIndex(-1)).toBe(colorForSpaceIndex(7));
  });
});
