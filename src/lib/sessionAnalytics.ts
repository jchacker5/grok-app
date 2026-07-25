/**
 * Session analytics — pure computations over the real local usage data
 * (`CallLogEntry[]` + `HeatmapDay[]`) already derived by `account.rs` /
 * `account_status`. No new token accounting is invented here; everything is
 * built on `turns` / `toolCalls` / `contextTokens` / `durationSecs` per
 * session and the daily `requests` / `tokens` heatmap aggregates.
 */

import type { CallLogEntry, HeatmapDay } from "./api";

export interface ModelBreakdownEntry {
  model: string;
  sessions: number;
  tokens: number;
}

export interface DailyActivityEntry {
  date: string;
  sessions: number;
  tokens: number;
}

export interface SessionAnalyticsStats {
  totalSessions: number;
  totalTurns: number;
  totalToolCalls: number;
  totalContextTokens: number;
  totalErrors: number;
  avgTurns: number;
  avgContextTokens: number;
  avgDurationSecs: number | null;
  byModel: ModelBreakdownEntry[];
  dailyActivity: DailyActivityEntry[];
  topSessions: CallLogEntry[];
}

const UNKNOWN_MODEL = "—";

function emptyStats(): SessionAnalyticsStats {
  return {
    totalSessions: 0,
    totalTurns: 0,
    totalToolCalls: 0,
    totalContextTokens: 0,
    totalErrors: 0,
    avgTurns: 0,
    avgContextTokens: 0,
    avgDurationSecs: null,
    byModel: [],
    dailyActivity: [],
    topSessions: [],
  };
}

/**
 * Aggregate the (already-loaded) recent call logs + heatmap into overview
 * stats. `dailyDays` controls how many trailing heatmap days are surfaced
 * for the "recent activity" bar chart (heatmap itself covers ~371 days).
 */
export function computeSessionAnalytics(
  callLogs: CallLogEntry[],
  heatmap: HeatmapDay[],
  dailyDays = 14,
): SessionAnalyticsStats {
  if (callLogs.length === 0) return emptyStats();

  let totalTurns = 0;
  let totalToolCalls = 0;
  let totalContextTokens = 0;
  let totalErrors = 0;
  let durationSum = 0;
  let durationCount = 0;
  const modelMap = new Map<string, ModelBreakdownEntry>();

  for (const entry of callLogs) {
    totalTurns += entry.turns;
    totalToolCalls += entry.toolCalls;
    totalContextTokens += entry.contextTokens;
    totalErrors += entry.errors;
    if (entry.durationSecs != null && entry.durationSecs > 0) {
      durationSum += entry.durationSecs;
      durationCount += 1;
    }
    const key = entry.model?.trim() || UNKNOWN_MODEL;
    const agg = modelMap.get(key) ?? { model: key, sessions: 0, tokens: 0 };
    agg.sessions += 1;
    agg.tokens += entry.contextTokens;
    modelMap.set(key, agg);
  }

  const byModel = [...modelMap.values()].sort((a, b) => b.sessions - a.sessions);

  const topSessions = [...callLogs]
    .sort((a, b) => b.contextTokens - a.contextTokens)
    .slice(0, 5);

  const dailyActivity: DailyActivityEntry[] = heatmap
    .slice(-Math.max(1, dailyDays))
    .map((d) => ({ date: d.date, sessions: d.requests, tokens: d.tokens }));

  return {
    totalSessions: callLogs.length,
    totalTurns,
    totalToolCalls,
    totalContextTokens,
    totalErrors,
    avgTurns: callLogs.length ? totalTurns / callLogs.length : 0,
    avgContextTokens: callLogs.length ? totalContextTokens / callLogs.length : 0,
    avgDurationSecs: durationCount ? durationSum / durationCount : null,
    byModel,
    dailyActivity,
    topSessions,
  };
}

export type Trend = "above" | "below" | "even";

export function compareToAverage(
  value: number,
  average: number,
): { trend: Trend; deltaPercent: number } {
  if (average <= 0) return { trend: "even", deltaPercent: 0 };
  const deltaPercent = ((value - average) / average) * 100;
  if (Math.abs(deltaPercent) < 1) return { trend: "even", deltaPercent: 0 };
  return { trend: deltaPercent > 0 ? "above" : "below", deltaPercent };
}
