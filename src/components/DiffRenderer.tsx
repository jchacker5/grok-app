import React, { useState } from "react";

export interface DiffHunkLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffRendererProps {
  lines: DiffHunkLine[];
  mode?: "unified" | "side-by-side";
  filename?: string;
}

export const DiffRenderer: React.FC<DiffRendererProps> = ({
  lines,
  mode: initialMode = "unified",
  filename,
}) => {
  const [mode, setMode] = useState<"unified" | "side-by-side">(initialMode);

  return (
    <div className="diff-renderer" style={{ fontFamily: "monospace", fontSize: "12px", border: "1px solid var(--c-border)", borderRadius: "8px", overflow: "hidden" }}>
      <div
        className="diff-renderer__header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
          borderBottom: "1px solid var(--c-border)",
          fontSize: "11px",
        }}
      >
        <span style={{ fontWeight: 600, opacity: 0.8 }}>{filename || "Diff View"}</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setMode("unified")}
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              border: "none",
              background: mode === "unified" ? "var(--c-accent, #3794ff)" : "transparent",
              color: mode === "unified" ? "#fff" : "inherit",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setMode("side-by-side")}
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              border: "none",
              background: mode === "side-by-side" ? "var(--c-accent, #3794ff)" : "transparent",
              color: mode === "side-by-side" ? "#fff" : "inherit",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      <div className="diff-renderer__content" style={{ overflowX: "auto", maxHeight: "400px" }}>
        {mode === "unified" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "pre-wrap" }}>
            <tbody>
              {lines.map((line, idx) => {
                const bg =
                  line.type === "added"
                    ? "rgba(34, 197, 94, 0.15)"
                    : line.type === "removed"
                    ? "rgba(239, 68, 68, 0.15)"
                    : "transparent";
                const color =
                  line.type === "added"
                    ? "var(--c-success, #22c55e)"
                    : line.type === "removed"
                    ? "var(--c-danger, #ef4444)"
                    : "inherit";
                const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

                return (
                  <tr key={idx} style={{ background: bg }}>
                    <td style={{ width: "40px", padding: "2px 6px", textAlign: "right", userSelect: "none", opacity: 0.5, borderRight: "1px solid var(--c-border)" }}>
                      {line.oldLineNumber || ""}
                    </td>
                    <td style={{ width: "40px", padding: "2px 6px", textAlign: "right", userSelect: "none", opacity: 0.5, borderRight: "1px solid var(--c-border)" }}>
                      {line.newLineNumber || ""}
                    </td>
                    <td style={{ padding: "2px 8px", color }}>
                      {prefix} {line.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "pre-wrap" }}>
            <tbody>
              {lines.map((line, idx) => {
                const isAdded = line.type === "added";
                const isRemoved = line.type === "removed";

                return (
                  <tr key={idx}>
                    {/* Left (Old) */}
                    <td
                      style={{
                        width: "50%",
                        padding: "2px 8px",
                        background: isRemoved ? "rgba(239, 68, 68, 0.15)" : "transparent",
                        color: isRemoved ? "var(--c-danger, #ef4444)" : "inherit",
                        borderRight: "1px solid var(--c-border)",
                      }}
                    >
                      {!isAdded ? line.content : ""}
                    </td>
                    {/* Right (New) */}
                    <td
                      style={{
                        width: "50%",
                        padding: "2px 8px",
                        background: isAdded ? "rgba(34, 197, 94, 0.15)" : "transparent",
                        color: isAdded ? "var(--c-success, #22c55e)" : "inherit",
                      }}
                    >
                      {!isRemoved ? line.content : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
