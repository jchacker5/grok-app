import React, { useState, useEffect } from "react";
import * as api from "../lib/api";
import { IconCheck } from "./icons";

export interface AgentsEditorProps {
  projectPath: string;
}

const STARTER_TEMPLATE = `# Agent Guidelines — Project Rules

## Core Directives
1. Maintain strict code quality and unit test coverage.
2. Do NOT introduce external dependencies without user confirmation.
3. Obey explicit i18n rules and avoid hardcoding strings.

## Build & Test Commands
- Build: \`pnpm build\`
- Test: \`pnpm test\`
`;

export const AgentsEditor: React.FC<AgentsEditorProps> = ({ projectPath }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [initialContent, setInitialContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);

  const loadFiles = async () => {
    try {
      const list = await api.findAgentsFiles(projectPath);
      setFiles(list || []);
      if (list && list.length > 0) {
        setSelectedFile(list[0]);
      } else {
        setSelectedFile(`${projectPath}/AGENTS.md`);
      }
    } catch {
      setFiles([]);
      setSelectedFile(`${projectPath}/AGENTS.md`);
    }
  };

  useEffect(() => {
    if (projectPath) {
      void loadFiles();
    }
  }, [projectPath]);

  useEffect(() => {
    if (selectedFile) {
      void (async () => {
        try {
          const text = await api.readAgentsFile(selectedFile);
          setContent(text || "");
          setInitialContent(text || "");
        } catch {
          setContent("");
          setInitialContent("");
        }
      })();
    }
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.writeAgentsFile(selectedFile, content);
      setInitialContent(content);
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2000);
      if (!files.includes(selectedFile)) {
        setFiles([...files, selectedFile]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setContent(initialContent);
  };

  const handleInsertTemplate = () => {
    setContent(STARTER_TEMPLATE);
  };

  return (
    <div className="agents-editor" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid var(--c-border)", borderRadius: "8px", overflow: "hidden", background: "var(--c-bg)" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))", borderBottom: "1px solid var(--c-border)" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
          >
            {files.length === 0 ? (
              <option value={`${projectPath}/AGENTS.md`}>AGENTS.md (New)</option>
            ) : (
              files.map((f) => (
                <option key={f} value={f}>
                  {f.replace(projectPath, "")}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={handleInsertTemplate}
            style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "11px", cursor: "pointer" }}
          >
            + Starter Template
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {content !== initialContent && (
            <button
              type="button"
              onClick={handleRevert}
              style={{ padding: "4px 8px", borderRadius: "4px", background: "transparent", border: "1px solid var(--c-border)", color: "inherit", fontSize: "11px", cursor: "pointer" }}
            >
              Revert
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              background: savedStatus ? "var(--c-success, #22c55e)" : "var(--c-accent, #3794ff)",
              color: "#fff",
              border: "none",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {savedStatus ? <IconCheck size={12} /> : null}
            {saving ? "Saving..." : savedStatus ? "Saved" : "Save (⌘S)"}
          </button>
        </div>
      </div>

      {/* Code Textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            void handleSave();
          }
        }}
        placeholder="Enter AGENTS.md rules for this project..."
        style={{
          flex: 1,
          width: "100%",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "13px",
          lineHeight: "1.5",
          background: "var(--c-bg-code, rgba(0,0,0,0.3))",
          color: "inherit",
          border: "none",
          outline: "none",
          resize: "none",
        }}
      />
    </div>
  );
};
