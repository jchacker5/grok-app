import { describe, expect, it } from "vitest";
import {
  groupSessionsByFolder,
  isFoldered,
  sessionsForFolderId,
  type FolderableSession,
  type SessionFolderLike,
} from "./sessionFolders";

interface Row extends FolderableSession {
  id: string;
}

function row(id: string, folderId?: string | null): Row {
  return { id, folderId };
}

function folder(id: string, name = id): SessionFolderLike {
  return { id, name };
}

describe("isFoldered", () => {
  it("is false when folderId is missing, null, or empty", () => {
    expect(isFoldered({})).toBe(false);
    expect(isFoldered({ folderId: null })).toBe(false);
    expect(isFoldered({ folderId: undefined })).toBe(false);
  });

  it("is true when folderId is set", () => {
    expect(isFoldered({ folderId: "f1" })).toBe(true);
  });
});

describe("sessionsForFolderId", () => {
  it("returns only sessions assigned to the given folder", () => {
    const rows = [row("a", "f1"), row("b", "f2"), row("c", "f1"), row("d")];
    expect(sessionsForFolderId(rows, "f1").map((r) => r.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns an empty array when no sessions match", () => {
    const rows = [row("a", "f1")];
    expect(sessionsForFolderId(rows, "f9")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = [row("a", "f1"), row("b", "f2")];
    const copy = [...rows];
    sessionsForFolderId(rows, "f1");
    expect(rows).toEqual(copy);
  });
});

describe("groupSessionsByFolder", () => {
  it("buckets sessions under their assigned folder, preserving folder order", () => {
    const rows = [row("a", "f2"), row("b", "f1"), row("c", "f1"), row("d")];
    const folders = [folder("f1", "Work"), folder("f2", "Research")];
    const groups = groupSessionsByFolder(rows, folders);

    expect(groups.map((g) => g.folder.id)).toEqual(["f1", "f2"]);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(["b", "c"]);
    expect(groups[1]!.sessions.map((s) => s.id)).toEqual(["a"]);
  });

  it("includes folders with no matching sessions as empty groups", () => {
    const rows = [row("a", "f1")];
    const folders = [folder("f1"), folder("f-empty")];
    const groups = groupSessionsByFolder(rows, folders);

    expect(groups).toHaveLength(2);
    expect(groups[1]!.folder.id).toBe("f-empty");
    expect(groups[1]!.sessions).toEqual([]);
  });

  it("returns an empty list when there are no folders", () => {
    const rows = [row("a", "f1")];
    expect(groupSessionsByFolder(rows, [])).toEqual([]);
  });

  it("session's folder-less (undefined/null) status is excluded from every group", () => {
    const rows = [row("a"), row("b", null)];
    const folders = [folder("f1")];
    const groups = groupSessionsByFolder(rows, folders);
    expect(groups[0]!.sessions).toEqual([]);
  });
});
