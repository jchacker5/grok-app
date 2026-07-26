import { describe, expect, it } from "vitest";
import { generateTerminalId, trimScrollbackLines } from "./terminal";

describe("generateTerminalId", () => {
  it("returns unique terminal-prefixed ids", () => {
    const first = generateTerminalId();
    const second = generateTerminalId();

    expect(first).toMatch(/^terminal_/);
    expect(second).toMatch(/^terminal_/);
    expect(second).not.toBe(first);
  });
});

describe("trimScrollbackLines", () => {
  it("leaves lines under the cap unchanged", () => {
    expect(trimScrollbackLines(["one", "two"], 3)).toEqual(["one", "two"]);
  });

  it("drops the oldest lines first when over the cap", () => {
    expect(trimScrollbackLines(["one", "two", "three", "four"], 2)).toEqual([
      "three",
      "four",
    ]);
  });
});
