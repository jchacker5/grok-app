import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureNotifyPermission,
  getNotifyPermission,
  notificationSupport,
  showDesktopNotification,
} from "./desktopNotify";

const originalNotification = globalThis.Notification;
const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  if (originalNotification) {
    globalThis.Notification = originalNotification;
  } else {
    // @ts-expect-error cleanup mock
    delete globalThis.Notification;
  }
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  vi.restoreAllMocks();
  vi.doUnmock("@tauri-apps/plugin-notification");
  vi.doUnmock("@tauri-apps/api/window");
});

describe("desktopNotify (browser / non-Tauri fallback)", () => {
  it("reports unsupported when Notification is missing", async () => {
    // @ts-expect-error test
    delete globalThis.Notification;
    expect(notificationSupport()).toBe("unsupported");
    expect(await showDesktopNotification({ title: "x" })).toBe(false);
  });

  it("returns current permission when present", () => {
    const ctor = vi.fn();
    Object.defineProperty(ctor, "permission", {
      value: "granted",
      configurable: true,
    });
    Object.defineProperty(ctor, "requestPermission", {
      value: vi.fn(),
      configurable: true,
    });
    globalThis.Notification = ctor as unknown as typeof Notification;
    expect(notificationSupport()).toBe("granted");
  });

  it("requests permission only when default", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const ctor = vi.fn();
    Object.defineProperty(ctor, "permission", {
      value: "default",
      configurable: true,
    });
    Object.defineProperty(ctor, "requestPermission", {
      value: requestPermission,
      configurable: true,
    });
    globalThis.Notification = ctor as unknown as typeof Notification;
    await ensureNotifyPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("constructs Notification when granted and forced", async () => {
    const ctor = vi.fn();
    Object.defineProperty(ctor, "permission", {
      value: "granted",
      configurable: true,
    });
    Object.defineProperty(ctor, "requestPermission", {
      value: vi.fn(),
      configurable: true,
    });
    globalThis.Notification = ctor as unknown as typeof Notification;
    const ok = await showDesktopNotification({
      title: "Agent finished",
      body: "Session ready",
      force: true,
      tag: "turn-done",
    });
    expect(ok).toBe(true);
    expect(ctor).toHaveBeenCalledWith("Agent finished", {
      body: "Session ready",
      tag: "turn-done",
      silent: false,
    });
  });

  it("does not notify when denied", async () => {
    const ctor = vi.fn();
    Object.defineProperty(ctor, "permission", {
      value: "denied",
      configurable: true,
    });
    Object.defineProperty(ctor, "requestPermission", {
      value: vi.fn(),
      configurable: true,
    });
    globalThis.Notification = ctor as unknown as typeof Notification;
    expect(
      await showDesktopNotification({ title: "x", force: true }),
    ).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });
});

describe("desktopNotify (Tauri native bridge)", () => {
  beforeEach(() => {
    // Make `isTauri()` (checked via `window.__TAURI_INTERNALS__`) resolve true.
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {},
    };
  });

  it("uses the plugin bridge and skips native prompt when not forced and window is focused", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(true);
    const requestPermission = vi.fn();
    const sendNotification = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification,
    }));
    const isFocused = vi.fn().mockResolvedValue(true);
    vi.doMock("@tauri-apps/api/window", () => ({
      getCurrentWindow: () => ({ isFocused }),
    }));

    const ok = await showDesktopNotification({ title: "Turn done" });
    expect(ok).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(isFocused).toHaveBeenCalledOnce();
  });

  it("sends a native notification when unfocused and permission already granted", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(true);
    const requestPermission = vi.fn();
    const sendNotification = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification,
    }));
    const isFocused = vi.fn().mockResolvedValue(false);
    vi.doMock("@tauri-apps/api/window", () => ({
      getCurrentWindow: () => ({ isFocused }),
    }));

    const ok = await showDesktopNotification({
      title: "Turn done",
      body: "Session ready",
    });
    expect(ok).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith({
      title: "Turn done",
      body: "Session ready",
    });
  });

  it("requests permission through the plugin when not yet granted, and bypasses focus check when forced", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(false);
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const sendNotification = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification,
    }));
    const isFocused = vi.fn().mockResolvedValue(true);
    vi.doMock("@tauri-apps/api/window", () => ({
      getCurrentWindow: () => ({ isFocused }),
    }));

    const ok = await showDesktopNotification({
      title: "Permission needed",
      force: true,
    });
    expect(ok).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(isFocused).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith({
      title: "Permission needed",
      body: undefined,
    });
  });

  it("does not notify when the plugin denies permission", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(false);
    const requestPermission = vi.fn().mockResolvedValue("denied");
    const sendNotification = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification,
    }));
    vi.doMock("@tauri-apps/api/window", () => ({
      getCurrentWindow: () => ({ isFocused: vi.fn().mockResolvedValue(false) }),
    }));

    const ok = await showDesktopNotification({ title: "x", force: true });
    expect(ok).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("getNotifyPermission reflects the plugin's granted state without prompting", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(true);
    const requestPermission = vi.fn();
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification: vi.fn(),
    }));

    expect(await getNotifyPermission()).toBe("granted");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("getNotifyPermission reports 'default' (not denied) when not yet granted", async () => {
    const isPermissionGranted = vi.fn().mockResolvedValue(false);
    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission: vi.fn(),
      sendNotification: vi.fn(),
    }));

    expect(await getNotifyPermission()).toBe("default");
  });
});
