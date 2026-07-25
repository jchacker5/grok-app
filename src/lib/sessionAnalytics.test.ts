import { describe, expect, it } from "vitest";
import {
  compareToAverage,
  computeSessionAnalytics,
} from "./sessionAnalytics";
import type { CallLogEntry, HeatmapDay } from "./api";

function log(partial: Partial<CallLogEntry>): CallLogEntry {
  return {
    id: "s1",
    title: "session",
    model: "grok-4",
    projectPath: null,
    startedAt: null,
    durationSecs: null,
    turns: 0,
    toolCalls: 0,
    contextTokens: 0,
    errors: 0,
    ...partial,
  };
}

function day(partial: Partial<HeatmapDay>): HeatmapDay {
  return { date: "2026-01-01", requests: 0, tokens: 0, costUsd: 0, ...partial };
}

describe("computeSessionAnalytics", () => {
  it("returns zeroed stats for no sessions", () => {
    const stats = computeSessionAnalytics([], []);
    expect(stats.totalSessions).toBe(0);
    expect(stats.byModel).toEqual([]);
    expect(stats.avgDurationSecs).toBeNull();
  });

  it("aggregates totals, model breakdown, and top sessions", () => {
    const logs = [
      log({ id: "a", model: "grok-4", turns: 3, toolCalls: 1, contextTokens: 1000, durationSecs: 60 }),
      log({ id: "b", model: "grok-4", turns: 5, toolCalls: 2, contextTokens: 5000, durationSecs: 120 }),
      log({ id: "c", model: "grok-code", turns: 2, toolCalls: 0, contextTokens: 200, errors: 1 }),
    ];
    const stats = computeSessionAnalytics(logs, []);
    expect(stats.totalSessions).toBe(3);
    expect(stats.totalTurns).toBe(10);
    expect(stats.totalToolCalls).toBe(3);
    expect(stats.totalContextTokens).toBe(6200);
    expect(stats.totalErrors).toBe(1);
    expect(stats.avgDurationSecs).toBe(90);

    expect(stats.byModel).toEqual([
      { model: "grok-4", sessions: 2, tokens: 6000 },
      { model: "grok-code", sessions: 1, tokens: 200 },
    ]);

    expect(stats.topSessions.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("falls back to a placeholder for missing model names", () => {
    const stats = computeSessionAnalytics([log({ model: null })], []);
    expect(stats.byModel[0]?.model).toBe("—");
  });

  it("slices the trailing N days of heatmap for daily activity", () => {
    const heatmap = Array.from({ length: 30 }, (_, i) =>
      day({ date: `d${i}`, requests: i, tokens: i * 10 }),
    );
    const stats = computeSessionAnalytics([log({})], heatmap, 7);
    expect(stats.dailyActivity).toHaveLength(7);
    expect(stats.dailyActivity[0]?.date).toBe("d23");
    expect(stats.dailyActivity[6]?.date).toBe("d29");
  });
});

describe("compareToAverage", () => {
  it("reports above/below/even trends", () => {
    expect(compareToAverage(120, 100).trend).toBe("above");
    expect(compareToAverage(80, 100).trend).toBe("below");
    expect(compareToAverage(100, 100).trend).toBe("even");
    expect(compareToAverage(50, 0).trend).toBe("even");
  });

  it("computes delta percent", () => {
    const { deltaPercent } = compareToAverage(150, 100);
    expect(deltaPercent).toBeCloseTo(50, 5);
  });
});
