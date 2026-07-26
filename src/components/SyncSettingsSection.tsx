import React, { useState, useEffect } from "react";
import type { SyncStatus } from "../lib/types";
import * as api from "../lib/api";

export const SyncSettingsSection: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>({
    method: "Local Storage",
    path: "~/.grok-app",
    isActive: false,
  });
  const [newPath, setNewPath] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await api.getSyncStatus();
      if (res) {
        setStatus(res);
        setNewPath(res.path);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSetPath = async () => {
    if (!newPath.trim()) return;
    try {
      await api.setSyncPath(newPath.trim());
      void refresh();
      setMessage("Sync storage path updated");
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage(`Error: ${String(e)}`);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await api.migrateToSyncPath();
      setMessage(res || "Data migrated successfully");
      void refresh();
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage(`Migration failed: ${String(e)}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="sync-settings-section" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)" }}>
      <div style={{ fontWeight: 600, fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Multi-Machine Data Sync</span>
        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: status.isActive ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.1)", color: status.isActive ? "var(--c-success, #22c55e)" : "inherit" }}>
          {status.method}
        </span>
      </div>

      <div style={{ fontSize: "12px", opacity: 0.8, lineHeight: "1.4" }}>
        Configure a shared sync folder (e.g. iCloud Drive, Dropbox, or OneDrive) to automatically sync sessions, presets, custom prompts, and settings across your machines.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600 }}>Sync Storage Path</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="~/Library/Mobile Documents/com~apple~CloudDocs/grok-app"
            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
          />
          <button
            type="button"
            onClick={() => void handleSetPath()}
            style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", fontSize: "12px", cursor: "pointer" }}
          >
            Save Path
          </button>
        </div>
      </div>

      {message && <div style={{ fontSize: "12px", color: "var(--c-accent, #3794ff)" }}>{message}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <span style={{ fontSize: "11px", opacity: 0.6 }}>
          Last Synced: {status.lastSynced ? new Date(status.lastSynced).toLocaleTimeString() : "Never"}
        </span>
        <button
          type="button"
          onClick={() => void handleMigrate()}
          disabled={migrating}
          style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >
          {migrating ? "Migrating Data..." : "Migrate Data to Sync Folder"}
        </button>
      </div>
    </div>
  );
};
