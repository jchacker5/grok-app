import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as api from "@/lib/api";
import { createT, type Locale } from "@/i18n";

type TerminalOutputPayload = {
  id: string;
  chunk: string;
};

type TerminalExitPayload = {
  id: string;
};

export interface TerminalHostProps {
  terminalId: string;
  spawned: boolean;
  cwd?: string;
  locale: Locale;
  onSpawned: (id: string) => void;
}

export function TerminalHost({
  terminalId,
  spawned,
  cwd,
  locale,
  onSpawned,
}: TerminalHostProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const onSpawnedRef = useRef(onSpawned);
  onSpawnedRef.current = onSpawned;
  const [status, setStatus] = useState<"running" | "exited" | "error">(
    "running",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      scrollback: 5_000,
      theme: {
        background: "#0d0d0d",
        foreground: "#e7e7e7",
        cursor: "#f5f5f5",
        selectionBackground: "#3a587a",
      },
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(host);
    xtermRef.current = xterm;

    const resizeTerminal = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
        if (xterm.cols > 0 && xterm.rows > 0) {
          void api
            .terminalResize(terminalId, xterm.cols, xterm.rows)
            .catch(() => undefined);
        }
      } catch {
        // The host can briefly have zero bounds during pane transitions.
      }
    };

    const resizeObserver = new ResizeObserver(resizeTerminal);
    resizeObserver.observe(host);
    const dataSubscription = xterm.onData((data: string) => {
      void api.terminalWrite(terminalId, data).catch((cause) => {
        if (!disposed) {
          setStatus("error");
          setError(String(cause));
        }
      });
    });

    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        if (disposed) return;
        try {
          let snapshot: string;
          if (spawned) {
            snapshot = await api.terminalSnapshot(terminalId);
          } else {
            const id = await api.terminalSpawn(
              cwd ?? null,
              Math.max(1, xterm.cols),
              Math.max(1, xterm.rows),
              terminalId,
            );
            onSpawnedRef.current(id);
            snapshot = await api.terminalSnapshot(id);
          }
          if (!disposed) {
            if (snapshot) xterm.write(snapshot);
            setStatus("running");
            resizeTerminal();
            xterm.focus();
          }

          unlistenOutput = await listen<TerminalOutputPayload>(
            "terminal://output",
            (event) => {
              if (!disposed && event.payload.id === terminalId) {
                xterm.write(event.payload.chunk);
              }
            },
          );
          unlistenExit = await listen<TerminalExitPayload>(
            "terminal://exit",
            (event) => {
              if (!disposed && event.payload.id === terminalId) {
                setStatus("exited");
              }
            },
          );
          if (disposed) {
            unlistenOutput?.();
            unlistenExit?.();
          }
        } catch (cause) {
          if (!disposed) {
            const message = String(cause);
            if (spawned && message.includes("terminal not found")) {
              setStatus("exited");
            } else {
              setStatus("error");
              setError(message);
            }
          }
        }
      })
      .catch((cause) => {
        if (!disposed) {
          setStatus("error");
          setError(String(cause));
        }
      });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataSubscription.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      xtermRef.current = null;
      xterm.dispose();
    };
    // `spawned` flips to true after this effect creates the PTY; restarting the
    // effect then would briefly detach the live stream. A real remount receives
    // the persisted true value and takes the snapshot branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, terminalId]);

  const kill = () => {
    void api
      .terminalKill(terminalId)
      .then(() => setStatus("exited"))
      .catch((cause) => {
        setStatus("error");
        setError(String(cause));
      });
  };

  return (
    <div className="terminal-host">
      <div className="terminal-host__bar">
        <span className="terminal-host__status">
          {status === "exited"
            ? tr("terminal.exited")
            : status === "error"
              ? `${tr("terminal.spawnFailed")}: ${error ?? ""}`
              : cwd || tr("terminal.tabTitle")}
        </span>
        <button
          type="button"
          className="chrome-btn"
          onClick={() => xtermRef.current?.clear()}
        >
          {tr("terminal.clear")}
        </button>
        <button
          type="button"
          className="chrome-btn"
          disabled={status === "exited"}
          onClick={kill}
        >
          {tr("terminal.kill")}
        </button>
      </div>
      <div
        ref={hostRef}
        className="terminal-host__host"
        aria-label={tr("terminal.tabTitle")}
      />
    </div>
  );
}
