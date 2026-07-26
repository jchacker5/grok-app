import React, { useState, useEffect } from "react";
import type { NotificationSettings } from "../lib/types";
import * as api from "../lib/api";
import { IconCheck } from "./icons";

export const NotificationSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    desktopEnabled: true,
    soundEnabled: true,
    inAppBadge: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    notifyOnCompletion: true,
    notifyOnError: true,
  });
  const [saving, setSaving] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.getNotificationSettings();
        if (res) setSettings(res);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleChange = async (key: keyof NotificationSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      await api.updateNotificationSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Grok Notification Test", {
        body: "Notifications are working properly!",
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } else if ("Notification" in window) {
      void Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          new Notification("Grok Notification Test", {
            body: "Notifications are working properly!",
          });
          setTestSent(true);
          setTimeout(() => setTestSent(false), 3000);
        }
      });
    }
  };

  return (
    <div className="settings-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", borderRadius: "8px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))", border: "1px solid var(--c-border)" }}>
      <div style={{ fontWeight: 600, fontSize: "14px" }}>Notification Preferences & Quiet Hours</div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
          <span>Enable Desktop Notifications</span>
          <input
            type="checkbox"
            checked={settings.desktopEnabled}
            onChange={(e) => void handleChange("desktopEnabled", e.target.checked)}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
          <span>Notification Sound Chime</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => void handleChange("soundEnabled", e.target.checked)}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
          <span>In-App Badge Indicators</span>
          <input
            type="checkbox"
            checked={settings.inAppBadge}
            onChange={(e) => void handleChange("inAppBadge", e.target.checked)}
          />
        </label>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--c-border)", margin: "4px 0" }} />

      {/* Quiet Hours */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <span>Do Not Disturb (Quiet Hours)</span>
          <input
            type="checkbox"
            checked={settings.quietHoursEnabled}
            onChange={(e) => void handleChange("quietHoursEnabled", e.target.checked)}
          />
        </label>

        {settings.quietHoursEnabled && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", opacity: 0.8, marginBottom: "4px" }}>Quiet Hours Start</label>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(e) => void handleChange("quietHoursStart", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", opacity: 0.8, marginBottom: "4px" }}>Quiet Hours End</label>
              <input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(e) => void handleChange("quietHoursEnd", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "12px" }}
              />
            </div>
          </div>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--c-border)", margin: "4px 0" }} />

      {/* Event Notifications */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, opacity: 0.8 }}>Event Triggers</div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.notifyOnCompletion}
            onChange={(e) => void handleChange("notifyOnCompletion", e.target.checked)}
          />
          Notify when long-running agent turn completes
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.notifyOnError}
            onChange={(e) => void handleChange("notifyOnError", e.target.checked)}
          />
          Notify on execution error or failure
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <span style={{ fontSize: "11px", opacity: 0.6 }}>{saving ? "Saving settings..." : "Settings saved"}</span>
        <button
          type="button"
          onClick={handleTestNotification}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            background: testSent ? "var(--c-success, #22c55e)" : "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "none",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {testSent ? <IconCheck size={14} /> : null}
          {testSent ? "Test Notification Sent" : "Send Test Notification"}
        </button>
      </div>
    </div>
  );
};
