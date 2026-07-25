/**
 * Built-in browser for the resource pane.
 *
 * Plain <iframe> is blocked by X-Frame-Options / CSP on many sites (GitHub, etc.)
 * → blank preview. In Tauri we attach a child native Webview over this host
 * element so the page loads as a top-level document.
 *
 * Non-Tauri (dev UI only): falls back to iframe + open-external affordance.
 */

import { useEffect, useRef, useState } from "react";
import { isTauri } from "@/lib/api";
import * as api from "@/lib/api";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_DEFAULT, clampZoom } from "@/lib/embeddedBrowserZoom";
import {
  formatElapsedMs,
  pickSupportedMimeType,
  RECORDING_MIME_CANDIDATES,
} from "@/lib/recordingFormat";
import { blobToBase64 } from "@/lib/voiceAudio";
import { createT, type Locale } from "@/i18n";
import {
  IconExternalLink,
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconDevtools,
  IconCrosshair,
  IconCamera,
  IconClose,
  IconRecord,
  IconStop,
} from "@/components/icons";

const WEBVIEW_LABEL = "resource-browser";
/** Poll interval for the element picker's `eval_with_callback` round-trip. */
const PICKER_POLL_MS = 200;
/** Recording capture rate — matches the Rust loop's default/hard cap. */
const RECORDING_FPS = 7;

export interface EmbeddedBrowserProps {
  url: string;
  title?: string;
  locale?: Locale;
  /** When false, native webview is hidden (inactive tab / collapsed pane). */
  active?: boolean;
  className?: string;
  /** Fired when the user picks an element via the crosshair toolbar toggle. */
  onElementPicked?: (info: api.PickedElementInfo) => void;
  /** Fired with base64 PNG bytes after a successful screenshot capture. */
  onScreenshot?: (pngBase64: string) => void;
}

type RecordingState =
  | { phase: "idle" }
  | { phase: "recording"; id: string; startedAt: number; frameCount: number }
  | { phase: "finalizing"; frameCount: number; durationMs: number }
  | { phase: "ready"; blob: Blob; frameCount: number; durationMs: number };

function sanitizeLabel(s: string): string {
  return s.replace(/[^a-zA-Z0-9\-_:/]/g, "-").slice(0, 64) || "resource-browser";
}

