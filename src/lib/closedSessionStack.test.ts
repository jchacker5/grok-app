import { describe, expect, it } from "vitest";
import {
  CLOSED_SESSION_STACK_LIMIT,
  popClosedSession,
  pushClosedSession,
  type ClosedSessionEntry,
} from "./closedSessionStack";

function entry(id: string): ClosedSessionEntry {
  return { id, title: `Session ${id}`, projectId: null };
}

describe("pushClosedSession", () => {
  it("unshifts the newly-closed session onto the front", () => {
    const stack = pushClosedSession([entry("a")], entry("b"));
    expect(stack.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("caps the stack at CLOSED_SESSION_STACK_LIMIT entries", () => {
    let stack: ClosedSessionEntry[] = [];
    for (let i = 0; i < CLOSED_SESSION_STACK_LIMIT + 3; i++) {
      stack = pushClosedSession(stack, entry(String(i)));
    }
    expect(stack.length).toBe(CLOSED_SESSION_STACK_LIMIT);
    // Most recently closed (highest index) stays at the front.
    expect(stack[0].id).toBe(String(CLOSED_SESSION_STACK_LIMIT + 2));
  });

  it("de-dupes by id, moving a re-closed session back to the front", () => {
    const stack = pushClosedSession(
      [entry("a"), entry("b")],
      entry("b"),
    );
    expect(stack.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("popClosedSession", () => {
  it("pops the front entry and returns the remainder", () => {
    const { entry: popped, rest } = popClosedSession([
      entry("b"),
      entry("a"),
    ]);
    expect(popped?.id).toBe("b");
    expect(rest.map((e) => e.id)).toEqual(["a"]);
  });

  it("is a no-op on an empty stack (entry: null)", () => {
    const { entry: popped, rest } = popClosedSession([]);
    expect(popped).toBeNull();
    expect(rest).toEqual([]);
  });
});
