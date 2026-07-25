import { describe, expect, it } from "vitest";
import {
  allDiffLines,
  buildStableId,
  findLineByStableId,
  hashLineContent,
  parseUnifiedDiff,
} from "./diffModel";
import { buildUnifiedDiff } from "./sessionChanges";

describe("hashLineContent", () => {
  it("is deterministic for the same content", () => {
    expect(hashLineContent("const x = 1;")).toBe(hashLineContent("const x = 1;"));
  });

  it("differs for different content", () => {
    expect(hashLineContent("a")).not.toBe(hashLineContent("b"));
  });

  it("returns a short string, not empty for empty input", () => {
    expect(typeof hashLineContent("")).toBe("string");
    expect(hashLineContent("").length).toBeGreaterThan(0);
  });
});

describe("buildStableId", () => {
  it("is deterministic given the same inputs", () => {
    const a = buildStableId("src/x.ts", 0, "add", null, 5);
    const b = buildStableId("src/x.ts", 0, "add", null, 5);
    expect(a).toBe(b);
  });

  it("differs when hunk index or kind differs", () => {
    const a = buildStableId("src/x.ts", 0, "add", null, 5);
    const b = buildStableId("src/x.ts", 1, "add", null, 5);
    const c = buildStableId("src/x.ts", 0, "remove", 5, null);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("parseUnifiedDiff", () => {
  it("parses a single hunk with context, add, and remove lines", () => {
    const unified = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,4 +1,4 @@",
      " line1",
      "-line2",
      "+line2-changed",
      " line3",
    ].join("\n");

    const model = parseUnifiedDiff(unified, "foo.ts");
    expect(model.path).toBe("foo.ts");
    expect(model.hunks).toHaveLength(1);
    const hunk = model.hunks[0]!;
    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldLines).toBe(4);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newLines).toBe(4);
    expect(hunk.lines).toHaveLength(4);

    const [l1, l2, l3, l4] = hunk.lines;
    expect(l1).toMatchObject({
      kind: "context",
      content: "line1",
      oldLineNumber: 1,
      newLineNumber: 1,
    });
    expect(l2).toMatchObject({
      kind: "remove",
      content: "line2",
      oldLineNumber: 2,
      newLineNumber: null,
    });
    expect(l3).toMatchObject({
      kind: "add",
      content: "line2-changed",
      oldLineNumber: null,
      newLineNumber: 2,
    });
    expect(l4).toMatchObject({
      kind: "context",
      content: "line3",
      oldLineNumber: 3,
      newLineNumber: 3,
    });
  });

  it("parses multiple hunks with independent hunkIndex", () => {
    const unified = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,2 +1,2 @@",
      "-a",
      "+a2",
      " b",
      "@@ -10,2 +10,2 @@",
      " c",
      "-d",
      "+d2",
    ].join("\n");

    const model = parseUnifiedDiff(unified, "foo.ts");
    expect(model.hunks).toHaveLength(2);
    expect(model.hunks[0]!.lines.every((l) => l.hunkIndex === 0)).toBe(true);
    expect(model.hunks[1]!.lines.every((l) => l.hunkIndex === 1)).toBe(true);
    expect(model.hunks[1]!.oldStart).toBe(10);
  });

  it("handles an added-only hunk (no old lines)", () => {
    const unified = ["@@ -0,0 +1,2 @@", "+new line 1", "+new line 2"].join("\n");
    const model = parseUnifiedDiff(unified, "new.ts");
    expect(model.hunks).toHaveLength(1);
    const lines = model.hunks[0]!.lines;
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.kind).toBe("add");
      expect(l.oldLineNumber).toBeNull();
      expect(l.side).toBe("new");
    }
    expect(lines[0]!.newLineNumber).toBe(1);
    expect(lines[1]!.newLineNumber).toBe(2);
  });

  it("handles a removed-only hunk (no new lines)", () => {
    const unified = ["@@ -1,2 +0,0 @@", "-old line 1", "-old line 2"].join("\n");
    const model = parseUnifiedDiff(unified, "gone.ts");
    expect(model.hunks).toHaveLength(1);
    const lines = model.hunks[0]!.lines;
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.kind).toBe("remove");
      expect(l.newLineNumber).toBeNull();
      expect(l.side).toBe("old");
    }
    expect(lines[0]!.oldLineNumber).toBe(1);
    expect(lines[1]!.oldLineNumber).toBe(2);
  });

  it("returns zero hunks for buildUnifiedDiff's empty-diff marker", () => {
    const unified = buildUnifiedDiff("same.ts", "a\nb\n", "a\nb\n");
    expect(unified).toContain("@@ empty diff @@");
    const model = parseUnifiedDiff(unified, "same.ts");
    expect(model.hunks).toHaveLength(0);
  });

  it("stable ids are deterministic and unique per line within a diff", () => {
    const unified = [
      "@@ -1,3 +1,3 @@",
      " ctx",
      "-old",
      "+new",
    ].join("\n");
    const model = parseUnifiedDiff(unified, "f.ts");
    const ids = allDiffLines(model).map((l) => l.stableId);
    expect(new Set(ids).size).toBe(ids.length);
    // Re-parsing identical text yields identical ids (re-render stability).
    const model2 = parseUnifiedDiff(unified, "f.ts");
    expect(allDiffLines(model2).map((l) => l.stableId)).toEqual(ids);
  });

  it("findLineByStableId locates a line and detects content drift via hash", () => {
    const unified = ["@@ -1,2 +1,2 @@", " ctx", "-old", "+new"].join("\n");
    const model = parseUnifiedDiff(unified, "f.ts");
    const addLine = allDiffLines(model).find((l) => l.kind === "add")!;
    const found = findLineByStableId(model, addLine.stableId);
    expect(found).not.toBeNull();
    expect(found!.contentHash).toBe(addLine.contentHash);
    // A stored comment's hash from stale content would mismatch:
    expect(found!.contentHash).not.toBe(hashLineContent("totally different"));
  });

  it("round-trips a real buildUnifiedDiff() output (session-sourced diff)", () => {
    const before = ["a", "b", "c", "d", "e"].join("\n") + "\n";
    const after = ["a", "b", "X", "d", "e", "f"].join("\n") + "\n";
    const unified = buildUnifiedDiff("real.ts", before, after);
    expect(unified).toMatch(/^--- a\/real\.ts/);
    expect(unified).toContain("+++ b/real.ts");

    const model = parseUnifiedDiff(unified, "real.ts");
    expect(model.hunks.length).toBeGreaterThan(0);

    // Reassemble old/new file content from the parsed model and compare
    // against the original before/after text (minus trailing newline).
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (const line of allDiffLines(model)) {
      if (line.kind !== "add") oldLines.push(line.content);
      if (line.kind !== "remove") newLines.push(line.content);
    }
    // The diff only carries hunk + context lines (default context = 3, which
    // covers this whole short file), so reconstructed content should match.
    expect(oldLines.join("\n")).toBe(before.trimEnd());
    expect(newLines.join("\n")).toBe(after.trimEnd());
  });

  it("returns an empty model for an empty string", () => {
    const model = parseUnifiedDiff("", "empty.ts");
    expect(model.path).toBe("empty.ts");
    expect(model.hunks).toEqual([]);
  });
});
