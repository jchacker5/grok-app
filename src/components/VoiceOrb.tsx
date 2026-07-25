/**
 * Live-voice orb — a small Canvas2D glowing blob that reacts to speech
 * amplitude, replacing the earlier static waveform bars.
 *
 * Design lineage: inspired by the general shape of OpenAI's ChatGPT/Codex
 * voice-mode orb and open-source prior art (`react-ai-voice-visualizer`'s
 * `VoiceOrb`, `elevenlabs/ui`'s `Orb` — both MIT). Reimplemented standalone
 * here with no runtime dependency on either, using plain Canvas2D and an
 * inline pseudo-noise function instead of a simplex-noise library, to keep
 * this desktop app's WebView bundle light.
 */
import { useEffect, useRef } from "react";

export type VoiceOrbState = "idle" | "connecting" | "listening" | "speaking";

export interface VoiceOrbProps {
  state: VoiceOrbState;
  /** 0..1 amplitude driving the orb's pulse/distortion. */
  level: number;
  size?: number;
  className?: string;
}

const COLORS: Record<VoiceOrbState, { core: string; glow: string }> = {
  idle: { core: "#3a3f52", glow: "rgba(90, 100, 140, 0.25)" },
  connecting: { core: "#1a6bff", glow: "rgba(55, 148, 255, 0.3)" },
  listening: { core: "#3794ff", glow: "rgba(55, 148, 255, 0.4)" },
  speaking: { core: "#2563eb", glow: "rgba(55, 148, 255, 0.45)" },
};

/** Small sum-of-sines pseudo-noise — deterministic, no dependency needed. */
function noise(angle: number, t: number): number {
  return (
    Math.sin(angle * 3 + t * 1.3) * 0.5 +
    Math.sin(angle * 5 - t * 2.1) * 0.3 +
    Math.sin(angle * 7 + t * 0.7) * 0.2
  );
}

export function VoiceOrb({ state, level, size = 96, className = "" }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const s = stateRef.current;
      const level = Math.max(0, Math.min(1, levelRef.current));
      const colors = COLORS[s];
      const cx = size / 2;
      const cy = size / 2;
      const baseR = size * 0.28;
      // Idle breathes slowly on its own; listening/speaking react to `level`.
      const idleBreath = s === "idle" ? 0.06 * Math.sin(t * 1.1) : 0;
      const amp = s === "idle" ? 0.04 : 0.12 + level * 0.22;

      ctx.clearRect(0, 0, size, size);

      // Outer glow.
      const glowR = baseR * (1.6 + level * 0.5);
      const grad = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, glowR);
      grad.addColorStop(0, colors.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Distorted blob core.
      const steps = 48;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = baseR * (1 + idleBreath + amp * noise(angle, t));
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const coreGrad = ctx.createRadialGradient(
        cx - baseR * 0.3,
        cy - baseR * 0.3,
        0,
        cx,
        cy,
        baseR * 1.4,
      );
      coreGrad.addColorStop(0, colors.core);
      coreGrad.addColorStop(1, colors.glow);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={`voice-orb ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={state}
    />
  );
}
