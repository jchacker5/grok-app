import { describe, expect, it } from "vitest";
import {
  sessionExportFilename,
  sessionToJson,
  sessionToMarkdown,
} from "./sessionExport";

describe("sessionToMarkdown", () => {
  it("builds a title, meta block, and role sections", () => {
    const md = sessionToMarkdown({
      title: "Doctor reset",
      projectName: "grok-app",
      projectPath: "/tmp/grok-app",
      sessionId: "abc12345-full",
      exportedAt: "2026-07-24T00:00:00.000Z",
      messages: [
        { role: "user", content: "Add reset data" },
        {
          role: "assistant",
          content: "Done.",
          thought: "Need double confirm.",
        },
      ],
    });
    expect(md).toContain("# Doctor reset");
    expect(md).toContain("Project: grok-app");
    expect(md).toContain("Session: abc12345-full");
    expect(md).toContain("## User");
    expect(md).toContain("Add reset data");
    expect(md).toContain("## Assistant");
    expect(md).toContain("<summary>Thinking</summary>");
    expect(md).toContain("Need double confirm.");
    expect(md).toContain("Done.");
  });

  it("skips empty tool messages", () => {
    const md = sessionToMarkdown({
      title: "t",
      exportedAt: "2026-07-24T00:00:00.000Z",
      messages: [
        { role: "tool", content: "" },
        { role: "user", content: "hi" },
      ],
    });
    expect(md).not.toContain("## Tool");
    expect(md).toContain("## User");
  });

  it("falls back to Untitled", () => {
    const md = sessionToMarkdown({
      title: "   ",
      exportedAt: "2026-07-24T00:00:00.000Z",
      messages: [],
    });
    expect(md.startsWith("# Untitled")).toBe(true);
  });
});

describe("sessionToJson", () => {
  it("emits parseable JSON with user-facing fields only", () => {
    const json = sessionToJson({
      title: "Doctor reset",
      projectName: "grok-app",
      sessionId: "abc12345-full",
      exportedAt: "2026-07-24T00:00:00.000Z",
      messages: [
        { role: "user", content: "Add reset data", createdAt: "2026-07-24T00:00:00.000Z" },
        { role: "assistant", content: "Done.", thought: "Need double confirm." },
      ],
    });
    const doc = JSON.parse(json);
    expect(doc.title).toBe("Doctor reset");
    expect(doc.projectName).toBe("grok-app");
    expect(doc.sessionId).toBe("abc12345-full");
    expect(doc.messageCount).toBe(2);
    expect(doc.messages).toHaveLength(2);
    expect(doc.messages[0]).toMatchObject({
      role: "user",
      content: "Add reset data",
      timestamp: "2026-07-24T00:00:00.000Z",
    });
    expect(doc.messages[1].thought).toBe("Need double confirm.");
  });

  it("skips empty and empty-tool messages", () => {
    const doc = JSON.parse(
      sessionToJson({
        title: "t",
        exportedAt: "2026-07-24T00:00:00.000Z",
        messages: [
          { role: "tool", content: "" },
          { role: "assistant", content: "   " },
          { role: "user", content: "hi" },
        ],
      }),
    );
    expect(doc.messages).toHaveLength(1);
    expect(doc.messages[0].role).toBe("user");
  });
});

describe("sessionExportFilename", () => {
  it("slugifies title and appends short id", () => {
    expect(sessionExportFilename("Fix Doctor Reset!", "abcdef12-xxxx")).toBe(
      "grok-fix-doctor-reset-abcdef12.md",
    );
  });

  it("handles empty title", () => {
    expect(sessionExportFilename("", null)).toBe("grok-session.md");
  });

  it("honors the json extension", () => {
    expect(sessionExportFilename("Report", "abcdef12", "json")).toBe(
      "grok-report-abcdef12.json",
    );
  });
});
