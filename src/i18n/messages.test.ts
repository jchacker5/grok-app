import { describe, expect, it } from "vitest";
import { createT, messages, t, type MessageKey } from "./index";

describe("i18n catalog", () => {
  it("interpolates variables", () => {
    expect(t("en", "project.trustFirst", { name: "Demo" })).toContain("Demo");
  });

  it("createT binds locale (English is the product default)", () => {
    const tr = createT("en");
    expect(tr("sidebar.settings")).toBe("Settings");
  });

  it("every value is a non-empty string", () => {
    for (const [k, v] of Object.entries(messages.en)) {
      expect(v.trim().length, `en.${k}`).toBeGreaterThan(0);
    }
  });

  it("type surface accepts known keys only", () => {
    const key: MessageKey = "composer.send";
    expect(t("en", key)).toBeTruthy();
  });
});
