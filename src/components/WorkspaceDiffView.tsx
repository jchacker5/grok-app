import React, { useState, useEffect } from "react";
import * as api from "../lib/api";
import { DiffRenderer, type DiffHunkLine } from "./DiffRenderer";

export interface WorkspaceDiffViewProps {
  projectPath: string;
}

export const WorkspaceDiffView: React.FC<WorkspaceDiffViewProps> = ({ projectPath }) => {
  const [stagedDiff, setStagedDiff] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  const refreshDiffs = async () => {
    try {
      const staged = await api.gitGetStagedDiff(projectPath);
      setStagedDiff(staged || "");
    } catch {
      setStagedDiff("");
    }
  };

  useEffect(() => {
    if (projectPath) {
      void refreshDiffs();
    }
  }, [projectPath]);

  const parseDiffToLines = (diffText: string): DiffHunkLine[] => {
    if (!diffText.trim()) return [];
    return diffText.split("\n").map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        return { type: "added", content: line.slice(1) };
      }
      if (line.startsWith("-") && !line.startsWith("---")) {
        return { type: "removed", content: line.slice(1) };
      }
      return { type: "unchanged", content: line };
    });
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    setCommitSuccess(null);
    try {
      const res = await api.gitCommitMessage(projectPath, commitMessage.trim());
      setCommitSuccess(res || "Commit successful!");
      setCommitMessage("");
      void refreshDiffs();
      setTimeout(() => setCommitSuccess(null), 3000);
    } catch (e) {
      setCommitSuccess(`Commit failed: ${String(e)}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="workspace-diff-view" style={{ display: "flex", flexDirection: "column", height: "100%", gap: "12px", padding: "12px", background: "var(--c-bg)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Workspace Git Diff & Staging</h3>
        <button
          type="button"
          onClick={() => void refreshDiffs()}
          style={{ padding: "4px 10px", borderRadius: "4px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px", cursor: "pointer" }}
        >
          Refresh Diffs
        </button>
      </div>

      {/* Staged Diffs */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ fontWeight: 600, fontSize: "12px", opacity: 0.8 }}>Staged Changes</div>
        {stagedDiff ? (
          <DiffRenderer lines={parseDiffToLines(stagedDiff)} filename="Staged Diffs" />
        ) : (
          <div style={{ padding: "16px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px dashed var(--c-border)", textAlign: "center", fontSize: "12px", opacity: 0.6 }}>
            No staged files. Stage files or hunks to commit them.
          </div>
        )}
      </div>

      {/* Commit Box */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "8px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)" }}>
        <label style={{ fontSize: "12px", fontWeight: 600 }}>Commit Message</label>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="e.g. feat: add prompt library and custom slash commands"
          rows={2}
          style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px", fontFamily: "inherit" }}
        />
        {commitSuccess && <div style={{ fontSize: "11px", color: commitSuccess.includes("failed") ? "var(--c-danger)" : "var(--c-success)" }}>{commitSuccess}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={committing || !commitMessage.trim() || !stagedDiff}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              background: "var(--c-accent, #3794ff)",
              color: "#fff",
              border: "none",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {committing ? "Committing..." : "Commit Staged Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
