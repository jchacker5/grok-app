import React, { useState, useEffect, useMemo } from "react";
import type { MemoryEntry } from "../lib/types";
import * as api from "../lib/api";
import { GlassModal } from "./GlassModal";
import { IconSearch, IconTrash } from "./icons";

export const AgentMemoryViewer: React.FC = () => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const refresh = async () => {
    try {
      const list = await api.readAgentMemories();
      setMemories(list || []);
    } catch {
      setMemories([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesCategory = category === "all" || m.category === category;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.key.toLowerCase().includes(q) ||
        m.value.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [memories, category, search]);

  const handleClearAll = async () => {
    try {
      await api.clearAgentMemories();
      setMemories([]);
    } finally {
      setConfirmClearOpen(false);
    }
  };

  const renderStars = (confidence: number) => {
    const count = Math.round(confidence * 5);
    return "★".repeat(count) + "☆".repeat(5 - count);
  };

  return (
    <div className="agent-memory-viewer" style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", padding: "12px", background: "var(--c-bg)" }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", opacity: 0.5, display: "flex", alignItems: "center" }}>
            <IconSearch size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            style={{ width: "100%", padding: "6px 12px 6px 30px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
          />
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "12px", cursor: "pointer" }}
        >
          Refresh
        </button>

        <button
          type="button"
          onClick={() => setConfirmClearOpen(true)}
          style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(239,68,68,0.15)", color: "var(--c-danger, #ef4444)", border: "none", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >
          <IconTrash size={14} /> Clear All
        </button>
      </div>

      {/* Categories */}
      <div style={{ display: "flex", gap: "4px" }}>
        {["all", "preference", "context", "fact"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              border: "none",
              background: category === cat ? "var(--c-accent, #3794ff)" : "transparent",
              color: category === cat ? "#fff" : "inherit",
              fontSize: "11px",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memory Cards Grid */}
      <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
        {filteredMemories.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0", opacity: 0.6, fontSize: "12px" }}>
            No agent memories found
          </div>
        ) : (
          filteredMemories.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "12px",
                borderRadius: "8px",
                background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))",
                border: "1px solid var(--c-border)",
                gap: "6px",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--c-accent, #3794ff)" }}>{m.key}</div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "4px", lineHeight: "1.4" }}>{m.value}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", opacity: 0.6, marginTop: "6px" }}>
                <span>Source: {m.source}</span>
                <span style={{ color: "#f59e0b" }}>{renderStars(m.confidence)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      <GlassModal open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} title="Clear Agent Memory">
        <div style={{ padding: "8px 0", fontSize: "13px" }}>
          Are you sure you want to clear all stored memories? This operation cannot be undone.
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
            <button type="button" onClick={() => setConfirmClearOpen(false)} style={{ padding: "6px 14px", borderRadius: "6px", background: "transparent", border: "1px solid var(--c-border)", color: "inherit", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleClearAll()} style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-danger, #ef4444)", color: "#fff", border: "none", cursor: "pointer" }}>
              Clear Memories
            </button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
