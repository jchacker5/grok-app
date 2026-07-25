/**
 * Session analytics — overview + per-session stats built entirely from the
 * local usage data the Account panel already loads (`callLogs` + `heatmap`
 * on `AccountStatus`, derived in `account.rs` from each session's
 * signals.json). No extra Tauri round-trip and no invented token math: the
 * same `turns` / `toolCalls` / `contextTokens` / `durationSecs` shown in the
 * "Recent sessions" table are simply aggregated and charted here.
 */

import { useMemo, useState } from "react";
import type { CallLogEntry, HeatmapDay } from "@/lib/api";
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
} from "@/lib/accountUi";
import {
  compareToAverage,
  computeSessionAnalytics,
} from "@/lib/sessionAnalytics";

export interface SessionAnalyticsLabels {
  overview: string;
  perSession: string;
  totalSessions: string;
  totalTurns: string;
  totalToolCalls: string;
  totalTokens: string;
  avgDuration: string;
  modelBreakdown: string;
  dailyActivity: string;
  topSessions: string;
  selectSession: string;
  sessionTurns: string;
  sessionToolCalls: string;
  sessionTokens: string;
  sessionDuration: string;
  sessionErrors: string;
  vsAverage: string;
  noData: string;
}

export interface SessionAnalyticsPanelProps {
  callLogs: CallLogEntry[];
  heatmap: HeatmapDay[];
  locale: string;
  labels: SessionAnalyticsLabels;
}

type Mode = "overview" | "session";

export function SessionAnalyticsPanel({
  callLogs,
  heatmap,
  locale,
  labels,
}: SessionAnalyticsPanelProps) {
  const [mode, setMode] = useState<Mode>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(
    () => computeSessionAnalytics(callLogs, heatmap, 14),
    [callLogs, heatmap],
  );

  if (callLogs.length === 0) {
    return (
      <div className="account-analytics">
        <div className="account-logs__empty">{labels.noData}</div>
      </div>
    );
  }

  const selected = callLogs.find((c) => c.id === selectedId) ?? callLogs[0]!;
  const maxModelSessions = Math.max(
    1,
    ...stats.byModel.map((m) => m.sessions),
  );
  const maxDailySessions = Math.max(
    1,
    ...stats.dailyActivity.map((d) => d.sessions),
  );

  return (
    <div className="account-analytics">
      <div className="settings-seg" role="tablist">
        <button
          type="button"
          role="tab"
          className={
            "settings-seg__btn" + (mode === "overview" ? " is-on" : "")
          }
          aria-selected={mode === "overview"}
          onClick={() => setMode("overview")}
        >
          {labels.overview}
        </button>
        <button
          type="button"
          role="tab"
          className={"settings-seg__btn" + (mode === "session" ? " is-on" : "")}
          aria-selected={mode === "session"}
          onClick={() => setMode("session")}
        >
          {labels.perSession}
        </button>
      </div>

      {mode === "overview" ? (
        <div className="account-analytics__body">
          <div className="analytics-summary">
            <div className="analytics-card">
              <span className="analytics-card__value">
                {stats.totalSessions}
              </span>
              <span className="analytics-card__label">
                {labels.totalSessions}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__value">
                {stats.totalTurns}
              </span>
              <span className="analytics-card__label">
                {labels.totalTurns}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__value">
                {stats.totalToolCalls}
              </span>
              <span className="analytics-card__label">
                {labels.totalToolCalls}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__value">
                {formatCompactNumber(stats.totalContextTokens)}
              </span>
              <span className="analytics-card__label">
                {labels.totalTokens}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__value">
                {formatDuration(stats.avgDurationSecs)}
              </span>
              <span className="analytics-card__label">
                {labels.avgDuration}
              </span>
            </div>
          </div>

          <section className="account-section">
            <div className="account-section__title">
              {labels.modelBreakdown}
            </div>
            <div className="account-section__body">
              <div className="analytics-model-list">
                {stats.byModel.map((m) => (
                  <div key={m.model} className="analytics-model-row">
                    <span className="analytics-model-row__name">
                      {m.model}
                    </span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-track__fill"
                        style={{
                          width: `${(m.sessions / maxModelSessions) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="analytics-model-row__count">
                      {m.sessions}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="account-section">
            <div className="account-section__title">
              {labels.dailyActivity}
            </div>
            <div className="account-section__body">
              <div className="analytics-bar-chart">
                {stats.dailyActivity.map((d) => (
                  <div
                    key={d.date}
                    className="analytics-bar-chart__col"
                    title={`${d.date}: ${d.sessions}`}
                  >
                    <div
                      className="analytics-bar"
                      style={{
                        height: `${Math.max(2, (d.sessions / maxDailySessions) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="account-section">
            <div className="account-section__title">
              {labels.topSessions}
            </div>
            <div className="account-section__body">
              <div className="analytics-top-list">
                {stats.topSessions.map((s) => (
                  <div key={s.id} className="analytics-top-row">
                    <span className="analytics-top-row__title">
                      {s.title}
                    </span>
                    <span className="analytics-top-row__mono">
                      {s.model || "—"}
                    </span>
                    <span className="analytics-top-row__mono">
                      {formatCompactNumber(s.contextTokens)}
                    </span>
                    <span className="analytics-top-row__mono">
                      {formatDuration(s.durationSecs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="account-analytics__body">
          <label className="analytics-select">
            <span>{labels.selectSession}</span>
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {callLogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {formatRelativeTime(c.startedAt, locale)}
                </option>
              ))}
            </select>
          </label>

          <div className="analytics-summary">
            <SessionStatCard
              label={labels.sessionTurns}
              value={selected.turns}
              average={stats.avgTurns}
              vsAverage={labels.vsAverage}
            />
            <div className="analytics-card">
              <span className="analytics-card__value">
                {selected.toolCalls}
              </span>
              <span className="analytics-card__label">
                {labels.sessionToolCalls}
              </span>
            </div>
            <SessionStatCard
              label={labels.sessionTokens}
              value={selected.contextTokens}
              average={stats.avgContextTokens}
              vsAverage={labels.vsAverage}
              format={formatCompactNumber}
            />
            <div className="analytics-card">
              <span className="analytics-card__value">
                {formatDuration(selected.durationSecs)}
              </span>
              <span className="analytics-card__label">
                {labels.sessionDuration}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__value">{selected.errors}</span>
              <span className="analytics-card__label">
                {labels.sessionErrors}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionStatCard({
  label,
  value,
  average,
  vsAverage,
  format,
}: {
  label: string;
  value: number;
  average: number;
  vsAverage: string;
  format?: (n: number) => string;
}) {
  const { trend, deltaPercent } = compareToAverage(value, average);
  return (
    <div className="analytics-card">
      <span className="analytics-card__value">
        {format ? format(value) : value}
      </span>
      <span className="analytics-card__label">{label}</span>
      {trend !== "even" ? (
        <span className={"analytics-card__trend is-" + trend}>
          {trend === "above" ? "▲" : "▼"} {Math.abs(deltaPercent).toFixed(0)}%{" "}
          {vsAverage}
        </span>
      ) : null}
    </div>
  );
}
