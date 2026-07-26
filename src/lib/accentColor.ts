/**
 * Custom accent color skin: derives the same three CSS vars every theme
 * defines (`--accent`, `--accent-muted`, `--accent-hover`) from one hex
 * color so overriding a single value stays visually coherent (tinted
 * low-opacity fill + a hover shade), instead of one flat color with no
 * matching states.
 */

export interface AccentVars {
  accent: string;
  accentMuted: string;
  accentHover: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function isValidAccentColor(hex: string): boolean {
  return hexToRgb(hex) !== null;
}

/** Null for anything that isn't a strict `#rrggbb` hex color. */
export function deriveAccentVars(hex: string): AccentVars | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const lighten = (c: number) => Math.round(c + (255 - c) * 0.12);
  return {
    accent: `#${hex.trim().replace(/^#/, "").toLowerCase()}`,
    accentMuted: `rgba(${r}, ${g}, ${b}, 0.14)`,
    accentHover: `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`,
  };
}
