import React, { useState, useMemo } from "react";
import type { ChatMessage } from "../lib/session";

export interface SessionAnalyticsPanelProps {
  sessions: { id: string; title: string; messages: ChatMessage[]; updatedAt?: string }[];
}

export const SessionAnalyticsPanel: React.FC<SessionAnalyticsPanelProps> = ({ sessions }) => {
  const [tab, setTab] = useState<"overview" | "per-session">("overview");
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || "");

  const overviewStats = useMemo(() => {
    let totalMsgs = 0;
    let totalTokensPrompt = 0;
    let totalTokensCompletion = 0;
    const modelCounts: Record<string, number> = {};

    for (const s of sessions) {
      totalMsgs += s.messages.length;
      for (const m of s.messages) {
        const mod = (m as any).model || "Grok 3";
        modelCounts[mod] = (modelCounts[mod] || 0) + 1;
        // Estimate token counts based on length (4 chars ~ 1 token)
        const tok = Math.ceil(m.content.length / 4);
        if (m.role === "user") {
          totalTokensPrompt += tok;
        } else {
          totalTokensCompletion += tok;
        }
      }
    }

    return {
      totalSessions: sessions.length,
      totalMsgs,
      totalTokensPrompt,
      totalTokensCompletion,
      totalTokens: totalTokensPrompt + totalTokensCompletion,
      modelCounts,
    };
  }, [sessions]);

  const selectedSessionStats = useMemo(() => {
    const s = sessions.find((x) => x.id === selectedSessionId);
    if (!s) return null;

    let userMsgs = 0;
    let assistantMsgs = 0;
    let charCount = 0;

    for (const m of s.messages) {
      if (m.role === "user") userMsgs++;
      else if (m.role === "assistant") assistantMsgs++;
      charCount += m.content.length;
    }

    return {
      title: s.title,
      totalMsgs: s.messages.length,
      userMsgs,
      assistantMsgs,
      estTokens: Math.ceil(charCount / 4),
      avgMsgLength: s.messages.length > 0 ? Math.round(charCount / s.messages.length) : 0,
    };
  }, [sessions, selectedSessionId]);

  return (
    <div className="session-analytics" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", color: "inherit" }}>
      {/* Sub Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--c-border)", paddingBottom: "8px" }}>
        <button
          type="button"
          onClick={() => setTab("overview")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "none",
            background: tab === "overview" ? "var(--c-accent, #3794ff)" : "transparent",
            color: tab === "overview" ? "#fff" : "inherit",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("per-session")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "none",
            background: tab === "per-session" ? "var(--c-accent, #3794ff)" : "transparent",
            color: tab === "per-session" ? "#fff" : "inherit",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Per Session
        </button>
      </div>

      {tab === "overview" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase" }}>Total Sessions</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>{overviewStats.totalSessions}</div>
            </div>
            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase" }}>Total Messages</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>{overviewStats.totalMsgs}</div>
            </div>
            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase" }}>Est. Tokens Used</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>{overviewStats.totalTokens.toLocaleString()}</div>
            </div>
          </div>

          {/* Model Breakdown */}
          <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Model Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(overviewStats.modelCounts).map(([model, count]) => {
                const pct = overviewStats.totalMsgs > 0 ? Math.round((count / overviewStats.totalMsgs) * 100) : 0;
                return (
                  <div key={model} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span>{model}</span>
                      <span style={{ opacity: 0.7 }}>{count} msgs ({pct}%)</span>
                    </div>
                    <div style={{ height: "6px", width: "100%", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--c-accent, #3794ff)", borderRadius: "3px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Select Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "13px" }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled Session"} ({s.messages.length} msgs)
                </option>
              ))}
            </select>
          </div>

          {selectedSessionStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)" }}>
                <div style={{ fontSize: "11px", opacity: 0.7 }}>Total Messages</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>{selectedSessionStats.totalMsgs}</div>
                <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>User: {selectedSessionStats.userMsgs} | Assistant: {selectedSessionStats.assistantMsgs}</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "8px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)" }}>
                <div style={{ fontSize: "11px", opacity: 0.7 }}>Estimated Tokens</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>{selectedSessionStats.estTokens.toLocaleString()}</div>
                <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>Avg length: {selectedSessionStats.avgMsgLength} chars/msg</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
