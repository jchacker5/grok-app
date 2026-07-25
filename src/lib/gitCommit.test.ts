import { describe, expect, it, vi } from "vitest";
import {
  buildCommitDraftPrompt,
  COMMIT_MESSAGE_FENCE_LANG,
  draftCommitMessage,
  extractCommitMessage,
  hasCommitMessageFence,
  MAX_DIFF_CHARS_FOR_DRAFT,
} from "./gitCommit";

describe("buildCommitDraftPrompt", () => {
  it("embeds the staged diff and the fence language", () => {
    const prompt = buildCommitDraftPrompt("diff --git a/a.ts b/a.ts\n+hello");
    expect(prompt).toContain("diff --git a/a.ts b/a.ts");
    expect(prompt).toContain("```" + COMMIT_MESSAGE_FENCE_LANG);
    expect(prompt).toContain("INTERNAL");
  });

  it("falls back to a placeholder when the diff is empty", () => {
    const prompt = buildCommitDraftPrompt("");
    expect(prompt).toContain("(no diff content available)");
  });

  it("truncates very large diffs", () => {
    const bigDiff = "+line\n".repeat(10_000);
    const prompt = buildCommitDraftPrompt(bigDiff);
    expect(prompt.length).toBeLessThan(bigDiff.length);
    expect(prompt).toContain("(diff truncated)");
    expect(bigDiff.length).toBeGreaterThan(MAX_DIFF_CHARS_FOR_DRAFT);
  });
});

describe("extractCommitMessage", () => {
  it("parses a single fenced commit message", () => {
    const text = [
      "Sure, here you go.",
      "```grok-commit-message",
      "fix: handle empty staged diff",
      "",
      "- guard against blank input",
      "```",
    ].join("\n");
    const { message, cleanText } = extractCommitMessage(text);
    expect(message).toBe("fix: handle empty staged diff\n\n- guard against blank input");
    expect(cleanText).not.toContain("grok-commit-message");
    expect(cleanText).toContain("Sure, here you go.");
  });

  it("returns the last valid fence when multiple are present", () => {
    const text = [
      "```grok-commit-message",
      "first draft",
      "```",
      "actually, let me revise:",
      "```grok-commit-message",
      "second draft",
      "```",
    ].join("\n");
    const { message } = extractCommitMessage(text);
    expect(message).toBe("second draft");
  });

  it("returns null message for empty or non-matching text", () => {
    expect(extractCommitMessage("").message).toBeNull();
    expect(extractCommitMessage("no fence here").message).toBeNull();
  });

  it("ignores an empty fence body", () => {
    const text = "```grok-commit-message\n\n```";
    expect(extractCommitMessage(text).message).toBeNull();
  });

  it("does not match unrelated fence languages", () => {
    const text = "```json\n{\"a\":1}\n```";
    expect(extractCommitMessage(text).message).toBeNull();
  });
});

describe("hasCommitMessageFence", () => {
  it("detects presence of the fence", () => {
    expect(hasCommitMessageFence("```grok-commit-message\nx\n```")).toBe(true);
    expect(hasCommitMessageFence("plain text")).toBe(false);
  });
});

describe("draftCommitMessage", () => {
  it("runs the ephemeral prompt and parses the fence out of the response", async () => {
    const api = await import("./api");
    const spy = vi
      .spyOn(api, "acpEphemeralPrompt")
      .mockResolvedValue(
        "```grok-commit-message\nfeat: add widgets\n```",
      );
    const msg = await draftCommitMessage("/proj", "diff --git a b\n+x", "grok-4.5");
    expect(msg).toBe("feat: add widgets");
    expect(spy).toHaveBeenCalledWith(
      "/proj",
      expect.stringContaining("diff --git a b"),
      "grok-4.5",
    );
    spy.mockRestore();
  });

  it("throws when the response has no parseable fence", async () => {
    const api = await import("./api");
    const spy = vi
      .spyOn(api, "acpEphemeralPrompt")
      .mockResolvedValue("sorry, I could not draft one");
    await expect(draftCommitMessage("/proj", "diff")).rejects.toThrow(
      /parseable commit message/,
    );
    spy.mockRestore();
  });
});
