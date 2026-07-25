import { describe, expect, it } from "vitest";
import {
  computeSessionDiff,
  SESSION_DIFF_LARGE_THRESHOLD,
  type SessionDiffMessage,
} from "./sessionDiff";

function msg(id: string, role: string, content: string): SessionDiffMessage {
  return { id, role, content, createdAt: "2026-01-01T00:00:00.000Z" };
}

describe("computeSessionDiff", () => {
  it("marks identical sessions fully unchanged", () => {
    const a = [msg("1", "user", "hi"), msg("2", "assistant", "hello")];
    const b = [msg("1", "user", "hi"), msg("2", "assistant", "hello")];
    const { entries, summary } = computeSessionDiff(a, b);
    expect(summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 2 });
    expect(entries.every((e) => e.kind === "unchanged")).toBe(true);
  });

  it("detects an appended message as added", () => {
    const a = [msg("1", "user", "hi")];
    const b = [msg("1", "user", "hi"), msg("2", "assistant", "hello")];
    const { summary } = computeSessionDiff(a, b);
    expect(summary).toEqual({ added: 1, removed: 0, changed: 0, unchanged: 1 });
  });

  it("detects a removed message", () => {
    const a = [msg("1", "user", "hi"), msg("2", "assistant", "hello")];
    const b = [msg("1", "user", "hi")];
    const { summary } = computeSessionDiff(a, b);
    expect(summary).toEqual({ added: 0, removed: 1, changed: 0, unchanged: 1 });
  });

  it("pairs same-role edits into a changed entry with a unified diff", () => {
    const a = [msg("1", "user", "hi"), msg("2", "assistant", "hello world")];
    const b = [msg("1", "user", "hi"), msg("2", "assistant", "hello there")];
    const { entries, summary } = computeSessionDiff(a, b);
    expect(summary).toEqual({ added: 0, removed: 0, changed: 1, unchanged: 1 });
    const changed = entries.find((e) => e.kind === "changed");
    expect(changed?.diffText).toContain("-hello world");
    expect(changed?.diffText).toContain("+hello there");
  });

  it("keeps different-role replacements as separate removed/added entries", () => {
    const a = [msg("1", "user", "question")];
    const b = [msg("1", "assistant", "answer")];
    const { summary } = computeSessionDiff(a, b);
    expect(summary).toEqual({ added: 1, removed: 1, changed: 0, unchanged: 0 });
  });

  it("handles empty sessions on both sides", () => {
    const { entries, summary } = computeSessionDiff([], []);
    expect(entries).toEqual([]);
    expect(summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 0 });
  });

  it("exposes a large-session threshold for callers to gate on", () => {
    expect(SESSION_DIFF_LARGE_THRESHOLD).toBeGreaterThan(0);
  });
});
