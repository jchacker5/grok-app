import { describe, expect, it } from "vitest";
import {
  formatElapsedMs,
  pickSupportedMimeType,
  RECORDING_MIME_CANDIDATES,
} from "./recordingFormat";

describe("formatElapsedMs", () => {
  it("formats sub-minute durations", () => {
    expect(formatElapsedMs(0)).toBe("0:00");
    expect(formatElapsedMs(5_000)).toBe("0:05");
    expect(formatElapsedMs(59_000)).toBe("0:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsedMs(65_000)).toBe("1:05");
    expect(formatElapsedMs(179_000)).toBe("2:59");
  });

  it("clamps negative durations to 0:00", () => {
    expect(formatElapsedMs(-500)).toBe("0:00");
  });

  it("floors partial seconds", () => {
    expect(formatElapsedMs(1_999)).toBe("0:01");
  });
});

describe("pickSupportedMimeType", () => {
  it("picks the first supported candidate", () => {
    const supported = new Set(["video/webm;codecs=vp8", "video/webm"]);
    const mime = pickSupportedMimeType(RECORDING_MIME_CANDIDATES, (m) => supported.has(m));
    expect(mime).toBe("video/webm;codecs=vp8");
  });

  it("falls back to the last candidate when nothing reports support", () => {
    const mime = pickSupportedMimeType(RECORDING_MIME_CANDIDATES, () => false);
    expect(mime).toBe("video/webm");
  });

  it("returns a safe default for an empty candidate list", () => {
    expect(pickSupportedMimeType([], () => false)).toBe("video/webm");
  });
});