async function openExternalUrl(url: string) {
  try {
    if (isTauri()) {
      const api = await import("@/lib/api");
      await api.openExternalUrl(url);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function EmbeddedBrowser({
  url,
  title,
  locale = "en",
  active = true,
  className = "",
  onElementPicked,
  onScreenshot,
}: EmbeddedBrowserProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Dynamic import type — keep loose to avoid hard coupling on Tauri version.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webviewRef = useRef<any>(null);
  const currentUrlRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const zoomRef = useRef(ZOOM_DEFAULT);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsBusy, setDevtoolsBusy] = useState(false);
  const tr = createT(locale);

  // Re-apply zoom to a freshly (re)created webview so it survives reload/URL changes.
  const applyZoom = async (factor: number) => {
    const wv = webviewRef.current;
    if (!wv || !isTauri()) return;
    try {
      await wv.setZoom(factor);
    } catch (e) {
      console.error("[EmbeddedBrowser] setZoom", e);
    }
  };

  const zoomIn = () => {
    const next = clampZoom(zoom + ZOOM_STEP);
    setZoom(next);
    zoomRef.current = next;
    void applyZoom(next);
  };
  const zoomOut = () => {
    const next = clampZoom(zoom - ZOOM_STEP);
    setZoom(next);
    zoomRef.current = next;
    void applyZoom(next);
  };
  const zoomReset = () => {
    setZoom(ZOOM_DEFAULT);
    zoomRef.current = ZOOM_DEFAULT;
    void applyZoom(ZOOM_DEFAULT);
  };

  const toggleDevtools = () => {
    if (!isTauri() || devtoolsBusy) return;
    setDevtoolsBusy(true);
    void api
      .toggleResourceDevtools()
      .then((open) => setDevtoolsOpen(open))
      .catch((e) => {
        console.error("[EmbeddedBrowser] toggleDevtools", e);
        setError(String(e));
      })
      .finally(() => setDevtoolsBusy(false));
  };

  // Element picker: hover-highlight + click-capture runs entirely inside the
  // (untrusted, arbitrary-origin) page via injected JS — no Tauri bridge
  // access is granted to that page. The host polls for a result on an
  // interval since eval_with_callback is a one-shot request/response, not a
  // push channel. See PICKER_* JS + eval_resource_webview_json in commands.rs
  // for why (capability ACL doesn't extend to non-local/remote content).
  const [picking, setPicking] = useState(false);
  const pickPollRef = useRef<number | null>(null);

  const stopPickPoll = () => {
    if (pickPollRef.current != null) {
      window.clearInterval(pickPollRef.current);
      pickPollRef.current = null;
    }
  };

  const stopPicking = (opts?: { notifyWebview?: boolean }) => {
    stopPickPoll();
    setPicking(false);
    if (opts?.notifyWebview !== false && isTauri()) {
      void api.stopResourceElementPicker().catch(() => undefined);
    }
  };

  const startPicking = () => {
    if (!isTauri() || !ready) return;
    setPicking(true);
    void api
      .startResourceElementPicker()
      .then(() => {
        stopPickPoll();
        pickPollRef.current = window.setInterval(() => {
          void api
            .pollResourceElementPick()
            .then((res) => {
              if (res.picked) {
                stopPicking({ notifyWebview: false });
                onElementPicked?.(res.picked);
              } else if (res.cancelled) {
                stopPicking({ notifyWebview: false });
              }
            })
            .catch((e) => {
              console.error("[EmbeddedBrowser] pollElementPick", e);
              stopPicking({ notifyWebview: false });
            });
        }, PICKER_POLL_MS);
      })
      .catch((e) => {
        console.error("[EmbeddedBrowser] startElementPicker", e);
        setError(String(e));
        setPicking(false);
      });
  };

  const togglePicking = () => {
    if (picking) stopPicking();
    else startPicking();
  };

  // Tear down an in-flight pick when the webview goes away (URL change,
  // reload, unmount, tab hidden) — the injected page state won't survive
  // navigation anyway, and we don't want a dangling poll interval.
  useEffect(() => {
    return () => stopPickPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (picking) stopPicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, active]);

  // Screenshot: capture the resource-browser webview's own on-screen bounds
  // (Rust resolves these live from the webview/window, no bounds need to be
  // passed from here). macOS needs Screen Recording (TCC) permission — the
  // backend detects a black/blank frame and returns a distinct error string
  // so this can show a dedicated "grant permission" notice instead of a
  // generic failure.
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState<
    { kind: "permission" | "error"; message?: string } | null
  >(null);

  const takeScreenshot = () => {
    if (!isTauri() || screenshotBusy) return;
    setScreenshotBusy(true);
    setScreenshotNotice(null);
    void api
      .captureResourceWebview()
      .then((pngBase64) => onScreenshot?.(pngBase64))
      .catch((e) => {
        const msg = String(e);
        if (msg.includes(api.SCREEN_RECORDING_PERMISSION_ERROR)) {
          setScreenshotNotice({ kind: "permission" });
        } else {
          console.error("[EmbeddedBrowser] screenshot", e);
          setScreenshotNotice({ kind: "error", message: msg });
        }
      })
      .finally(() => setScreenshotBusy(false));
  };

  // Recording: reuses the screenshot primitive in a capped-rate Rust loop
  // (start_resource_recording/stop_resource_recording in commands.rs).
  // Frames arrive as `preview:recording-frame` events (base64 JPEG); each is
  // drawn onto an offscreen <canvas> whose captureStream() feeds a
  // MediaRecorder producing a WebM blob. A terminal
  // `preview:recording-stopped` event — host-stopped, or a Rust-side
  // safeguard (~3 min / 500 frames hard cap) — finalizes the recorder.
  const [recording, setRecording] = useState<RecordingState>({ phase: "idle" });
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeRecordingIdRef = useRef<string | null>(null);
  const recordingUnlistenRef = useRef<Array<() => void>>([]);
  const [, forceElapsedTick] = useState(0);

  // Re-render every 500ms while recording so the elapsed mm:ss display ticks.
  useEffect(() => {
    if (recording.phase !== "recording") return;
    const t = window.setInterval(() => forceElapsedTick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [recording.phase]);

  const teardownRecordingListeners = () => {
    for (const un of recordingUnlistenRef.current) {
      try {
        un();
      } catch {
        /* ignore */
      }
    }
    recordingUnlistenRef.current = [];
  };

  const startRecording = () => {
    if (!isTauri() || recording.phase !== "idle") return;
    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const recordingId = await api.startResourceRecording(RECORDING_FPS);
        activeRecordingIdRef.current = recordingId;
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording({
          phase: "recording",
          id: recordingId,
          startedAt: Date.now(),
          frameCount: 0,
        });

        const unFrame = await listen<api.RecordingFrameEvent>(
          "preview:recording-frame",
          (event) => {
            const payload = event.payload;
            if (payload.recordingId !== activeRecordingIdRef.current) return;
            const canvas = recordingCanvasRef.current;
            if (!canvas) return;
            const img = new Image();
            img.onload = () => {
              if (payload.recordingId !== activeRecordingIdRef.current) return;
              if (canvas.width !== payload.width || canvas.height !== payload.height) {
                canvas.width = payload.width;
                canvas.height = payload.height;
              }
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, payload.width, payload.height);
              // Lazily start the recorder once the canvas has its real size
              // from the first frame (captureStream on a 0x0 canvas is
              // useless).
              if (!mediaRecorderRef.current) {
                try {
                  const stream = canvas.captureStream(RECORDING_FPS);
                  const mimeType = pickSupportedMimeType(
                    RECORDING_MIME_CANDIDATES,
                    (m) => window.MediaRecorder?.isTypeSupported?.(m) ?? false,
                  );
                  const recorder = new MediaRecorder(stream, { mimeType });
                  recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
                  };
                  recorder.start(1000);
                  mediaRecorderRef.current = recorder;
                } catch (e) {
                  console.error("[EmbeddedBrowser] MediaRecorder start", e);
                }
              }
            };
            img.src = "data:image/jpeg;base64," + payload.jpegBase64;
            setRecording((prev) =>
              prev.phase === "recording"
                ? { ...prev, frameCount: payload.frameIndex + 1 }
                : prev,
            );
          },
        );

        const unStopped = await listen<api.RecordingStoppedEvent>(
          "preview:recording-stopped",
          (event) => {
            const payload = event.payload;
            if (payload.recordingId !== activeRecordingIdRef.current) return;
            teardownRecordingListeners();
            activeRecordingIdRef.current = null;
            const recorder = mediaRecorderRef.current;
            setRecording((prev) => {
              const durationMs = prev.phase === "recording" ? Date.now() - prev.startedAt : 0;
              return { phase: "finalizing", frameCount: payload.frameCount, durationMs };
            });
            if (recorder && recorder.state !== "inactive") {
              recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, {
                  type: recorder.mimeType || "video/webm",
                });
                mediaRecorderRef.current = null;
                setRecording((prev) =>
                  prev.phase === "finalizing"
                    ? {
                        phase: "ready",
                        blob,
                        frameCount: prev.frameCount,
                        durationMs: prev.durationMs,
                      }
                    : prev,
                );
              };
              recorder.stop();
            } else {
              // No frames were ever captured (e.g. an immediate
              // capture_failed) — nothing to finalize.
              setRecording({ phase: "idle" });
            }
          },
        );

        recordingUnlistenRef.current = [unFrame, unStopped];
      } catch (e) {
        console.error("[EmbeddedBrowser] startRecording", e);
        setRecording({ phase: "idle" });
        setRecordingNotice(tr("resources.recordFailed"));
        window.setTimeout(() => setRecordingNotice(null), 3200);
      }
    })();
  };

  const stopRecording = () => {
    const id = activeRecordingIdRef.current;
    if (!id) return;
    void api.stopResourceRecording(id).catch((e) => {
      console.error("[EmbeddedBrowser] stopRecording", e);
    });
  };

  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);

  const saveCurrentRecording = () => {
    if (recording.phase !== "ready") return;
    const { blob } = recording;
    void (async () => {
      try {
        const b64 = await blobToBase64(blob);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const path = await api.saveRecording(b64, `recording-${stamp}.webm`);
        setRecording({ phase: "idle" });
        if (path) {
          setRecordingNotice(tr("resources.recordSaved"));
          window.setTimeout(() => setRecordingNotice(null), 2200);
        }
      } catch (e) {
        console.error("[EmbeddedBrowser] saveRecording", e);
        setRecordingNotice(tr("resources.recordSaveFailed"));
        window.setTimeout(() => setRecordingNotice(null), 3200);
      }
    })();
  };

  const discardCurrentRecording = () => {
    setRecording({ phase: "idle" });
  };

  // Best-effort stop of any in-flight recording on unmount / URL change /
  // hide. The Rust loop also auto-stops on its own safeguards regardless,
  // so this is a UX nicety (stop promptly) rather than a safety requirement.
  useEffect(() => {
    return () => {
      teardownRecordingListeners();
      const id = activeRecordingIdRef.current;
      if (id) void api.stopResourceRecording(id).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = activeRecordingIdRef.current;
    if (id) void api.stopResourceRecording(id).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, active]);

  // Layout → native webview bounds
  const syncBounds = async () => {
    const el = hostRef.current;
    const wv = webviewRef.current;
    if (!el || !wv || !isTauri()) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      try {
        await wv.hide();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
      await wv.setPosition(new LogicalPosition(rect.left, rect.top));
      await wv.setSize(new LogicalSize(rect.width, rect.height));
      if (active) await wv.show();
      else await wv.hide();
    } catch (e) {
      console.error("[EmbeddedBrowser] syncBounds", e);
    }
  };

  // Create / recreate native webview when URL changes (Tauri only)
  useEffect(() => {
    if (!isTauri() || !active) return;
    const target = url.trim();
    if (!target) return;

    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let roFrame = 0;

    const boot = async () => {
      setError(null);
      setReady(false);
      try {
        const { Webview } = await import("@tauri-apps/api/webview");
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
        const win = getCurrentWindow();

        // Tear down previous instance (URL change or remount)
        const existing = await Webview.getByLabel(WEBVIEW_LABEL);
        if (existing) {
          try {
            await existing.close();
          } catch {
            /* ignore */
          }
        }
        webviewRef.current = null;
        currentUrlRef.current = "";

        if (cancelled) return;

        const el = hostRef.current;
        const rect = el?.getBoundingClientRect();
        const x = rect?.left ?? 0;
        const y = rect?.top ?? 0;
        const w = Math.max(rect?.width ?? 320, 40);
        const h = Math.max(rect?.height ?? 240, 40);

        const webview = new Webview(win, sanitizeLabel(WEBVIEW_LABEL), {
          url: target,
          x,
          y,
          width: w,
          height: h,
          focus: true,
          // Accept any remote page; child is a real top-level document
          acceptFirstMouse: true,
        });

        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(
            () => reject(new Error("webview create timeout")),
            8000,
          );
          void webview.once("tauri://created", () => {
            window.clearTimeout(t);
            resolve();
          });
          void webview.once("tauri://error", (e) => {
            window.clearTimeout(t);
            reject(e.payload ?? e);
          });
        });

        if (cancelled) {
          try {
            await webview.close();
          } catch {
            /* ignore */
          }
          return;
        }

        webviewRef.current = webview;
        currentUrlRef.current = target;
        await webview.setPosition(new LogicalPosition(x, y));
        await webview.setSize(new LogicalSize(w, h));
        await webview.show();
        setReady(true);
        setDevtoolsOpen(false);
        if (zoomRef.current !== ZOOM_DEFAULT) {
          void applyZoom(zoomRef.current);
        }

        // Keep bounds aligned with the host pane; hide when host not visible
        // (aside collapsed, zero-size, covered).
        if (hostRef.current && typeof ResizeObserver !== "undefined") {
          resizeObs = new ResizeObserver(() => {
            cancelAnimationFrame(roFrame);
            roFrame = requestAnimationFrame(() => {
              void syncBounds();
            });
          });
          resizeObs.observe(hostRef.current);
        }
        if (hostRef.current && typeof IntersectionObserver !== "undefined") {
          const io = new IntersectionObserver(
            (entries) => {
              const vis = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.05);
              const wv = webviewRef.current;
              if (!wv) return;
              if (!vis || !active) void wv.hide().catch(() => undefined);
              else void syncBounds();
            },
            { threshold: [0, 0.05, 0.5, 1] },
          );
          io.observe(hostRef.current);
          // stash on resizeObs cleanup via disconnect of both
          (resizeObs as unknown as { _io?: IntersectionObserver })._io = io;
        }
        window.addEventListener("resize", syncBounds);
      } catch (e) {
        if (!cancelled) {
          console.error("[EmbeddedBrowser] create failed", e);
          setError(String(e));
          setReady(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(roFrame);
      resizeObs?.disconnect();
      const io = (resizeObs as unknown as { _io?: IntersectionObserver } | null)?._io;
      io?.disconnect();
      window.removeEventListener("resize", syncBounds);
      const wv = webviewRef.current;
      webviewRef.current = null;
      currentUrlRef.current = "";
      if (wv) {
        void wv.close().catch(() => undefined);
      } else if (isTauri()) {
        void import("@tauri-apps/api/webview")
          .then(({ Webview }) => Webview.getByLabel(WEBVIEW_LABEL))
          .then((w) => w?.close())
          .catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, active]);

  // Hide/show when active toggles without URL change
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !isTauri()) return;
    if (active) {
      void syncBounds().then(() => wv.show()).catch(() => undefined);
    } else {
      void wv.hide().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openExternal = () => {
    void openExternalUrl(url);
  };

  const reload = () => {
    // Force recreate by remounting effect: clear then set same url via key is parent job.
    // Local: close + recreate
    if (!isTauri()) return;
    const u = url;
    void (async () => {
      try {
        const { Webview } = await import("@tauri-apps/api/webview");
        const w = await Webview.getByLabel(WEBVIEW_LABEL);
        if (w) await w.close();
      } catch {
        /* ignore */
      }
      webviewRef.current = null;
      currentUrlRef.current = "";
      // Trigger effect by bumping a dummy state through recreating with same url —
      // parent should change key; as fallback re-run boot by toggling ready
      setReady(false);
      setError(null);
      // Manual recreate
      const el = hostRef.current;
      if (!el) return;
      try {
        const { Webview } = await import("@tauri-apps/api/webview");
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
        const rect = el.getBoundingClientRect();
        const webview = new Webview(getCurrentWindow(), WEBVIEW_LABEL, {
          url: u,
          x: rect.left,
          y: rect.top,
          width: Math.max(rect.width, 40),
          height: Math.max(rect.height, 40),
          focus: true,
        });
        await new Promise<void>((resolve, reject) => {
          void webview.once("tauri://created", () => resolve());
          void webview.once("tauri://error", (e) => reject(e));
        });
        webviewRef.current = webview;
        await webview.setPosition(new LogicalPosition(rect.left, rect.top));
        await webview.setSize(
          new LogicalSize(Math.max(rect.width, 40), Math.max(rect.height, 40)),
        );
        await webview.show();
        setReady(true);
        setDevtoolsOpen(false);
        if (zoomRef.current !== ZOOM_DEFAULT) {
          void applyZoom(zoomRef.current);
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  };

  // Non-Tauri: iframe (many sites blank — surface open external)
  if (!isTauri()) {
    return (
      <div className={"embedded-browser " + className}>
        <div className="embedded-browser__bar">
          <span className="embedded-browser__url" title={url}>
            {url}
          </span>
          <button
            type="button"
            className="chrome-btn"
            onClick={openExternal}
            title={tr("resources.openExternal")}
          >
            <IconExternalLink size={14} />
          </button>
        </div>
        <iframe
          className="rp-preview__frame rp-preview__frame--browser"
          title={title || url}
          src={url}
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
        <div className="embedded-browser__hint">
          {tr("resources.browserIframeHint")}
        </div>
      </div>
    );
  }

  return (
    <div className={"embedded-browser embedded-browser--native " + className}>
      <div className="embedded-browser__bar">
        <span className="embedded-browser__url" title={url}>
          {url}
        </span>
        <button
          type="button"
          className="chrome-btn"
          onClick={reload}
          title={tr("resources.browserReload")}
        >
          <IconRefresh size={14} />
        </button>
        <button
          type="button"
          className="chrome-btn"
          onClick={openExternal}
          title={tr("resources.openExternal")}
        >
          <IconExternalLink size={14} />
        </button>
        <span className="embedded-browser__sep" aria-hidden />
        <button
          type="button"
          className="chrome-btn"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          title={tr("resources.zoomOut")}
        >
          <IconZoomOut size={14} />
        </button>
        <span className="embedded-browser__zoom-label" aria-hidden>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="chrome-btn"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          title={tr("resources.zoomIn")}
        >
          <IconZoomIn size={14} />
        </button>
        <button
          type="button"
          className="chrome-btn"
          onClick={zoomReset}
          disabled={zoom === ZOOM_DEFAULT}
          title={tr("resources.zoomReset")}
        >
          <IconZoomReset size={14} />
        </button>
        <button
          type="button"
          className={"chrome-btn" + (devtoolsOpen ? " is-active" : "")}
          onClick={toggleDevtools}
          disabled={devtoolsBusy}
          title={devtoolsOpen ? tr("resources.devtoolsClose") : tr("resources.devtoolsOpen")}
        >
          <IconDevtools size={14} />
        </button>
        <button
          type="button"
          className={"chrome-btn" + (picking ? " is-active" : "")}
          onClick={togglePicking}
          disabled={!ready}
          title={picking ? tr("resources.pickElementActive") : tr("resources.pickElement")}
        >
          <IconCrosshair size={14} />
        </button>
        <button
          type="button"
          className="chrome-btn"
          onClick={takeScreenshot}
          disabled={!ready || screenshotBusy}
          title={tr("resources.screenshot")}
        >
          <IconCamera size={14} />
        </button>
        {recording.phase === "recording" ? (
          <>
            <span className="embedded-browser__rec-elapsed">
              {formatElapsedMs(Date.now() - recording.startedAt)}
            </span>
            <button
              type="button"
              className="chrome-btn is-active"
              onClick={stopRecording}
              title={tr("resources.recordStop")}
            >
              <IconStop size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="chrome-btn"
            onClick={startRecording}
            disabled={!ready || recording.phase !== "idle"}
            title={tr("resources.recordStart")}
          >
            <IconRecord size={14} />
          </button>
        )}
      </div>
      <canvas ref={recordingCanvasRef} className="embedded-browser__rec-canvas" aria-hidden />
      {recording.phase === "ready" ? (
        <div className="embedded-browser__notice" role="status">
          <span>
            {tr("resources.recordSave")} — {formatElapsedMs(recording.durationMs)} ·{" "}
            {recording.frameCount}f
          </span>
          <button type="button" className="chrome-btn" onClick={saveCurrentRecording}>
            {tr("resources.recordSave")}
          </button>
          <button type="button" className="chrome-btn" onClick={discardCurrentRecording}>
            {tr("resources.recordDiscard")}
          </button>
        </div>
      ) : null}
      {recordingNotice ? (
        <div className="embedded-browser__notice" role="status">
          <span>{recordingNotice}</span>
        </div>
      ) : null}
      {screenshotNotice ? (
        <div
          className={
            "embedded-browser__notice" +
            (screenshotNotice.kind === "permission" ? " embedded-browser__notice--permission" : "")
          }
          role="alert"
        >
          <span>
            {screenshotNotice.kind === "permission"
              ? tr("resources.screenshotPermission")
              : tr("resources.screenshotFailed")}
          </span>
          <button
            type="button"
            className="chrome-btn"
            onClick={takeScreenshot}
            title={tr("resources.screenshot")}
          >
            <IconRefresh size={13} />
          </button>
          <button
            type="button"
            className="chrome-btn"
            onClick={() => setScreenshotNotice(null)}
            title={tr("image.close")}
          >
            <IconClose size={13} />
          </button>
        </div>
      ) : null}
      {/* Host rectangle — native webview is painted on top of this area */}
      <div
        ref={hostRef}
        className="embedded-browser__host"
        data-ready={ready ? "1" : "0"}
        aria-label={title || url}
      >
        {error ? (
          <div className="rp-preview__msg" role="alert">
            <p>{tr("resources.browserFailed")}</p>
            <p className="embedded-browser__err">{error}</p>
            <button type="button" className="btn btn--primary" onClick={openExternal}>
              {tr("resources.openExternal")}
            </button>
          </div>
        ) : !ready ? (
          <div className="rp-preview__msg">{tr("resources.loading")}</div>
        ) : (
          <div className="embedded-browser__host-fill" aria-hidden />
        )}
      </div>
    </div>
  );
}
