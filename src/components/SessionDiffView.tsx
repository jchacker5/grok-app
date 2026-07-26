import React, { useState, useMemo } from "react";
import type { ChatMessage } from "../lib/session";
import { DiffRenderer, type DiffHunkLine } from "./DiffRenderer";
import { GlassModal } from "./GlassModal";

export interface SessionDiffViewProps {
  open: boolean;
  onClose: () => void;
  sessionA: { id: string; title: string; messages: ChatMessage[] };
  sessionB: { id: string; title: string; messages: ChatMessage[] };
}

export const SessionDiffView: React.FC<SessionDiffViewProps> = ({
  open,
  onClose,
  sessionA,
  sessionB,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "side-by-side">("unified");

  const computedDiffLines = useMemo<DiffHunkLine[]>(() => {
    const lines: DiffHunkLine[] = [];
    const maxLen = Math.max(sessionA.messages.length, sessionB.messages.length);

    for (let i = 0; i < maxLen; i++) {
      const mA = sessionA.messages[i];
      const mB = sessionB.messages[i];

      if (mA && mB) {
        if (mA.content === mB.content) {
          lines.push({
            type: "unchanged",
            content: `[${mA.role}] ${mA.content.slice(0, 100)}`,
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
          });
        } else {
          lines.push({
            type: "removed",
            content: `[${mA.role}] ${mA.content}`,
            oldLineNumber: i + 1,
          });
          lines.push({
            type: "added",
            content: `[${mB.role}] ${mB.content}`,
            newLineNumber: i + 1,
          });
        }
      } else if (mA) {
        lines.push({
          type: "removed",
          content: `[${mA.role}] ${mA.content}`,
          oldLineNumber: i + 1,
        });
      } else if (mB) {
        lines.push({
          type: "added",
          content: `[${mB.role}] ${mB.content}`,
          newLineNumber: i + 1,
        });
      }
    }
    return lines;
  }, [sessionA, sessionB]);

  if (!open) return null;

  return (
    <GlassModal open={open} onClose={onClose} title="Session Comparison & Diff" size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
        {/* Header Summary */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--c-bg-tertiary)", borderRadius: "6px", fontSize: "12px" }}>
          <div>
            <span style={{ color: "var(--c-danger, #ef4444)", fontWeight: 600 }}>A: {sessionA.title}</span> ({sessionA.messages.length} msgs) vs{" "}
            <span style={{ color: "var(--c-success, #22c55e)", fontWeight: 600 }}>B: {sessionB.title}</span> ({sessionB.messages.length} msgs)
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              style={{ padding: "3px 8px", borderRadius: "4px", border: "none", background: viewMode === "unified" ? "var(--c-accent)" : "transparent", color: viewMode === "unified" ? "#fff" : "inherit", fontSize: "11px", cursor: "pointer" }}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              style={{ padding: "3px 8px", borderRadius: "4px", border: "none", background: viewMode === "side-by-side" ? "var(--c-accent)" : "transparent", color: viewMode === "side-by-side" ? "#fff" : "inherit", fontSize: "11px", cursor: "pointer" }}
            >
              Side-by-Side
            </button>
          </div>
        </div>

        {/* Diff Renderer */}
        <DiffRenderer lines={computedDiffLines} mode={viewMode} filename={`${sessionA.title} ↔ ${sessionB.title}`} />
      </div>
    </GlassModal>
  );
};
