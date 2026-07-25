import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@/lib/api";
import * as api from "@/lib/api";
import { IconClose, IconRefresh } from "@/components/icons";
import type { Locale, MessageKey } from "@/i18n";
import { t } from "@/i18n";

export type CliUpdateBannerProps = {
  locale: Locale;
  enabled: boolean;
  onDismiss: () => void;
};

type BannerState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; current: string | null; latest: string }
  | { kind: "confirm-win"; latest: string }
  | { kind: "installing"; phase: string; percent: number }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Windows SmartScreen may flag the freshly downloaded, unsigned binary. */
const isWindows =
  typeof navigator !== "undefined" &&
  /win/i.test(navigator.userAgent) &&
  !/mac/i.test(navigator.userAgent);

type InstallProgress = {
  phase: string;
  message: string;
  percent: number | null;
};

export function CliUpdateBanner({ locale, enabled, onDismiss }: CliUpdateBannerProps) {
  const tt = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars),
    [locale],
  );
  const [state, setState] = useState<BannerState>({ kind: "idle" });
  const progRef = useRef<InstallProgress>({ phase: "", message: "", percent: null });

  // Check for updates on mount if enabled
  useEffect(() => {
    if (!enabled || !isTauri()) return;
    let cancelled = false;
    setState({ kind: "checking" });
    api
      .cliCheckUpdate()
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setState({ kind: "error", message: result.error });
          return;
        }
        if (result.updateAvailable && result.latestVersion) {
          setState({
            kind: "available",
            current: result.currentVersion,
            latest: result.latestVersion,
          });
        } else {
          setState({ kind: "idle" });
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: String(e) });
      });
    return () => { cancelled = true; };
  }, [enabled]);

  // Listen for install progress
  useEffect(() => {
    if (!isTauri()) return;
    let unsub: (() => void) | null = null;
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen<api.CliInstallProgress>("setup://cli-install-progress", (e) => {
          progRef.current = {
            phase: e.payload.phase,
            message: e.payload.message,
            percent: e.payload.percent ?? null,
          };
          setState({
            kind: "installing",
            phase: e.payload.phase,
            percent: e.payload.percent ?? 0,
          });
        }).then((u) => { unsub = u; });
      })
      .catch(() => {});
    return () => { unsub?.(); };
  }, []);

  // On Windows, warn about SmartScreen before downloading + running the update.
  const requestUpdate = () => {
    if (isWindows) {
      setState((s) =>
        s.kind === "available"
          ? { kind: "confirm-win", latest: s.latest }
          : s,
      );
      return;
    }
    void handleUpdate();
  };

  const handleUpdate = async () => {
    setState({ kind: "installing", phase: "starting", percent: 0 });
    try {
      const result = await api.cliInstallLatest();
      if (result.ok) {
        setState({ kind: "done" });
        // Auto-dismiss after 4 seconds
        setTimeout(() => onDismiss(), 4000);
      } else {
        setState({ kind: "error", message: result.message });
      }
    } catch (e) {
      setState({ kind: "error", message: String(e) });
    }
  };

  if (state.kind === "idle" || state.kind === "checking" || state.kind === "done") return null;

  return (
    <div className="cli-update-banner">
      <div className="cli-update-banner__body">
        {state.kind === "available" && (
          <>
            <IconRefresh size={14} className="cli-update-banner__icon" />
            <span className="cli-update-banner__text">
              {tt("cli.updateAvailable", { v: state.latest })}
            </span>
            <button
              type="button"
              className="cli-update-banner__action"
              onClick={requestUpdate}
            >
              {tt("cli.updateNow")}
            </button>
          </>
        )}
        {state.kind === "confirm-win" && (
          <>
            <span className="cli-update-banner__text cli-update-banner__text--warn">
              {tt("cli.winSmartScreenWarn")}
            </span>
            <button
              type="button"
              className="cli-update-banner__action"
              onClick={() => void handleUpdate()}
            >
              {tt("cli.updateProceed")}
            </button>
          </>
        )}
        {state.kind === "installing" && (
          <>
            <span className="cli-update-banner__text">
              {tt("cli.installing")} {state.percent > 0 && `(${Math.round(state.percent)}%)`}
            </span>
            {state.percent > 0 && (
              <div className="cli-update-banner__bar">
                <div
                  className="cli-update-banner__bar-fill"
                  style={{ width: `${Math.round(state.percent)}%` }}
                />
              </div>
            )}
          </>
        )}
        {state.kind === "error" && (
          <>
            <span className="cli-update-banner__text cli-update-banner__text--error">
              {tt("cli.updateError")}: {state.message}
            </span>
            <button
              type="button"
              className="cli-update-banner__retry"
              onClick={() => void handleUpdate()}
            >
              {tt("cli.retry")}
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="cli-update-banner__dismiss"
        aria-label={tt("cli.dismiss")}
        onClick={onDismiss}
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}
