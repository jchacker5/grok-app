import React, { useState, useEffect } from "react";
import type { SessionPreset } from "../lib/types";
import * as api from "../lib/api";
import { GlassModal } from "./GlassModal";
import { IconTrash } from "./icons";

export interface PresetSelectorProps {
  currentConfig: {
    systemPrompt: string;
    model: string;
    effort: "low" | "medium" | "high";
    yolo: boolean;
    temperature: number;
  };
  onApplyPreset: (preset: SessionPreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  currentConfig,
  onApplyPreset,
}) => {
  const [presets, setPresets] = useState<SessionPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");

  const refreshPresets = async () => {
    try {
      const list = await api.loadSessionPresets();
      setPresets(list || []);
    } catch {
      setPresets([]);
    }
  };

  useEffect(() => {
    void refreshPresets();
  }, []);

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__save__") {
      setSaveModalOpen(true);
      setSelectedId("");
      return;
    }
    if (val === "__manage__") {
      setManageModalOpen(true);
      setSelectedId("");
      return;
    }
    if (!val) {
      setSelectedId("");
      return;
    }

    setSelectedId(val);
    try {
      const preset = await api.applySessionPreset(val);
      if (preset) {
        onApplyPreset(preset);
      }
    } catch {
      const local = presets.find((p) => p.id === val);
      if (local) onApplyPreset(local);
    }
  };

  const handleSave = async () => {
    if (!presetName.trim()) return;
    const newPreset: SessionPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      description: presetDesc.trim() || undefined,
      systemPrompt: currentConfig.systemPrompt,
      model: currentConfig.model,
      effort: currentConfig.effort,
      yolo: currentConfig.yolo,
      temperature: currentConfig.temperature,
      createdAt: Date.now(),
    };

    try {
      const updated = await api.saveSessionPreset(newPreset);
      setPresets(updated);
    } catch {
      setPresets((prev) => [...prev, newPreset]);
    }

    setSaveModalOpen(false);
    setPresetName("");
    setPresetDesc("");
    setSelectedId(newPreset.id);
  };

  const handleDelete = async (id: string) => {
    try {
      const updated = await api.deleteSessionPreset(id);
      setPresets(updated);
    } catch {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="preset-selector" style={{ display: "inline-flex", alignItems: "center" }}>
      <select
        value={selectedId}
        onChange={handleSelectChange}
        title="Session Presets"
        style={{
          padding: "4px 8px",
          borderRadius: "6px",
          background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
          border: "1px solid var(--c-border)",
          color: "inherit",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        <option value="">Load Preset…</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.model})
          </option>
        ))}
        <option disabled>──────────</option>
        <option value="__save__">+ Save Current as Preset…</option>
        {presets.length > 0 && <option value="__manage__">⚙ Manage Presets…</option>}
      </select>

      {/* Save Modal */}
      <GlassModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Session Preset"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Preset Name</label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Code Review, Creative Writing"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                background: "var(--c-bg-tertiary)",
                border: "1px solid var(--c-border)",
                color: "inherit",
                fontSize: "13px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Description (Optional)</label>
            <input
              type="text"
              value={presetDesc}
              onChange={(e) => setPresetDesc(e.target.value)}
              placeholder="Short description of this configuration"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                background: "var(--c-bg-tertiary)",
                border: "1px solid var(--c-border)",
                color: "inherit",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ fontSize: "11px", opacity: 0.8, background: "rgba(0,0,0,0.15)", padding: "8px", borderRadius: "6px" }}>
            Includes: Model ({currentConfig.model}), Effort ({currentConfig.effort}), YOLO ({currentConfig.yolo ? "On" : "Off"}), Temp ({currentConfig.temperature})
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setSaveModalOpen(false)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid var(--c-border)",
                color: "inherit",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: "var(--c-accent, #3794ff)",
                color: "#fff",
                border: "none",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Save Preset
            </button>
          </div>
        </div>
      </GlassModal>

      {/* Manage Modal */}
      <GlassModal
        open={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        title="Manage Session Presets"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
          {presets.length === 0 ? (
            <div style={{ textAlign: "center", opacity: 0.7, padding: "16px 0" }}>No saved presets</div>
          ) : (
            presets.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--c-bg-tertiary)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
                  <div style={{ fontSize: "11px", opacity: 0.7 }}>
                    Model: {p.model} | Effort: {p.effort} {p.description ? `| ${p.description}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--c-danger, #ef4444)",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  title="Delete Preset"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setManageModalOpen(false)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: "var(--c-accent, #3794ff)",
                color: "#fff",
                border: "none",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
