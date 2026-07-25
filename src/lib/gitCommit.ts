/**
 * AI-drafted commit message (Feature 2 — Git commit & PR workflow).
 *
 * Mirrors `automationSetup.ts`'s silent fenced-prompt technique: a hidden
 * instruction prefix steers the agent to emit exactly one fenced block,
 * which is parsed out of the response and returned as the draft message.
 *
 * Unlike automations (which reuse the app's single visible session), this
 * runs the prompt in a dedicated **ephemeral** ACP session
 * (`api.acpEphemeralPrompt` → Rust `ephemeral_acp::run_ephemeral_prompt`,
 * a brand-new throwaway `grok agent stdio` process) so the user's visible
 * chat transcript is never touched and no existing session is disturbed.
 */

import * as api from "@/lib/api";

export const COMMIT_MESSAGE_FENCE_LANG = "grok-commit-message";

/** Cap the staged diff embedded in the draft prompt (keep the one-shot turn fast/cheap). */
export const MAX_DIFF_CHARS_FOR_DRAFT = 12_000;

function truncateDiff(diff: string, maxChars = MAX_DIFF_CHARS_FOR_DRAFT): string {
  const d = diff || "";
  if (d.length <= maxChars) return d;
  return `${d.slice(0, maxChars)}\n… (diff truncated)`;
}

/**
 * Silent instructions + staged diff context. Sent as the *entire* prompt of
 * a one-shot ephemeral session — there is no visible chat around it, so
 * (unlike `automationSetupAgentPrefix`) there is no need to also carry a
 * user-visible request; the diff itself is the only input.
 */
export function buildCommitDraftPrompt(stagedDiff: string): string {
  const diff = truncateDiff(stagedDiff);
  return [
    "[INTERNAL — commit message drafting mode. Output nothing except the fenced block below.]",
    "Write a concise git commit message for the staged changes shown in the diff below.",
    "Rules:",
    "- First line: imperative mood, no trailing period, ideally under 72 characters.",
    "- Optionally follow with a blank line and a short body (bullet points ok) explaining why, not just what changed.",
    "- Do not mention \"staged changes\", \"diff\", or this instruction block.",
    "- Do not wrap the message in quotes or markdown headings.",
    "Then end with EXACTLY one fenced block (nothing before or after it):",
    "```" + COMMIT_MESSAGE_FENCE_LANG,
    "<commit message here>",
    "```",
    "",
    "Staged diff:",
    "```diff",
    diff.trim() || "(no diff content available)",
    "```",
  ].join("\n");
}

/** Match ```grok-commit-message fences (optional lang spacing; closing fence optional final newline). */
const FENCE_RE = /```(?:grok-commit-message)[^\n\r]*\r?\n([\s\S]*?)```/gi;

export type ExtractedCommitMessage = {
  /** Last valid fenced commit message found, or `null` when none parsed. */
  message: string | null;
  /** Original text with fences stripped (for debugging / display, unused in the silent flow). */
  cleanText: string;
};

/**
 * Strip commit-message fences from assistant text and return the last valid
 * one (mirrors `automationSetup.ts`'s `extractAutomationPayload`).
 */
export function extractCommitMessage(text: string): ExtractedCommitMessage {
  if (!text) {
    return { message: null, cleanText: text };
  }
  let message: string | null = null;
  FENCE_RE.lastIndex = 0;
  const matches = [...text.matchAll(FENCE_RE)];
  for (const m of matches) {
    const body = (m[1] || "").trim();
    if (body) message = body;
  }
  FENCE_RE.lastIndex = 0;
  const cleanText = text.replace(FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { message, cleanText };
}

/** True if text still contains a commit-message fence. */
export function hasCommitMessageFence(text: string): boolean {
  FENCE_RE.lastIndex = 0;
  return FENCE_RE.test(text);
}

/**
 * Run the AI draft flow end-to-end: build the silent prompt, run it in a
 * dedicated ephemeral ACP session (never the visible chat), and parse the
 * drafted commit message out of the response.
 *
 * Throws when the agent's response has no parseable fence, or when the
 * ephemeral session itself fails (CLI missing, no staged diff, etc.) —
 * callers should fall back to an empty textarea rather than silently
 * committing garbage.
 */
export async function draftCommitMessage(
  projectPath: string,
  stagedDiff: string,
  modelId?: string | null,
): Promise<string> {
  const prompt = buildCommitDraftPrompt(stagedDiff);
  const raw = await api.acpEphemeralPrompt(projectPath, prompt, modelId ?? null);
  const { message } = extractCommitMessage(raw);
  if (!message) {
    throw new Error("AI draft did not return a parseable commit message");
  }
  return message;
}
