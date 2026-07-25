/** Render a chat transcript snippet to a shareable PNG (social export). */

import { toBlob } from "html-to-image";

/** Hard cap — keeps canvas size sane and matches plan boundary. */
export const MAX_EXPORT_IMAGE_MESSAGES = 50;

/** Twitter-optimal fixed width; height is whatever the content needs. */
export const EXPORT_IMAGE_WIDTH = 800;

export type ExportImageStyle = "light" | "dark";

export const EXPORT_IMAGE_BACKGROUNDS: Record<ExportImageStyle, string> = {
  light: "#f5f5f7",
  dark: "#15151a",
};

/**
 * Rasterize a DOM node (the hidden export-preview clone) to a PNG blob.
 * Retina (2x) pixel ratio; fixed width per plan spec.
 */
export async function exportNodeAsImage(
  node: HTMLElement,
  options?: { backgroundColor?: string; width?: number; pixelRatio?: number },
): Promise<Blob> {
  const blob = await toBlob(node, {
    backgroundColor: options?.backgroundColor ?? EXPORT_IMAGE_BACKGROUNDS.dark,
    width: options?.width ?? EXPORT_IMAGE_WIDTH,
    pixelRatio: options?.pixelRatio ?? 2,
    cacheBust: true,
    skipFonts: true,
  });
  if (!blob) throw new Error("image-export-empty");
  return blob;
}

/** Safe download filename for the exported PNG. */
export function imageExportFilename(
  title: string,
  sessionId?: string | null,
): string {
  const base = (title || "session")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const id = (sessionId || "").slice(0, 8);
  const name = base || "session";
  return id ? `grok-${name}-${id}.png` : `grok-${name}.png`;
}

/** Trigger a browser download of a blob (same pattern as markdown export). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
