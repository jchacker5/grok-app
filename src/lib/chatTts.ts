/**
 * Chat text-to-speech via the browser/WebView's native `SpeechSynthesis` API.
 *
 * This is an opt-in read-aloud for REGULAR chat replies — separate from the
 * realtime Live Voice session (see `voiceAudio.ts` / `voice_host.rs`), which
 * streams audio from xAI's realtime socket during an active voice call.
 * There is no general-purpose "speak this text" server-side TTS call
 * available (`voice_tts.rs` only lists voice options for Live Voice), so this
 * module uses `window.speechSynthesis` instead: fully offline/local, works in
 * a Tauri webview on macOS/Windows/Linux, no new Rust/network call needed.
 *
 * Mirrors `desktopNotify.ts`'s style: small, defensive wrapper around a
 * browser API, safe to call anywhere, never throws into the caller.
 */

export type SpeakOptions = {
  /** Speech rate multiplier (browser-clamped, typically ~0.1–10). Default 1. */
  rate?: number;
  /** Exact `SpeechSynthesisVoice.name` to prefer, when available. */
  voiceName?: string;
};

// Read off `globalThis` (not `window`) so this works under both the browser
// runtime and the vitest `node` test environment, where `window` is absent
// but tests stub the API directly onto `globalThis` — same convention as
// `desktopNotify.ts`'s `notificationCtor()`.
function synth(): SpeechSynthesis | null {
  if (typeof globalThis === "undefined") return null;
  const s = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis })
    .speechSynthesis;
  return s ?? null;
}

function utteranceCtor(): typeof SpeechSynthesisUtterance | null {
  if (typeof globalThis === "undefined") return null;
  const U = (
    globalThis as unknown as {
      SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
    }
  ).SpeechSynthesisUtterance;
  return typeof U === "function" ? U : null;
}

/** True when the browser/webview exposes the `SpeechSynthesis` API. */
export function speechSupported(): boolean {
  return !!synth() && !!utteranceCtor();
}

/**
 * Best-effort check for whether an utterance is currently speaking/queued.
 * Used by UI callers (e.g. the per-message speak button) to know when
 * playback has ended on its own, without changing `speakText`'s signature.
 * Returns false when unsupported.
 */
export function isSpeaking(): boolean {
  const s = synth();
  return !!s?.speaking;
}

/**
 * Cancel any in-progress or queued utterance.
 * Always safe to call, even when speech synthesis is unsupported.
 */
export function stopSpeaking(): void {
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    // ignore — best-effort
  }
}

/**
 * Speak `text` aloud, canceling any utterance already in progress first
 * (only one reply should ever be audible at a time). No-op when
 * `SpeechSynthesis` is unavailable or `text` is empty/whitespace — never
 * throws into the caller (button click handler / turn-complete hook).
 */
export function speakText(text: string, opts?: SpeakOptions): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const s = synth();
  const Utterance = utteranceCtor();
  if (!s || !Utterance) return;
  try {
    // Cancel whatever is currently speaking/queued before starting anew.
    s.cancel();
    const utter = new Utterance(trimmed);
    if (opts?.rate) utter.rate = opts.rate;
    if (opts?.voiceName) {
      const voice = s
        .getVoices()
        .find((v) => v.name === opts.voiceName);
      if (voice) utter.voice = voice;
    }
    s.speak(utter);
  } catch {
    // ignore — best-effort
  }
}

/**
 * Strip common Markdown syntax down to speakable plain text.
 *
 * There is no existing "plain text from a message" helper for assistant
 * replies in this codebase (the copy-to-clipboard action copies raw
 * Markdown as-is; `draftDoc.ts#plainTextOf` only handles the composer's
 * skill-chip segments in *user* messages). Assistant replies are rendered
 * Markdown, so speaking them verbatim would read out `**`, `#`, backticks,
 * link syntax, etc. — this trims the most common cases before handing text
 * to `speakText`.
 */
export function stripMarkdownForSpeech(text: string): string {
  return text
    // Fenced code blocks — drop entirely, code reads poorly as speech.
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Images ![alt](url) — keep alt text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Links [text](url) — keep link text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Headings
    .replace(/^#{1,6}\s+/gm, "")
    // Bold / italic / strikethrough markers
    .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // Blockquote / list markers at line start
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Horizontal rules
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, " ")
    .trim();
}
