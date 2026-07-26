import { describe, expect, it } from "vitest";
import { applyCustomCss, CUSTOM_CSS_ELEMENT_ID } from "./customCss";

/**
 * Minimal hand-rolled DOM fake (no jsdom dependency in this repo) — mirrors
 * the fake-DOM pattern used by `a11yFocus.test.ts`. Only implements the
 * surface `applyCustomCss` actually touches: `getElementById`,
 * `createElement`, and `head.appendChild`.
 */
type FakeStyleEl = {
  id: string;
  tagName: string;
  textContent: string | null;
  innerHTML?: string;
  parentElement: unknown;
  remove: () => void;
};

function fakeDocument() {
  const byId = new Map<string, FakeStyleEl>();
  const head = {
    appendChild: (el: FakeStyleEl) => {
      byId.set(el.id, el);
      el.parentElement = head;
    },
  };
  const doc = {
    head,
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string): FakeStyleEl => ({
      id: "",
      tagName: tag.toUpperCase(),
      textContent: null,
      parentElement: null,
      remove() {
        byId.delete(this.id);
      },
    }),
    querySelectorAll: (sel: string) => {
      const id = sel.replace(/^#/, "");
      const hit = byId.get(id);
      return hit ? [hit] : [];
    },
  };
  return { doc: doc as unknown as Document, byId };
}

describe("applyCustomCss", () => {
  it("creates the style element with the given CSS text", () => {
    const { doc, byId } = fakeDocument();
    applyCustomCss("body { color: red; }", doc);
    const el = byId.get(CUSTOM_CSS_ELEMENT_ID);
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe("STYLE");
    expect(el?.textContent).toBe("body { color: red; }");
    expect(el?.parentElement).toBeTruthy();
  });

  it("removes the element when css is empty", () => {
    const { doc, byId } = fakeDocument();
    applyCustomCss("body { color: red; }", doc);
    expect(byId.has(CUSTOM_CSS_ELEMENT_ID)).toBe(true);
    applyCustomCss("", doc);
    expect(byId.has(CUSTOM_CSS_ELEMENT_ID)).toBe(false);
  });

  it("removes the element when css is whitespace-only", () => {
    const { doc, byId } = fakeDocument();
    applyCustomCss("body { color: red; }", doc);
    applyCustomCss("   \n\t  ", doc);
    expect(byId.has(CUSTOM_CSS_ELEMENT_ID)).toBe(false);
  });

  it("is a no-op removal when nothing was ever applied", () => {
    const { doc, byId } = fakeDocument();
    expect(() => applyCustomCss("", doc)).not.toThrow();
    expect(byId.has(CUSTOM_CSS_ELEMENT_ID)).toBe(false);
  });

  it("updates an existing element in place rather than duplicating it", () => {
    const { doc, byId } = fakeDocument();
    applyCustomCss("body { color: red; }", doc);
    applyCustomCss("body { color: blue; }", doc);
    expect(byId.size).toBe(1);
    expect(byId.get(CUSTOM_CSS_ELEMENT_ID)?.textContent).toBe(
      "body { color: blue; }",
    );
  });

  it("never sets innerHTML — only textContent, so css text is never parsed as markup", () => {
    const { doc, byId } = fakeDocument();
    applyCustomCss("</style><script>window.__pwned = true;</script>", doc);
    const el = byId.get(CUSTOM_CSS_ELEMENT_ID);
    expect(el?.textContent).toBe(
      "</style><script>window.__pwned = true;</script>",
    );
    expect(el?.innerHTML).toBeUndefined();
  });
});
