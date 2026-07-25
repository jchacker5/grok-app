/**
 * Plain-text summary for an element picked in the resource pane's embedded
 * browser (Live Preview Panel v2, Stage 2). Saved as a small `.txt`
 * attachment via the existing saveTempAttachment → mergeAttachments
 * pipeline — no new attachment data model needed.
 */

export interface PickedElementLike {
  selector: string;
  outerHtmlSnippet: string;
  rect: { x: number; y: number; width: number; height: number };
}

export function buildElementPickSummary(
  info: PickedElementLike,
  sourceUrl: string,
): string {
  const lines = [
    `Element picked from ${sourceUrl || "(unknown page)"}`,
    `Selector: ${info.selector || "(none)"}`,
    `Rect: x=${Math.round(info.rect.x)} y=${Math.round(info.rect.y)} width=${Math.round(info.rect.width)} height=${Math.round(info.rect.height)}`,
    "",
    "outerHTML (truncated):",
    info.outerHtmlSnippet,
  ];
  return lines.join("\n");
}
