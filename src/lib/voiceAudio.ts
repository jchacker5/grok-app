/** Mic capture + PCM helpers for live voice and dictation. */

import { WORKLET_CODE } from './voice-processor';

/** Convert Float32 mono samples to 16-bit little-endian PCM. */
export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  return arrayBufferToBase64(buf);
}

/** Root-mean-square amplitude of a Float32 PCM buffer, normalized to ~0..1. */
export function rmsFloat32(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    sumSquares += s * s;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.max(0, Math.min(1, rms));
}

/**
 * Apply automatic gain control: normalize peak to targetPeak (0..1).
 * Preserves silence below noise floor.
 */
export function normalizeAudio(samples: Float32Array, targetPeak = 0.7): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]!);
    if (abs > peak) peak = abs;
  }
  if (peak < 0.01 || peak >= targetPeak) return samples;
  const gain = targetPeak / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i]! * gain));
  }
  return out;
}

/**
 * Capture mic as 16 kHz mono PCM chunks via AudioWorklet.
 * Falls back to ScriptProcessor if AudioWorklet is unavailable.
 */
export async function startPcmCaptureWorklet(
  onChunk: (pcmBase64: string) => void,
  sampleRate = 16000,
  onLevel?: (rms: number) => void,
  options?: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    sensitivity?: number;
    deviceId?: string;
  },
): Promise<{ stop: () => void; stream: MediaStream }> {
  const audioConstraints: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: options?.echoCancellation ?? true,
    noiseSuppression: options?.noiseSuppression ?? true,
  };
  if (options?.deviceId) {
    audioConstraints.deviceId = options.deviceId;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  });

  const ctx = new AudioContext({ sampleRate });
  const source = ctx.createMediaStreamSource(stream);

  // Try AudioWorklet first, fall back to ScriptProcessor
  try {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const worklet = new AudioWorkletNode(ctx, 'pcm-capture-processor');
    const sensitivity = options?.sensitivity ?? 0.5;
    const threshold = 0.05 + (1 - sensitivity) * 0.3;

    worklet.port.onmessage = (ev) => {
      const samples = new Float32Array(ev.data);
      const level = rmsFloat32(samples);
      onLevel?.(level);

      // Apply noise gate based on sensitivity
      if (level < threshold) return;

      // Normalize audio for consistent volume
      const normalized = normalizeAudio(samples, 0.7);

      // Resample if needed
      const ratio = ctx.sampleRate / sampleRate;
      if (ratio <= 1.01 && ratio >= 0.99) {
        onChunk(arrayBufferToBase64(floatTo16BitPCM(normalized)));
      } else {
        const outLen = Math.floor(normalized.length / ratio);
        const out = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          out[i] = normalized[Math.floor(i * ratio)] ?? 0;
        }
        onChunk(arrayBufferToBase64(floatTo16BitPCM(out)));
      }
    };

    source.connect(worklet);
    worklet.connect(ctx.destination);

    return {
      stream,
      stop: () => {
        try {
          worklet.disconnect();
          source.disconnect();
          void ctx.close();
          stream.getTracks().forEach((t) => t.stop());
        } catch { /* ignore */ }
      },
    };
  } catch {
    // Fall back to ScriptProcessor if AudioWorklet fails
    return startPcmCaptureScriptProcessor(onChunk, sampleRate, onLevel, options);
  }
}

/**
 * Capture mic as 16 kHz mono PCM chunks (≈100ms) via ScriptProcessor.
 * Provided as a fallback when AudioWorklet is unavailable.
 */
export async function startPcmCaptureScriptProcessor(
  onChunk: (pcmBase64: string) => void,
  sampleRate = 16000,
  onLevel?: (rms: number) => void,
  options?: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    sensitivity?: number;
    deviceId?: string;
  },
): Promise<{ stop: () => void; stream: MediaStream }> {
  const audioConstraints: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: options?.echoCancellation ?? true,
    noiseSuppression: options?.noiseSuppression ?? true,
  };
  if (options?.deviceId) {
    audioConstraints.deviceId = options.deviceId;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  });
  const ctx = new AudioContext({ sampleRate });
  const source = ctx.createMediaStreamSource(stream);
  const bufferSize = 2048;
  const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    const level = rmsFloat32(input);
    onLevel?.(level);

    // Apply noise gate based on sensitivity
    const sensitivity = options?.sensitivity ?? 0.5;
    const threshold = 0.05 + (1 - sensitivity) * 0.3;
    if (level < threshold) return;

    // Normalize audio for consistent volume
    const normalized = normalizeAudio(input, 0.7);

    // Resample if needed (simple decimate when ctx.sampleRate != target).
    const ratio = ctx.sampleRate / sampleRate;
    if (ratio <= 1.01 && ratio >= 0.99) {
      onChunk(arrayBufferToBase64(floatTo16BitPCM(normalized)));
      return;
    }
    const outLen = Math.floor(normalized.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = normalized[Math.floor(i * ratio)] ?? 0;
    }
    onChunk(arrayBufferToBase64(floatTo16BitPCM(out)));
  };
  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    stream,
    stop: () => {
      try {
        processor.disconnect();
        source.disconnect();
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    },
  };
}

/** Capture mic, preferring AudioWorklet with ScriptProcessor fallback. */
export async function startPcmCapture(
  onChunk: (pcmBase64: string) => void,
  sampleRate = 16000,
  onLevel?: (rms: number) => void,
  options?: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    sensitivity?: number;
    deviceId?: string;
  },
): Promise<{ stop: () => void; stream: MediaStream }> {
  try {
    return await startPcmCaptureWorklet(onChunk, sampleRate, onLevel, options);
  } catch {
    return startPcmCaptureScriptProcessor(onChunk, sampleRate, onLevel);
  }
}

/** Play base64 PCM16 mono at 24k (or 16k) — best-effort for voice deltas. */
export async function playPcm16Base64(
  b64: string,
  sampleRate = 24000,
  onLevel?: (rms: number) => void,
  playbackRate = 1.0,
): Promise<void> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const samples = new Float32Array(bytes.length / 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  onLevel?.(rmsFloat32(samples));
  const ctx = new AudioContext({ sampleRate });
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = playbackRate;
  src.connect(ctx.destination);
  src.start();
  await new Promise<void>((resolve) => {
    src.onended = () => {
      void ctx.close();
      resolve();
    };
  });
}
