/**
 * User custom CSS injection. Applies raw CSS text into a dedicated
 * `<style>` element in `document.head` via `.textContent` only — never
 * `.innerHTML` — so this is always treated as inert CSS text, never parsed
 * as HTML or executed as script.
 */

export const CUSTOM_CSS_ELEMENT_ID = "user-custom-css";

/**
 * Create/update/remove the injected custom-CSS `<style>` element.
 * Empty/whitespace-only `css` removes the element instead of leaving an
 * empty one behind.
 */
export function applyCustomCss(css: string, doc: Document = document): void {
  const existing = doc.getElementById(
    CUSTOM_CSS_ELEMENT_ID,
  ) as HTMLStyleElement | null;

  if (!css || !css.trim()) {
    existing?.remove();
    return;
  }

  const el = existing ?? doc.createElement("style");
  el.id = CUSTOM_CSS_ELEMENT_ID;
  el.textContent = css;
  if (!existing) {
    doc.head.appendChild(el);
  }
}
