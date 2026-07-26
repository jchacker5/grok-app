import { describe, expect, it } from "vitest";
import { authorInitials } from "./CodePreview";

describe("authorInitials (blame gutter chip)", () => {
  it("takes first+last initials for multi-word names", () => {
    expect(authorInitials("Jane Doe")).toBe("JD");
    expect(authorInitials("John Middle Smith")).toBe("JS");
  });

  it("falls back to a 2-letter prefix for single-word names", () => {
    expect(authorInitials("Cher")).toBe("CH");
    expect(authorInitials("X")).toBe("X");
  });

  it("handles empty / whitespace-only input without throwing", () => {
    expect(authorInitials("")).toBe("?");
    expect(authorInitials("   ")).toBe("?");
  });

  it("collapses repeated internal whitespace", () => {
    expect(authorInitials("Jane   Doe")).toBe("JD");
  });
});
