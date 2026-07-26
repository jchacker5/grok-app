import { describe, expect, it } from "vitest";
import { parseLatestChangelogEntry } from "./changelog";

const SAMPLE = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.13] - 2026-07-26

### Added

- **Embedded Terminal Panel (Phase 2)**: something.

### Fixed

- **Terminal concurrency limit not live**: fixed.

## [0.1.12] - 2026-07-26

### Added

- Older entry.
`;

describe("parseLatestChangelogEntry", () => {
  it("skips the Unreleased section and returns the top concrete version", () => {
    const entry = parseLatestChangelogEntry(SAMPLE);
    expect(entry).not.toBeNull();
    expect(entry?.version).toBe("0.1.13");
    expect(entry?.date).toBe("2026-07-26");
    expect(entry?.body).toContain("Embedded Terminal Panel");
    expect(entry?.body).not.toContain("Older entry");
  });

  it("returns null for empty input", () => {
    expect(parseLatestChangelogEntry("")).toBeNull();
  });

  it("returns null when only Unreleased exists", () => {
    const raw = "# Changelog\n\n## [Unreleased]\n\n- wip\n";
    expect(parseLatestChangelogEntry(raw)).toBeNull();
  });

  it("handles a version header with no trailing date", () => {
    const raw = "## [1.0.0]\n\nBody text.\n";
    const entry = parseLatestChangelogEntry(raw);
    expect(entry?.version).toBe("1.0.0");
    expect(entry?.date).toBeNull();
    expect(entry?.body).toBe("Body text.");
  });

  it("is case-insensitive about the Unreleased marker", () => {
    const raw = "## [unreleased]\n\n- wip\n\n## [2.0.0] - 2026-01-01\n\nStable.\n";
    const entry = parseLatestChangelogEntry(raw);
    expect(entry?.version).toBe("2.0.0");
  });
});
