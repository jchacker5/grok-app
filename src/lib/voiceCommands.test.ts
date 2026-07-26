import { describe, expect, it } from "vitest";
import { matchVoiceCommand } from "./voiceCommands";

describe("matchVoiceCommand — exact phrase matches", () => {
  it("matches 'send message'", () => {
    expect(matchVoiceCommand("send message")).toEqual({
      command: "send",
      remainder: "",
    });
  });

  it("matches 'send it'", () => {
    expect(matchVoiceCommand("send it")).toEqual({
      command: "send",
      remainder: "",
    });
  });

  it("matches 'new session'", () => {
    expect(matchVoiceCommand("new session")).toEqual({
      command: "newSession",
      remainder: "",
    });
  });

  it("matches 'new chat'", () => {
    expect(matchVoiceCommand("new chat")).toEqual({
      command: "newSession",
      remainder: "",
    });
  });

  it("matches 'stop dictation'", () => {
    expect(matchVoiceCommand("stop dictation")).toEqual({
      command: "stopDictation",
      remainder: "",
    });
  });
});

describe("matchVoiceCommand — case-insensitivity", () => {
  it("matches uppercase transcript", () => {
    expect(matchVoiceCommand("SEND IT")).toEqual({
      command: "send",
      remainder: "",
    });
  });

  it("matches mixed-case transcript", () => {
    expect(matchVoiceCommand("New Session")).toEqual({
      command: "newSession",
      remainder: "",
    });
    expect(matchVoiceCommand("Stop Dictation")).toEqual({
      command: "stopDictation",
      remainder: "",
    });
  });
});

describe("matchVoiceCommand — trailing punctuation tolerance", () => {
  it("tolerates a trailing period", () => {
    expect(matchVoiceCommand("send it.")).toEqual({
      command: "send",
      remainder: "",
    });
  });

  it("tolerates a trailing exclamation mark", () => {
    expect(matchVoiceCommand("new session!")).toEqual({
      command: "newSession",
      remainder: "",
    });
  });

  it("tolerates a trailing question mark", () => {
    expect(matchVoiceCommand("stop dictation?")).toEqual({
      command: "stopDictation",
      remainder: "",
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(matchVoiceCommand("   send message   ")).toEqual({
      command: "send",
      remainder: "",
    });
  });

  it("tolerates trailing ellipsis", () => {
    expect(matchVoiceCommand("send it...")).toEqual({
      command: "send",
      remainder: "",
    });
  });
});

describe("matchVoiceCommand — false-positive avoidance (mid-sentence)", () => {
  it("does not match when the phrase is embedded in a longer sentence", () => {
    expect(matchVoiceCommand("please send it to accounting tomorrow")).toBeNull();
  });

  it("does not match when a trigger phrase is a substring of ordinary dictation", () => {
    expect(matchVoiceCommand("I started a new session yesterday")).toBeNull();
  });

  it("does not match trailing extra words after the phrase", () => {
    expect(matchVoiceCommand("send it now")).toBeNull();
  });

  it("does not match leading extra words before the phrase", () => {
    expect(matchVoiceCommand("okay new chat")).toBeNull();
  });

  it("does not match unrelated dictation", () => {
    expect(matchVoiceCommand("the weather is nice today")).toBeNull();
  });
});

describe("matchVoiceCommand — empty/whitespace input", () => {
  it("returns null for an empty string", () => {
    expect(matchVoiceCommand("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(matchVoiceCommand("   ")).toBeNull();
  });

  it("returns null for punctuation-only input", () => {
    expect(matchVoiceCommand("...")).toBeNull();
  });
});
