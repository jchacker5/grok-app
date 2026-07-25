import { describe, expect, it } from "vitest";
import {
  addComment,
  editCommentBody,
  formatReviewCommentsBlock,
  listCommentsForPath,
  listCommentsForStableId,
  prependReviewComments,
  removeComment,
  type DiffComment,
  type DiffCommentAnchor,
} from "./reviewComments";

const anchor: DiffCommentAnchor = {
  path: "src/foo.ts",
  stableId: "src/foo.ts#0#add#:5",
  contentHash: "abc123",
  side: "new",
  lineNumber: 5,
};

describe("addComment", () => {
  it("appends a comment with a generated id and timestamp", () => {
    const list = addComment([], anchor, "please fix this");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      path: anchor.path,
      stableId: anchor.stableId,
      contentHash: anchor.contentHash,
      side: "new",
      lineNumber: 5,
      body: "please fix this",
    });
    expect(list[0]!.id).toBeTruthy();
    expect(typeof list[0]!.createdAt).toBe("number");
  });

  it("trims whitespace from the body", () => {
    const list = addComment([], anchor, "  spaced out  ");
    expect(list[0]!.body).toBe("spaced out");
  });

  it("is a no-op for blank/whitespace-only bodies", () => {
    const list = addComment([], anchor, "   ");
    expect(list).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const original: DiffComment[] = [];
    const next = addComment(original, anchor, "hello");
    expect(original).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it("accepts explicit id/createdAt overrides (used by tests + edit flow)", () => {
    const list = addComment([], anchor, "hi", { id: "fixed-id", createdAt: 42 });
    expect(list[0]).toMatchObject({ id: "fixed-id", createdAt: 42 });
  });
});

describe("removeComment", () => {
  it("removes by id", () => {
    const list = addComment([], anchor, "one", { id: "a" });
    const withB = addComment(list, anchor, "two", { id: "b" });
    const next = removeComment(withB, "a");
    expect(next.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns the same array reference when id is not found", () => {
    const list = addComment([], anchor, "one", { id: "a" });
    const next = removeComment(list, "does-not-exist");
    expect(next).toBe(list);
  });
});

describe("editCommentBody", () => {
  it("replaces the body of the matching comment", () => {
    const list = addComment([], anchor, "old text", { id: "a" });
    const next = editCommentBody(list, "a", "new text");
    expect(next[0]!.body).toBe("new text");
    // Other fields preserved.
    expect(next[0]!.stableId).toBe(anchor.stableId);
  });

  it("is a no-op for a blank replacement body", () => {
    const list = addComment([], anchor, "old text", { id: "a" });
    const next = editCommentBody(list, "a", "   ");
    expect(next[0]!.body).toBe("old text");
  });
});

describe("listCommentsForPath / listCommentsForStableId", () => {
  it("filters by path", () => {
    const list = [
      ...addComment([], anchor, "a", { id: "1" }),
      ...addComment(
        [],
        { ...anchor, path: "src/bar.ts", stableId: "src/bar.ts#0#add#:1" },
        "b",
        { id: "2" },
      ),
    ];
    expect(listCommentsForPath(list, "src/foo.ts").map((c) => c.id)).toEqual([
      "1",
    ]);
  });

  it("filters by stableId", () => {
    const list = [
      ...addComment([], anchor, "a", { id: "1" }),
      ...addComment([], { ...anchor, stableId: "other-id" }, "b", { id: "2" }),
    ];
    expect(
      listCommentsForStableId(list, anchor.stableId).map((c) => c.id),
    ).toEqual(["1"]);
  });
});

describe("formatReviewCommentsBlock / prependReviewComments", () => {
  it("is empty for no comments", () => {
    expect(formatReviewCommentsBlock([])).toBe("");
    expect(prependReviewComments("hello agent", [])).toBe("hello agent");
  });

  it("formats a silent-prefix block with path:line (side): body per comment", () => {
    const list = addComment([], anchor, "please simplify this branch", {
      id: "1",
    });
    const block = formatReviewCommentsBlock(list);
    expect(block).toContain("src/foo.ts:5 (new): please simplify this branch");
    expect(block.toLowerCase()).toContain("internal");
  });

  it("prepends the block ahead of the visible agent text with a blank line", () => {
    const list = addComment([], anchor, "fix me", { id: "1" });
    const prompt = prependReviewComments("Do the thing", list);
    expect(prompt.endsWith("\n\nDo the thing")).toBe(true);
    expect(prompt.indexOf("src/foo.ts")).toBeLessThan(prompt.indexOf("Do the thing"));
  });
});
