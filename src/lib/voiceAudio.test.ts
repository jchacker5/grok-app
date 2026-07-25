import { describe, expect, it } from "vitest";
import { arrayBufferToBase64, floatTo16BitPCM, rmsFloat32 } from "./voiceAudio";

describe("voiceAudio", () => {
  it("encodes silence to PCM base64", () => {
    const samples = new Float32Array(16);
    const pcm = floatTo16BitPCM(samples);
    expect(pcm.byteLength).toBe(32);
    const b64 = arrayBufferToBase64(pcm);
    expect(b64.length).toBeGreaterThan(0);
    expect(atob(b64).length).toBe(32);
  });

  it("clamps float samples", () => {
    const samples = new Float32Array([2, -2, 0.5]);
    const view = new DataView(floatTo16BitPCM(samples));
    expect(view.getInt16(0, true)).toBe(0x7fff);
    expect(view.getInt16(2, true)).toBe(-0x8000);
  });
});

describe("rmsFloat32", () => {
  it("is 0 for silence", () => {
    expect(rmsFloat32(new Float32Array(32))).toBe(0);
  });

  it("is 0 for an empty buffer", () => {
    expect(rmsFloat32(new Float32Array(0))).toBe(0);
  });

  it("is 1 for a full-scale square wave", () => {
    expect(rmsFloat32(new Float32Array([1, -1, 1, -1]))).toBe(1);
  });

  it("computes the expected RMS for a mixed case", () => {
    // rms([0, 1, 0, -1]) = sqrt((0+1+0+1)/4) = sqrt(0.5)
    expect(rmsFloat32(new Float32Array([0, 1, 0, -1]))).toBeCloseTo(
      Math.sqrt(0.5),
      6,
    );
  });

  it("clamps out-of-range input to 1", () => {
    expect(rmsFloat32(new Float32Array([5, -5]))).toBe(1);
  });
});
