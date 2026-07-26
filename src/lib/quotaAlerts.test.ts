import { describe, expect, it } from "vitest";
import {
  QUOTA_ALERT_STORAGE_KEY,
  QUOTA_ALERT_THRESHOLDS,
  baselineForPeriod,
  loadQuotaAlertState,
  resolveThresholdCrossed,
  saveQuotaAlertState,
  type QuotaAlertState,
} from "./quotaAlerts";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    getItem(key: string) {
      return key in data ? data[key]! : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
  } as Storage;
}

describe("resolveThresholdCrossed", () => {
  it("returns null when no threshold crossed", () => {
    expect(resolveThresholdCrossed(50, [...QUOTA_ALERT_THRESHOLDS], null)).toBeNull();
    expect(resolveThresholdCrossed(79, [...QUOTA_ALERT_THRESHOLDS], null)).toBeNull();
  });

  it("crosses 80 only", () => {
    expect(resolveThresholdCrossed(85, [...QUOTA_ALERT_THRESHOLDS], null)).toBe(80);
  });

  it("crosses straight to 95 (skips 80, returns highest crossed)", () => {
    expect(resolveThresholdCrossed(96, [...QUOTA_ALERT_THRESHOLDS], null)).toBe(95);
  });

  it("already alerted at 80, then crosses 95", () => {
    expect(resolveThresholdCrossed(97, [...QUOTA_ALERT_THRESHOLDS], 80)).toBe(95);
  });

  it("does not re-alert at 80 once already alerted at 80", () => {
    expect(resolveThresholdCrossed(85, [...QUOTA_ALERT_THRESHOLDS], 80)).toBeNull();
  });

  it("does not re-alert at 95 once already alerted at 95", () => {
    expect(resolveThresholdCrossed(99, [...QUOTA_ALERT_THRESHOLDS], 95)).toBeNull();
  });
});

describe("quota alert state storage roundtrip", () => {
  it("returns null when nothing stored", () => {
    const storage = memoryStorage();
    expect(loadQuotaAlertState(storage)).toBeNull();
  });

  it("saves and reloads state", () => {
    const storage = memoryStorage();
    saveQuotaAlertState(storage, "2026-07-01", 80);
    const loaded = loadQuotaAlertState(storage);
    expect(loaded).toEqual({ periodKey: "2026-07-01", highestAlerted: 80 });
    expect(storage.getItem(QUOTA_ALERT_STORAGE_KEY)).toBeTruthy();
  });

  it("returns null for malformed JSON", () => {
    const storage = memoryStorage({ [QUOTA_ALERT_STORAGE_KEY]: "not json" });
    expect(loadQuotaAlertState(storage)).toBeNull();
  });

  it("returns null for a well-formed but shape-invalid blob", () => {
    const storage = memoryStorage({
      [QUOTA_ALERT_STORAGE_KEY]: JSON.stringify({ foo: "bar" }),
    });
    expect(loadQuotaAlertState(storage)).toBeNull();
  });
});

describe("baselineForPeriod (period-key-change reset)", () => {
  it("returns the stored highestAlerted when period matches", () => {
    const stored: QuotaAlertState = { periodKey: "p1", highestAlerted: 80 };
    expect(baselineForPeriod(stored, "p1")).toBe(80);
  });

  it("resets to null when the period key has changed (new billing period)", () => {
    const stored: QuotaAlertState = { periodKey: "p1", highestAlerted: 95 };
    expect(baselineForPeriod(stored, "p2")).toBeNull();
  });

  it("returns null when nothing was stored", () => {
    expect(baselineForPeriod(null, "p1")).toBeNull();
  });

  it("full flow: alert at 80, new period resets, re-alerts at 80 again", () => {
    const storage = memoryStorage();
    // Period 1: cross 80.
    let stored = loadQuotaAlertState(storage);
    let baseline = baselineForPeriod(stored, "p1");
    let crossed = resolveThresholdCrossed(85, [...QUOTA_ALERT_THRESHOLDS], baseline);
    expect(crossed).toBe(80);
    saveQuotaAlertState(storage, "p1", crossed!);

    // Still period 1, usage stays at 85 — no re-alert.
    stored = loadQuotaAlertState(storage);
    baseline = baselineForPeriod(stored, "p1");
    crossed = resolveThresholdCrossed(85, [...QUOTA_ALERT_THRESHOLDS], baseline);
    expect(crossed).toBeNull();

    // New billing period starts, usage resets to 85 again — should re-alert.
    stored = loadQuotaAlertState(storage);
    baseline = baselineForPeriod(stored, "p2");
    crossed = resolveThresholdCrossed(85, [...QUOTA_ALERT_THRESHOLDS], baseline);
    expect(crossed).toBe(80);
  });
});
