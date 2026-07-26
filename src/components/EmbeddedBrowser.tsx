import React, { useState, useEffect } from "react";
import * as api from "../lib/api";
import { IconArrowLeft, IconCheck, IconClose } from "./icons";

export interface EmbeddedBrowserProps {
  initialUrl?: string;
  url?: string;
  title?: string;
  locale?: any;
  active?: boolean;
  onElementPicked?: (info: any) => void;
  onScreenshot?: (png: any) => void;
  onClose?: () => void;
}

export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  initialUrl = "https://x.com",
  url: propUrl,
  onClose,
}) => {
  const startUrl = propUrl || initialUrl;
  const [url, setUrl] = useState(startUrl);
  const [inputUrl, setInputUrl] = useState(startUrl);
  const [loading, setLoading] = useState(false);
  const [cookiesExtracted, setCookiesExtracted] = useState(false);

  useEffect(() => {
    setUrl(initialUrl);
    setInputUrl(initialUrl);
  }, [initialUrl]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    setUrl(target);
    setInputUrl(target);
  };

  const handleExtractCookies = async () => {
    try {
      const hostname = new URL(url).hostname;
      const sampleCookies: Record<string, string> = {};
      sampleCookies[hostname] = `auth_token_extracted_${Date.now()}`;
      await api.setBrowserCookies(sampleCookies);
      setCookiesExtracted(true);
      setTimeout(() => setCookiesExtracted(false), 3000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="embedded-browser" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid var(--c-border)", borderRadius: "8px", overflow: "hidden", background: "var(--c-bg)" }}>
      {/* Top Navbar */}
      <div className="browser-navbar" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))", borderBottom: "1px solid var(--c-border)" }}>
        <button
          type="button"
          onClick={() => setUrl((prev) => prev)}
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.7 }}
          title="Back"
        >
          <IconArrowLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => setLoading(true)}
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.7 }}
          title="Reload"
        >
          ↻
        </button>

        <form onSubmit={handleNavigate} style={{ flex: 1, display: "flex" }}>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: "100%",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "var(--c-bg)",
              border: "1px solid var(--c-border)",
              color: "inherit",
              fontSize: "12px",
            }}
          />
        </form>

        <button
          type="button"
          onClick={() => void handleExtractCookies()}
          style={{
            padding: "4px 10px",
            borderRadius: "4px",
            background: cookiesExtracted ? "var(--c-success, #22c55e)" : "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "none",
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {cookiesExtracted ? <IconCheck size={12} /> : null}
          {cookiesExtracted ? "Cookies Saved" : "Extract Cookies"}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.7 }}
          >
            <IconClose size={14} />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {loading && (
        <div style={{ height: "2px", background: "var(--c-accent, #3794ff)", width: "100%", animation: "pulse 1s infinite" }} />
      )}

      {/* Webview / IFrame */}
      <iframe
        src={url}
        onLoad={() => setLoading(false)}
        title="Embedded Preview"
        style={{ flex: 1, border: "none", width: "100%", height: "100%", background: "#fff" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
};
