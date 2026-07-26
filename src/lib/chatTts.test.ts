import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSpeaking,
  speakText,
  speechSupported,
  stopSpeaking,
  stripMarkdownForSpeech,
} from "./chatTts";

// jsdom/happy-dom do not implement SpeechSynthesis — install a minimal mock
// on `window` for each test, mirroring desktopNotify.test.ts's convention of
// stubbing the global browser API surface directly.
const originalSpeechSynthesis = (
  globalThis as { speechSynthesis?: unknown }
).speechSynthesis;
const originalUtterance = (
  globalThis as { SpeechSynthesisUtterance?: unknown }
).SpeechSynthesisUtterance;

function installMockSpeechSynthesis(speaking = false) {
  const cancel = vi.fn();
  const speak = vi.fn();
  const getVoices = vi.fn().mockReturnValue([
    { name: "Ara" },
    { name: "Eve" },
  ]);
  const mockSynth = { cancel, speak, getVoices, speaking };
  (globalThis as { speechSynthesis?: unknown }).speechSynthesis = mockSynth;

  class MockUtterance {
    text: string;
    rate = 1;
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  (
    globalThis as { SpeechSynthesisUtterance?: unknown }
  ).SpeechSynthesisUtterance = MockUtterance;

  return { cancel, speak, getVoices, MockUtterance };
}

afterEach(() => {
  if (originalSpeechSynthesis) {
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis =
      originalSpeechSynthesis;
  } else {
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
  }
  if (originalUtterance) {
    (
      globalThis as { SpeechSynthesisUtterance?: unknown }
    ).SpeechSynthesisUtterance = originalUtterance;
  } else {
    delete (globalThis as { SpeechSynthesisUtterance?: unknown })
      .SpeechSynthesisUtterance;
  }
  vi.restoreAllMocks();
});

describe("chatTts (unsupported environment)", () => {
  beforeEach(() => {
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
    delete (globalThis as { SpeechSynthesisUtterance?: unknown })
      .SpeechSynthesisUtterance;
  });

  it("reports unsupported when SpeechSynthesis is missing", () => {
    expect(speechSupported()).toBe(false);
  });

  it("speakText is a safe no-op when unsupported", () => {
    expect(() => speakText("hello there")).not.toThrow();
  });

  it("stopSpeaking is a safe no-op when unsupported", () => {
    expect(() => stopSpeaking()).not.toThrow();
  });

  it("isSpeaking reports false when unsupported", () => {
    expect(isSpeaking()).toBe(false);
  });
});

describe("chatTts (mocked SpeechSynthesis)", () => {
  it("reports supported when both globals are present", () => {
    installMockSpeechSynthesis();
    expect(speechSupported()).toBe(true);
  });

  it("does nothing for empty/whitespace text", () => {
    const { speak, cancel } = installMockSpeechSynthesis();
    speakText("   ");
    expect(speak).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels any in-progress utterance before speaking a new one", () => {
    const { speak, cancel } = installMockSpeechSynthesis();
    speakText("First reply");
    expect(cancel).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
  });

  it("applies rate option to the utterance", () => {
    const { speak } = installMockSpeechSynthesis();
    speakText("Hello", { rate: 1.5 });
    const utter = speak.mock.calls[0][0] as { rate: number; text: string };
    expect(utter.rate).toBe(1.5);
    expect(utter.text).toBe("Hello");
  });

  it("resolves voiceName against available voices when found", () => {
    const { speak } = installMockSpeechSynthesis();
    speakText("Hello", { voiceName: "Eve" });
    const utter = speak.mock.calls[0][0] as { voice: { name: string } | null };
    expect(utter.voice).toEqual({ name: "Eve" });
  });

  it("leaves voice unset when voiceName does not match any available voice", () => {
    const { speak } = installMockSpeechSynthesis();
    speakText("Hello", { voiceName: "Nonexistent" });
    const utter = speak.mock.calls[0][0] as { voice: unknown };
    expect(utter.voice).toBeNull();
  });

  it("stopSpeaking cancels via the synthesis instance", () => {
    const { cancel } = installMockSpeechSynthesis();
    stopSpeaking();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("isSpeaking reflects the synthesis instance's speaking flag", () => {
    installMockSpeechSynthesis(true);
    expect(isSpeaking()).toBe(true);
  });

  it("isSpeaking is false when nothing is queued", () => {
    installMockSpeechSynthesis(false);
    expect(isSpeaking()).toBe(false);
  });

  it("swallows errors thrown by speak() without propagating", () => {
    const { speak } = installMockSpeechSynthesis();
    speak.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => speakText("Hello")).not.toThrow();
  });
});

describe("stripMarkdownForSpeech", () => {
  it("strips bold/italic/strikethrough markers", () => {
    expect(stripMarkdownForSpeech("**bold** and *italic* and ~~gone~~")).toBe(
      "bold and italic and gone",
    );
  });

  it("strips headings", () => {
    expect(stripMarkdownForSpeech("## Section title")).toBe("Section title");
  });

  it("strips inline code and fenced code blocks", () => {
    expect(stripMarkdownForSpeech("Run `ls -la` please")).toBe(
      "Run ls -la please",
    );
    expect(
      stripMarkdownForSpeech("Before\n```js\nconst x = 1;\n```\nAfter").trim(),
    ).toBe("Before\n \nAfter".trim());
  });

  it("keeps link text, drops the URL", () => {
    expect(
      stripMarkdownForSpeech("See [the docs](https://example.com) for more"),
    ).toBe("See the docs for more");
  });

  it("strips list and blockquote markers", () => {
    expect(stripMarkdownForSpeech("- item one\n- item two")).toBe(
      "item one\nitem two",
    );
    expect(stripMarkdownForSpeech("> quoted text")).toBe("quoted text");
  });
});
