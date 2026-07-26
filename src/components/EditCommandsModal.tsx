import React, { useState, useEffect } from "react";
import type { CustomCommand } from "../lib/types";
import * as api from "../lib/api";
import { GlassModal } from "./GlassModal";
import { IconPlus, IconTrash } from "./icons";

export interface EditCommandsModalProps {
  open: boolean;
  onClose: () => void;
}

export const EditCommandsModal: React.FC<EditCommandsModalProps> = ({
  open,
  onClose,
}) => {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState<"insert_text" | "run_shell">("insert_text");
  const [actionValue, setActionValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await api.loadCustomCommands();
      setCommands(list || []);
    } catch {
      setCommands([]);
    }
  };

  useEffect(() => {
    if (open) {
      void refresh();
      setErrorMsg("");
      setTestOutput(null);
    }
  }, [open]);

  const handleSave = async () => {
    setErrorMsg("");
    const cleanName = name.trim().replace(/^[\/]/, "");
    if (!/^[a-zA-Z0-9_]+$/.test(cleanName)) {
      setErrorMsg("Command name must contain only letters, numbers, and underscores (no spaces).");
      return;
    }
    if (!actionValue.trim()) {
      setErrorMsg("Action value cannot be empty.");
      return;
    }

    const newCmd: CustomCommand = {
      id: crypto.randomUUID(),
      name: cleanName,
      description: description.trim() || `Custom /${cleanName} command`,
      actionType,
      actionValue: actionValue.trim(),
    };

    try {
      const updated = await api.saveCustomCommand(newCmd);
      setCommands(updated);
      setName("");
      setDescription("");
      setActionValue("");
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const updated = await api.deleteCustomCommand(id);
      setCommands(updated);
    } catch {
      setCommands((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleTest = async (cmd: CustomCommand) => {
    setTestOutput("Running test...");
    try {
      const res = await api.executeCustomCommand(cmd.id);
      setTestOutput(res || "(Command returned empty output)");
    } catch (e) {
      setTestOutput(`Error: ${String(e)}`);
    }
  };

  if (!open) return null;

  return (
    <GlassModal open={open} onClose={onClose} title="Manage Custom Slash Commands" size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
        {/* Form */}
        <div style={{ padding: "12px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)" }}>
          <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <IconPlus size={14} /> Add New Custom Slash Command
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Command Trigger Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. review, deploy_test"
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Action Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              >
                <option value="insert_text">Insert Text Prompt</option>
                <option value="run_shell">Run Shell Script (stdout)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Insert code review template into composer"
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
              {actionType === "insert_text" ? "Prompt Text to Insert" : "Shell Command Line"}
            </label>
            <textarea
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder={actionType === "insert_text" ? "Enter text template..." : "e.g. git status --porcelain"}
              rows={3}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px", fontFamily: "monospace" }}
            />
          </div>

          {errorMsg && <div style={{ color: "var(--c-danger, #ef4444)", fontSize: "12px", marginBottom: "8px" }}>{errorMsg}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSave}
              style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}
            >
              Add Command
            </button>
          </div>
        </div>

        {/* Existing commands */}
        <div>
          <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Configured Commands ({commands.length})</div>
          {commands.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: "12px", textAlign: "center", padding: "16px 0" }}>No custom slash commands configured</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>
                      /{cmd.name} <span style={{ fontSize: "10px", opacity: 0.6, textTransform: "uppercase" }}>({cmd.actionType})</span>
                    </div>
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>{cmd.description}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => void handleTest(cmd)}
                      style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "11px", cursor: "pointer" }}
                    >
                      <span style={{ fontFamily: "monospace" }}>&gt;_</span> Test
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(cmd.id)}
                      style={{ background: "none", border: "none", color: "var(--c-danger, #ef4444)", cursor: "pointer" }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {testOutput !== null && (
          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "6px", padding: "10px", fontFamily: "monospace", fontSize: "11px", maxHeight: "100px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
            <strong>Test Execution Result:</strong>
            <br />
            {testOutput}
          </div>
        )}
      </div>
    </GlassModal>
  );
};
