/**
 * Lightweight desktop notification helper.
 *
 * Prefers the native `tauri-plugin-notification` bridge (real OS notification
 * center) when running under Tauri. Falls back to the Web Notification API
 * for browser / `vite dev` preview mode, where no Tauri IPC bridge exists.
 * Always safe to call — fails closed to `false` without throwing.
 */

import { isTauri } from "./api";

export type DesktopNotifyOptions = {
  title: string;
  body?: string;
  /** When false, skip if the window has focus (default true = always try). */
  force?: boolean;
  tag?: string;
};

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

function notificationCtor(): typeof Notification | null {
  if (typeof globalThis === "undefined") return null;
  const N = (globalThis as { Notification?: typeof Notification }).Notification;
  if (typeof N !== "function") return null;
  return N;
}

/** Browser-only synchronous permission check (Web Notification API). */
export function notificationSupport(): NotifyPermission {
  const N = notificationCtor();
  if (!N) return "unsupported";
  const perm = N.permission;
  if (perm === "granted" || perm === "denied" || perm === "default") {
    return perm;
  }
  return "unsupported";
}

async function loadTauriNotification() {
  return import("@tauri-apps/plugin-notification");
}

function normalizePermission(p: unknown): NotifyPermission {
  return p === "granted" || p === "denied" || p === "default" ? p : "unsupported";
}

/**
 * Current permission status without prompting the user.
 * Async because the Tauri plugin bridge requires an IPC round-trip; the web
 * fallback resolves immediately.
 */
export async function getNotifyPermission(): Promise<NotifyPermission> {
  if (isTauri()) {
    try {
      const { isPermissionGranted } = await loadTauriNotification();
      return (await isPermissionGranted()) ? "granted" : "default";
    } catch {
      return "unsupported";
    }
  }
  return notificationSupport();
}

/** Request permission once; no-op when already decided or unavailable. */
export async function ensureNotifyPermission(): Promise<NotifyPermission> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission } = await loadTauriNotification();
      if (await isPermissionGranted()) return "granted";
      return normalizePermission(await requestPermission());
    } catch {
      return "unsupported";
    }
  }
  const status = notificationSupport();
  if (status !== "default") return status;
  const N = notificationCtor();
  if (!N?.requestPermission) return "unsupported";
  try {
    return normalizePermission(await N.requestPermission());
  } catch {
    return "unsupported";
  }
}

/**
 * Show a system notification when permission is granted.
 * Returns true only when a notification was actually dispatched.
 * Prefers the native OS notification center via `tauri-plugin-notification`;
 * falls back to the browser `Notification` API outside Tauri.
 */
export async function showDesktopNotification(
  opts: DesktopNotifyOptions,
): Promise<boolean> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await loadTauriNotification();
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === "granted";
      }
      if (!granted) return false;
      if (!opts.force) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const focused = await getCurrentWindow().isFocused();
        if (focused) {
          // App is in front — prefer in-app toast; caller can pass force=true.
          return false;
        }
      }
      sendNotification({ title: opts.title, body: opts.body });
      return true;
    } catch {
      return false;
    }
  }

  if (notificationSupport() !== "granted") return false;
  if (!opts.force && typeof document !== "undefined" && document.hasFocus()) {
    // App is in front — prefer in-app toast; caller can pass force=true.
    return false;
  }
  const N = notificationCtor();
  if (!N) return false;
  try {
    // eslint-disable-next-line no-new
    new N(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}

/** Convenience: request permission (if needed) then show. */
export async function notifyDesktop(
  opts: DesktopNotifyOptions,
): Promise<boolean> {
  await ensureNotifyPermission();
  return showDesktopNotification(opts);
}

/**
 * Whether `now` falls inside the `[start, end)` Do Not Disturb window.
 * Times are "HH:MM" 24-hour, compared against local wall-clock time —
 * quiet hours are evaluated client-side against the system timezone, not
 * synced across machines. Handles windows that wrap past midnight
 * (e.g. 22:00–08:00). Malformed times fail open (never quiet).
 */
export function isWithinQuietHours(
  start: string,
  end: string,
  now: Date = new Date(),
): boolean {
  const toMinutes = (hhmm: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null || e == null || s === e) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Play a brief synthesized chime (no audio asset — a short sine-wave beep
 * via the Web Audio API) alongside a desktop notification. Best-effort:
 * silently no-ops if Web Audio is unavailable or blocked.
 */
export function playNotifySound(): void {
  try {
    const Ctx = (
      globalThis as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
    ).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    sharedAudioCtx ??= new Ctx();
    const ctx = sharedAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Best-effort only — never let a chime failure surface to the caller.
  }
}
