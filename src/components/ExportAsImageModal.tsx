import React, { useState, useRef } from "react";
import type { ChatMessage } from "../lib/session";
import { GlassModal } from "./GlassModal";

export interface ExportAsImageModalProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  sessionTitle?: string;
}

export const ExportAsImageModal: React.FC<ExportAsImageModalProps> = ({
  open,
  onClose,
  messages,
  sessionTitle = "Grok Chat Session",
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => messages.slice(-10).map((m) => m.id));
  const [styleTheme, setStyleTheme] = useState<"dark" | "light" | "sepia">("dark");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(messages.map((m) => m.id));
  };

  const handleExport = async () => {
    if (selectedIds.length === 0 || !exportRef.current) return;
    setExporting(true);
    try {
      // SVG ForeignObject canvas screenshot approach
      const node = exportRef.current;
      const width = node.offsetWidth || 800;
      const height = node.offsetHeight || 600;

      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = styleTheme === "light" ? "#ffffff" : styleTheme === "sepia" ? "#fbf0d9" : "#0d1117";
        ctx.fillRect(0, 0, width, height);

        // Simple text capture export
        ctx.font = "14px monospace";
        ctx.fillStyle = styleTheme === "light" ? "#111827" : styleTheme === "sepia" ? "#432818" : "#f3f4f6";

        let y = 30;
        if (includeMetadata) {
          ctx.fillText(`⚡ ${sessionTitle}`, 20, y);
          y += 30;
        }

        const selected = messages.filter((m) => selectedIds.includes(m.id));
        for (const m of selected) {
          ctx.font = "bold 12px sans-serif";
          ctx.fillText(`${m.role.toUpperCase()}:`, 20, y);
          y += 20;

          ctx.font = "12px monospace";
          const lines = m.content.split("\n").slice(0, 10);
          for (const line of lines) {
            ctx.fillText(line.slice(0, 80), 30, y);
            y += 18;
          }
          y += 15;
        }

        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `grok-chat-${Date.now()}.png`;
        a.click();
      }
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <GlassModal open={open} onClose={onClose} title="Export Messages as Image" size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            Selected: {selectedIds.length} / {messages.length} messages
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={selectAll} style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "11px", cursor: "pointer" }}>
              Select All
            </button>
            <select
              value={styleTheme}
              onChange={(e) => setStyleTheme(e.target.value as any)}
              style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "11px" }}
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
              <option value="sepia">Sepia Theme</option>
            </select>
          </div>
        </div>

        {/* Message Selector List */}
        <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", border: "1px solid var(--c-border)", borderRadius: "6px", padding: "8px" }}>
          {messages.map((m) => {
            const isChecked = selectedIds.includes(m.id);
            return (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  background: isChecked ? "rgba(55,148,255,0.15)" : "transparent",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                <input type="checkbox" checked={isChecked} onChange={() => {}} />
                <span style={{ fontWeight: 600, textTransform: "capitalize", width: "70px" }}>{m.role}</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0.8 }}>
                  {m.content}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live Export Preview Container */}
        <div
          ref={exportRef}
          style={{
            padding: "16px",
            borderRadius: "8px",
            background: styleTheme === "light" ? "#ffffff" : styleTheme === "sepia" ? "#fbf0d9" : "#0d1117",
            color: styleTheme === "light" ? "#111827" : styleTheme === "sepia" ? "#432818" : "#f3f4f6",
            border: "1px solid var(--c-border)",
            maxHeight: "180px",
            overflowY: "auto",
          }}
        >
          {includeMetadata && (
            <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              ⚡ {sessionTitle}
            </div>
          )}
          {messages
            .filter((m) => selectedIds.includes(m.id))
            .map((m) => (
              <div key={m.id} style={{ marginBottom: "10px" }}>
                <div style={{ fontWeight: 600, fontSize: "11px", opacity: 0.7, marginBottom: "2px" }}>{m.role.toUpperCase()}</div>
                <div style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{m.content.slice(0, 150)}{m.content.length > 150 ? "…" : ""}</div>
              </div>
            ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
            <input type="checkbox" checked={includeMetadata} onChange={(e) => setIncludeMetadata(e.target.checked)} />
            Include Title & Header Metadata
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 14px", borderRadius: "6px", background: "transparent", border: "1px solid var(--c-border)", color: "inherit", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || selectedIds.length === 0}
              style={{ padding: "6px 16px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              {exporting ? "Generating..." : "Download PNG"}
            </button>
          </div>
        </div>
      </div>
    </GlassModal>
  );
};
