import React, { useState, useEffect } from "react";
import * as api from "../lib/api";
import { GlassModal } from "./GlassModal";

export interface GitHubIntegrationSectionProps {
  sessionId?: string;
}

export const GitHubIntegrationSection: React.FC<GitHubIntegrationSectionProps> = ({ sessionId = "active" }) => {
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const t = await api.githubGetToken();
        if (t) {
          setToken(t);
          setHasToken(true);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    try {
      await api.githubSetToken(token.trim());
      setHasToken(true);
    } catch {
      /* ignore */
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      const res = await api.githubFetch(urlInput.trim());
      setPreview(res);
    } catch (e) {
      setPreview(`Fetch failed: ${String(e)}`);
    }
  };

  const handleCreateIssue = async () => {
    if (!owner.trim() || !repo.trim() || !issueTitle.trim()) return;
    try {
      const res = await api.createIssueFromSession(owner.trim(), repo.trim(), issueTitle.trim(), sessionId);
      setCreatedUrl(res);
    } catch (e) {
      setCreatedUrl(`Error: ${String(e)}`);
    }
  };

  return (
    <div className="github-integration" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)" }}>
      <div style={{ fontWeight: 600, fontSize: "14px" }}>GitHub Integration</div>

      {/* Access Token */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600 }}>Personal Access Token (PAT)</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
          />
          <button
            type="button"
            onClick={() => void handleSaveToken()}
            style={{ padding: "6px 12px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}
          >
            {hasToken ? "Update Token" : "Save Token"}
          </button>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--c-border)", margin: "0" }} />

      {/* Fetch GitHub Link */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600 }}>Fetch Issue / PR Context</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://github.com/owner/repo/issues/123"
            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
          />
          <button
            type="button"
            onClick={() => void handleFetchUrl()}
            style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "12px", cursor: "pointer" }}
          >
            Fetch
          </button>
        </div>
        {preview && (
          <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "11px", fontFamily: "monospace", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>
            {preview}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}
        >
          + Create GitHub Issue from Session
        </button>
      </div>

      {/* Create Issue Modal */}
      <GlassModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create GitHub Issue">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Owner / Org</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. jchacker5"
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Repository</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. grok-app"
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>Issue Title</label>
            <input
              type="text"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder="e.g. Bug: session preview panel overflow"
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
            />
          </div>

          {createdUrl && (
            <div style={{ fontSize: "12px", wordBreak: "break-all" }}>
              <a href={createdUrl} target="_blank" rel="noreferrer" style={{ color: "var(--c-accent)" }}>
                {createdUrl}
              </a>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => setCreateModalOpen(false)} style={{ padding: "6px 14px", borderRadius: "6px", background: "transparent", border: "1px solid var(--c-border)", color: "inherit", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleCreateIssue()} style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", cursor: "pointer" }}>
              Create Issue Link
            </button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
