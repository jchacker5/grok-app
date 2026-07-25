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
