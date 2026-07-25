## Summary
Add "Export as Image" for conversations — renders a selected portion of the session (or the whole session) as a PNG image suitable for sharing on social media. Uses `html-to-image` (or `dom-to-image`) to capture a styled message list as a canvas, then downloads as PNG.

## Current State

**`src/App.tsx`** — message list rendered as `<div class="messages">` with user/assistant bubbles. Styled with CSS.

**`src/components/MarkdownBody.tsx`** — renders message content as HTML.

**No image export** exists.

## Steps

1. **`package.json`**: Add `html-to-image`:
   ```bash
   npm install html-to-image
   ```
   (2KB gzipped, uses `dom-to-image` approach with `foreignObject` for SVG rendering.)

2. **`src/components/ExportAsImageModal.tsx`** (new):
   - "Select messages to export": checkboxes next to each message, or "All", or "From message X to message Y".
   - Style preview: dropdown of image styles (light, dark, sepia, tweet-style).
   - "Include metadata" toggle: show/hide model name, timestamp, session title in header.
   - "Export" button.
   - Preview area: shows a miniature preview of the rendered image.

3. **`src/lib/imageExport.ts`** (new):
   ```tsx
   export async function exportMessagesAsImage(
     element: HTMLElement,
     options?: { backgroundColor?: string; width?: number; padding?: number }
   ): Promise<Blob> {
     const dataUrl = await toPng(element, {
       backgroundColor: options?.backgroundColor || '#1a1a2e',
       width: options?.width || 800,
       pixelRatio: 2,  // Retina quality
       style: { padding: `${options?.padding || 24}px`, borderRadius: '12px' },
     });
     const res = await fetch(dataUrl);
     return res.blob();
   }
   ```

4. **`src/App.tsx`**: Add "Export as Image" option in the session context menu (three-dot menu). Click → opens `<ExportAsImageModal>`. The modal renders a hidden clone of the selected messages inside a container div, then uses `exportMessagesAsImage` to capture it.

5. **`src/styles/components/ExportImage.css`** (new): Style the export preview:
   - `.export-preview` — the clone container (hidden from main view, visible only in modal).
   - `.export-preview .message` — styled for image (clean background, proper spacing).
   - `.export-preview .message--user` — right-aligned blue bubble.
   - `.export-preview .message--assistant` — left-aligned gray bubble.
   - Export-specific CSS that differs from the main chat (no scrollbars, fixed width, branded header).

6. **`src/i18n/messages.ts`**: Add `ExportImage` section with keys: `title`, `select_messages`, `style_light`, `style_dark`, `style_tweet`, `include_metadata`, `exporting`, `export_success`, `no_messages_selected`, `select_all`, `deselect_all`.

## Verification Gates

- [ ] "Export as Image" option in session menu
- [ ] Modal shows message list with checkboxes
- [ ] "Select all" / range selection works
- [ ] Export generates a PNG file download
- [ ] Image renders correctly (no cut-off text, proper colors)
- [ ] Dark and light style options work
- [ ] Metadata header shown when toggled
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** export more than 50 messages at once (to avoid canvas size limits). Warn if selection exceeds.
- Do **not** include code blocks that are too wide — use `overflow-wrap: break-word` in the export preview.
- If `html-to-image` fails (CORS issues with images in markdown), show an error and offer to export without images.
- Image width: fixed at 800px (Twitter-optimal). Height: auto, max 8000px (canvas limit on some browsers).
- Do **not** include system messages or internal state.

## Dependencies
- None
