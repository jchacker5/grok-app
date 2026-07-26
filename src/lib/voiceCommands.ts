/**
 * Voice command detection for dictation transcripts — v1 starter set.
 *
 * Today, dictation only substitutes spoken punctuation words ("period",
 * "comma", "new line", "question mark", ...) via a plain string-substitution
 * step (see `App.tsx`, the dictation `MediaRecorder.onstop` handler). This
 * module adds a SMALL, deliberately narrow set of spoken commands that
 * trigger real app actions (send the draft, start a new session, end
 * dictation) instead of being inserted into the composer as literal text.
 *
 * Safety/false-positive rule: a phrase only matches when it makes up the
 * ENTIRE transcript (after trimming whitespace and trailing sentence
 * punctuation like "." "!" "?" "..."). It never matches when embedded
 * mid-sentence, so ordinary dictation like "let's send it to accounting
 * tomorrow" or "I started a new session yesterday" does NOT accidentally
 * fire a command — only a transcript that IS (essentially) just the trigger
 * phrase does.
 *
 * This is a v1 starter set on purpose: three actions, six trigger phrases.
 * Keep additions rare and deliberate — every new phrase is a new way for
 * ordinary dictated speech to accidentally collide with a command.
 */

export type VoiceCommandName = "send" | "newSession" | "stopDictation";

export interface VoiceCommandMatch {
  command: VoiceCommandName;
  /** Text remaining after the trigger phrase (always "" for this starter set — no phrase takes arguments). */
  remainder: string;
}

/** Trigger phrase → command. Matched case-insensitively against the WHOLE (normalized) transcript. */
const TRIGGERS: ReadonlyArray<{
  phrases: readonly string[];
  command: VoiceCommandName;
}> = [
  { phrases: ["send message", "send it"], command: "send" },
  { phrases: ["new session", "new chat"], command: "newSession" },
  { phrases: ["stop dictation"], command: "stopDictation" },
];

/** Trim whitespace and strip trailing sentence punctuation, then lowercase. */
function normalizeForMatch(s: string): string {
  return s
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim()
    .toLowerCase();
}

/**
 * Detect a voice command when — and only when — a trigger phrase constitutes
 * the entire transcript (modulo trailing punctuation/whitespace). Returns
 * `null` when the transcript is empty or does not exactly match a known
 * trigger phrase (including when a trigger phrase merely appears somewhere
 * inside a longer sentence).
 */
export function matchVoiceCommand(transcript: string): VoiceCommandMatch | null {
  const normalized = normalizeForMatch(transcript);
  if (!normalized) return null;
  for (const { phrases, command } of TRIGGERS) {
    if (phrases.includes(normalized)) {
      return { command, remainder: "" };
    }
  }
  return null;
}
