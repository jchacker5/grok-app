import { describe, expect, it } from "vitest";
import { buildElementPickSummary } from "./elementPickSummary";

describe("buildElementPickSummary", () => {
  it("includes url, selector, rounded rect, and outerHTML", () => {
    const text = buildElementPickSummary(
      {
        selector: "div#app > button.btn:nth-of-type(2)",
        outerHtmlSnippet: '<button class="btn">Go</button>',
        rect: { x: 10.4, y: 20.6, width: 100.2, height: 32.9 },
      },
      "https://example.com/page",
    );
    expect(text).toContain("https://example.com/page");
    expect(text).toContain("div#app > button.btn:nth-of-type(2)");
    expect(text).toContain("x=10 y=21 width=100 height=33");
    expect(text).toContain('<button class="btn">Go</button>');
  });

  it("falls back to placeholders when selector/url are empty", () => {
    const text = buildElementPickSummary(
      { selector: "", outerHtmlSnippet: "<div></div>", rect: { x: 0, y: 0, width: 0, height: 0 } },
      "",
    );
    expect(text).toContain("(unknown page)");
    expect(text).toContain("(none)");
  });
});
