/**
 * Full-page settings shell (ChatGPT-desktop style): left nav + content.
 * Back control returns to the workbench ("Back to app").
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Select } from "@/components/Select";
import {
  IconArchive,
  IconAppearance,
  IconArrowLeft,
  IconBell,
  IconCheck,
  IconDevtools,
  IconDoctor,
  IconHeadset,
  IconInfo,
  IconLanguage,
  IconMinimize,
  IconPuzzle,
  IconSearch,
  IconSettings,
  IconShield,
  IconTrash,
  IconTunnel,
  IconUser,
  IconWindows,
} from "@/components/icons";
import {
  ensureNotifyPermission,
  getNotifyPermission,
  showDesktopNotification,
  type NotifyPermission,
} from "@/lib/desktopNotify";
import type { SessionPreset } from "@/lib/types";
import {
  formatLoopbackAcpAddr,
  isLoopbackAcpAddr,
  isValidPort,
  validateSshTarget,
} from "@/lib/sshTunnel";
import type { Theme } from "@/lib/theme";
import type {
  ComposerPrefsScope,
  ModelOption,
  PermissionPolicyId,
} from "@/lib/grokCatalog";
import {
  COMPOSER_PREFS_SCOPES,
  PERMISSION_POLICIES,
} from "@/lib/grokCatalog";
import type { AccountStatus, DetectedEditor } from "@/lib/api";
import * as api from "@/lib/api";
import { AccountPanel } from "@/components/AccountPanel";
import { ProvidersPanel } from "@/components/ProvidersPanel";
import { ExtensionsPanel } from "@/components/ExtensionsPanel";
import { ProjectInspectPanel } from "@/components/ProjectInspectPanel";
import { NotificationSettingsSection } from "@/components/NotificationSettingsSection";
import { GitHubIntegrationSection } from "@/components/GitHubIntegrationSection";
import { SyncSettingsSection } from "@/components/SyncSettingsSection";
import { getUserOverrides } from "@/lib/keybindings";
import {
  createT,
  resolveLocale,
  type MessageKey,
  type Vars,
} from "@/i18n";

export type SettingsSectionId =
  | "general"
  | "appearance"
  | "account"
  | "voice"
  | "archived"
  | "extensions"
  | "runtime"
  | "about";

export type ArchivedSessionRow = {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
};

export type ArchivedProjectGroup = {
  id: string | null;
  name: string;
  sessions: ArchivedSessionRow[];
};

export interface SettingsPageProps {
  section: SettingsSectionId;
  onSection: (id: SettingsSectionId) => void;
  onBack: () => void;
  labels: Record<string, string>;
  locale: string;
  onLocale: (v: string) => void;
  theme: Theme;
  onTheme: (v: Theme) => void;
  sessionDataMode: string;
  onSessionDataMode: (v: string) => void;
  /** After importing CLI sessions (shared mode) — refresh sidebar. */
  onCliSessionsImported?: () => void;
  /**
   * After a successful full-settings import (Export/Import settings panel) —
   * reload all in-memory app state from disk so the UI reflects the
   * imported values immediately, without requiring a restart.
   */
  onSettingsImported?: () => void;
  policy: string;
  onPolicy: (v: PermissionPolicyId) => void;
  /** Where model / permission choices are remembered. */
  prefsScope?: ComposerPrefsScope | string;
  onPrefsScope?: (v: ComposerPrefsScope) => void;
  /** Live valid models (for display only in settings). */
  availableModels?: ModelOption[];
  manualCliPath: string;
  onManualCliPath: (v: string) => void;
  onCliBlur: (v: string) => void;
  /** API mode: remote ACP server `host:port` (empty = local CLI spawn). */
  acpServerAddr: string;
  onAcpServerAddr: (v: string) => void;
  /** SSH tunnel manager fields (convenience layer over `acpServerAddr`). */
  sshTunnelTarget?: string;
  onSshTunnelTarget?: (v: string) => void;
  sshTunnelRemotePort?: number | null;
  onSshTunnelRemotePort?: (v: number | null) => void;
  sshTunnelLocalPort?: number | null;
  onSshTunnelLocalPort?: (v: number | null) => void;
  sshTunnelIdentityFile?: string;
  onSshTunnelIdentityFile?: (v: string) => void;
  /** True on Windows — shows the WSL distro picker. */
  isWindows?: boolean;
  wslDistro?: string;
  onWslDistro?: (v: string) => void;
  /** Max warm/live agent processes (I02). */
  maxConcurrentAgents?: number;
  onMaxConcurrentAgents?: (v: number) => void;
  /** Max live embedded terminal processes. */
  maxConcurrentTerminals?: number;
  onMaxConcurrentTerminals?: (v: number) => void;
  /** Idle recycle minutes (I03). */
  agentIdleMinutes?: number;
  onAgentIdleMinutes?: (v: number) => void;
  /** Stream stall silence timeout seconds (I06). */
  streamStallSeconds?: number;
  onStreamStallSeconds?: (v: number) => void;
  /** Store App API keys in OS keychain (default off → secrets.json). */
  storeApiKeysInKeychain?: boolean;
  onStoreApiKeysInKeychain?: (v: boolean) => void;
  /** OS sandbox for agent spawn: off | workspace | read-only | strict | devbox. */
  sandboxProfile?: string;
  onSandboxProfile?: (v: string) => void;
  cliInfo: {
    found: boolean;
    path: string | null;
    version: string | null;
    source: string;
    cliAuthPresent: boolean;
  };
  onDoctor: () => void;
  versionFooter: string;
  /** Official Grok Build account (membership / usage). */
  account: AccountStatus | null;
  accountLoading: boolean;
  accountBusy: boolean;
  loginHint?: string | null;
  savedAccounts?: import("@/lib/api").SavedAccount[];
  activeAccountId?: string | null;
  onAccountLoginOauth: () => void;
  onAccountLoginDevice: () => void;
  onCancelLogin: () => void;
  onAccountLogout: () => void;
  onAccountRefresh: () => void;
  onAccountManageUsage: () => void;
  onAccountSubscribe: () => void;
  onSaveAccount?: () => void;
  /** Save current (if signed in) then start OAuth login for another account. */
  onAddAccount?: () => void;
  onSwitchAccount?: (id: string) => void;
  onRemoveAccount?: (id: string) => void;
  onImportChat?: () => void;
  /** Default open target: finder | editor id */
  defaultOpenTarget?: string;
  onDefaultOpenTarget?: (v: string) => void;
  /** After switching official/custom provider — reconnect Grok Build agent. */
  onProviderActivated?: () => void;
  /** Archived chats grouped by project (settings → archived). */
  archivedGroups?: ArchivedProjectGroup[];
  /** Restore one or more archived sessions (ids). */
  onRestoreArchivedSessions?: (ids: string[]) => void;
  /** Delete one or more archived sessions after confirm (ids). */
  onDeleteArchivedSessions?: (ids: string[]) => void;
  /** Active project path for Skills/MCP inspect cwd. */
  projectPath?: string | null;
  /** After skill enable toggle — refresh slash palette in App. */
  onSkillsPrefsChanged?: () => void;
  /** xAI realtime voice id (e.g. eve). */
  voiceId?: string;
  onVoiceId?: (v: string) => void;
  /** Auto-send composer text after dictation ends. */
  voiceDictationAutoSend?: boolean;
  onVoiceDictationAutoSend?: (v: boolean) => void;
  /** Keep delegated agents running when live voice ends. */
  voiceKeepAgentsOnEnd?: boolean;
  onVoiceKeepAgentsOnEnd?: (v: boolean) => void;
  /** Playback rate for voice AI output (0.5-2.0). */
  voicePlaybackRate?: number;
  onVoicePlaybackRate?: (v: number) => void;
  /** Dictation language code. */
  voiceDictationLanguage?: string;
  onVoiceDictationLanguage?: (v: string) => void;
  /** Enable noise suppression on mic input. */
  voiceNoiseSuppression?: boolean;
  onVoiceNoiseSuppression?: (v: boolean) => void;
  /** Mic activation sensitivity (0-100). */
  voiceSensitivity?: number;
  onVoiceSensitivity?: (v: number) => void;
  /** Preferred microphone device ID. */
  voiceMicDeviceId?: string;
  onVoiceMicDeviceId?: (v: string) => void;
  /** Play chime on voice start/stop. */
  voiceFeedbackChime?: boolean;
  onVoiceFeedbackChime?: (v: boolean) => void;
  /** Timestamp display format. */
  timestampFormat?: string;
  onTimestampFormat?: (v: string) => void;
  /** Sidebar sort order. */
  sidebarSortOrder?: string;
  onSidebarSortOrder?: (v: string) => void;
  /** Wrap long lines in code blocks, diffs, etc. */
  wordWrap?: boolean;
  onWordWrap?: (v: boolean) => void;
  /** Ignore whitespace in diff view. */
  diffIgnoreWhitespace?: boolean;
  onDiffIgnoreWhitespace?: (v: boolean) => void;
  /** Confirm before deleting sessions. */
  confirmDelete?: boolean;
  onConfirmDelete?: (v: boolean) => void;
  /** Confirm before archiving sessions. */
  confirmArchive?: boolean;
  onConfirmArchive?: (v: boolean) => void;
  /** Glass surface opacity (40-100). */
  glassOpacity?: number;
  onGlassOpacity?: (v: number) => void;
  /** Sidebar message preview line count (1-15). */
  sidebarThreadPreviewCount?: number;
  onSidebarThreadPreviewCount?: (v: number) => void;
  /** Auto-archive idle threads after N days (null = off). */
  threadAutoSettleDays?: number | null;
  onThreadAutoSettleDays?: (v: number | null) => void;
  /** Auto-open task panel when steps appear. */
  autoOpenTaskPanel?: boolean;
  onAutoOpenTaskPanel?: (v: boolean) => void;
  /** Default directory for Add Project browser. */
  addProjectBaseDir?: string;
  onAddProjectBaseDir?: (v: string) => void;
  /** Check provider CLIs for updates. */
  enableProviderUpdateChecks?: boolean;
  onEnableProviderUpdateChecks?: (v: boolean) => void;
  /** Override binary path for CLI agent harness. */
  binaryPath?: string;
  onBinaryPath?: (v: string) => void;
  /** Override Grok home directory. */
  homePath?: string;
  onHomePath?: (v: string) => void;
  /** Additional model slugs to recognize, comma-separated. */
  customModels?: string;
  onCustomModels?: (v: string) => void;
  /** Native OS notifications (turn done, background permission requests). */
  notificationsEnabled?: boolean;
  onNotificationsEnabled?: (v: boolean) => void;
  /**
   * Currently-applied custom CSS (empty string = none). The textarea keeps
   * its own local draft state; this is only the last-Applied value used to
   * seed/reset that draft.
   */
  customCss?: string;
  /** Apply a new custom CSS value (persist + live-apply). */
  onCustomCssApply?: (css: string) => void;
  /** Clear custom CSS immediately (persist null + remove live style tag). */
  onCustomCssReset?: () => void;
}

const NAV: {
  id: SettingsSectionId;
  icon:
    | "settings"
    | "appearance"
    | "user"
    | "voice"
    | "archive"
    | "extensions"
    | "doctor"
    | "info";
  labelKey: string;
  group: "personal" | "system";
}[] = [
  { id: "general", icon: "settings", labelKey: "settings.nav.general", group: "personal" },
  { id: "appearance", icon: "appearance", labelKey: "settings.nav.appearance", group: "personal" },
  { id: "account", icon: "user", labelKey: "settings.nav.account", group: "personal" },
  { id: "voice", icon: "voice", labelKey: "settings.nav.voice", group: "personal" },
  { id: "archived", icon: "archive", labelKey: "settings.nav.archived", group: "personal" },
  {
    id: "extensions",
    icon: "extensions",
    labelKey: "settings.nav.extensions",
    group: "system",
  },
  { id: "runtime", icon: "doctor", labelKey: "settings.nav.runtime", group: "system" },
  { id: "about", icon: "info", labelKey: "settings.nav.about", group: "system" },
];

function NavIcon({
  name,
  size = 18,
}: {
  name: (typeof NAV)[number]["icon"];
  size?: number;
}) {
  if (name === "appearance") return <IconAppearance size={size} />;
  if (name === "user") return <IconUser size={size} />;
  if (name === "voice") return <IconHeadset size={size} />;
  if (name === "archive") return <IconArchive size={size} />;
  if (name === "extensions") return <IconPuzzle size={size} />;
  if (name === "doctor") return <IconDoctor size={size} />;
  if (name === "info") return <IconInfo size={size} />;
  return <IconSettings size={size} />;
}

function formatSessionWhen(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Custom CSS textarea with explicit Apply/Reset (never live/debounced).
 * Broken CSS (e.g. `* { display: none }`) could hide the whole app chrome
 * including this Settings page, so edits stay in a local, unapplied "draft"
 * until the user deliberately clicks Apply — navigating away without
 * clicking Apply changes nothing live or persisted.
 */
function CustomCssField({
  value,
  onApply,
  onReset,
  t,
}: {
  value: string;
  onApply: (css: string) => void;
  onReset: () => void;
  t: (k: string, vars?: Vars) => string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const dirty = draft !== value;

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">
          <IconDevtools size={16} />
          {t("settings.customCss")}
        </div>
        <div className="settings-row__desc">{t("settings.customCssDesc")}</div>
      </div>
      <textarea
        className="settings-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("settings.customCssPlaceholder")}
        rows={8}
        spellCheck={false}
        aria-label={t("settings.customCss")}
      />
      <div className="settings-row__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setDraft("");
            onReset();
          }}
        >
          {t("settings.customCssReset")}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!dirty}
          onClick={() => onApply(draft)}
        >
          {t("settings.customCssApply")}
        </button>
      </div>
      <div className="settings-row__hint">{t("settings.customCssResetHint")}</div>
    </div>
  );
}

/**
 * ACP API-mode field with Test + server-side setup one-liner (from PR #23).
 * Remote agents may run anywhere — verify reachability instead of auto-start.
 */
function AcpServerField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string, vars?: Vars) => string;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<api.AcpProbeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const addr = value.trim();
  const port = (addr.split(":")[1] || "").replace(/[^0-9]/g, "") || "8799";
  const setupCmd = `socat TCP-LISTEN:${port},reuseaddr,fork EXEC:'grok agent --no-leader stdio'`;

  const runTest = async () => {
    if (!addr || !api.isTauri()) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.acpTestConnection(addr));
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setTesting(false);
    }
  };
  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(setupCmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">{t("settings.acpServer")}</div>
        <div className="settings-row__desc">{t("settings.acpServerDesc")}</div>
      </div>
      <div className="settings-acp-field">
        <input
          className="settings-input"
          value={value}
          placeholder="e.g. 127.0.0.1:8799"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!addr || testing}
          onClick={() => void runTest()}
        >
          {testing ? t("settings.acpTesting") : t("settings.acpTest")}
        </button>
      </div>
      {result ? (
        <div
          className={
            "settings-row__hint" + (result.ok ? "" : " is-danger")
          }
        >
          {result.ok
            ? t("settings.acpTestOk", {
                version: result.agentVersion || "?",
                model: result.model || "?",
              })
            : t("settings.acpTestFail", {
                error: result.error || "unknown",
              })}
        </div>
      ) : null}
      {addr ? (
        <div className="settings-row__hint">
          <div>{t("settings.acpSetupHint")}</div>
          <code className="settings-acp-cmd">{setupCmd}</code>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void copyCmd()}
          >
            {copied ? t("message.copied") : t("message.copy")}
          </button>
        </div>
      ) : null}
      {addr && !isLoopbackAcpAddr(addr) ? (
        <div className="settings-row__hint is-warning">
          {t("settings.acpNonLoopbackWarning")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Convenience SSH tunnel manager fronting the raw-TCP ACP transport above —
 * spawns and supervises `ssh -N -L <local>:localhost:<remote> <target>` and,
 * once the forward is confirmed listening, hands the resulting
 * `127.0.0.1:<local port>` back via `onConnected` so the caller can populate
 * the ACP server address field automatically.
 */
function SshTunnelField({
  target,
  onTarget,
  remotePort,
  onRemotePort,
  localPort,
  onLocalPort,
  identityFile,
  onIdentityFile,
  onConnected,
  t,
}: {
  target: string;
  onTarget: (v: string) => void;
  remotePort: number | null;
  onRemotePort: (v: number | null) => void;
  localPort: number | null;
  onLocalPort: (v: number | null) => void;
  identityFile: string;
  onIdentityFile: (v: string) => void;
  onConnected: (localPort: number) => void;
  t: (k: string, vars?: Vars) => string;
}) {
  const [status, setStatus] = useState<api.SshTunnelStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api.isTauri()) return;
    void api
      .sshTunnelStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  const targetCheck = validateSshTarget(target);
  const portsOk = isValidPort(remotePort) && isValidPort(localPort);
  const canConnect = api.isTauri() && targetCheck.valid && portsOk && !busy;

  const connect = async () => {
    if (!canConnect || remotePort == null || localPort == null) return;
    setBusy(true);
    try {
      const result = await api.sshTunnelStart(
        target.trim(),
        remotePort,
        localPort,
        identityFile.trim() || null,
      );
      setStatus(result);
      if (result.state === "connected" && result.localPort) {
        onConnected(result.localPort);
      }
    } catch (e) {
      setStatus({ state: "error", message: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!api.isTauri() || busy) return;
    setBusy(true);
    try {
      setStatus(await api.sshTunnelStop());
    } catch (e) {
      setStatus({ state: "error", message: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const statusLine = (() => {
    if (!status) return null;
    switch (status.state) {
      case "connected":
        return t("settings.sshTunnelStatusConnected", {
          port: String(status.localPort ?? ""),
        });
      case "connecting":
        return t("settings.sshTunnelStatusConnecting");
      case "error":
        return t("settings.sshTunnelStatusError", {
          error: status.message || "unknown",
        });
      default:
        return t("settings.sshTunnelStatusIdle");
    }
  })();

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">
          <IconTunnel size={16} />
          {t("settings.sshTunnel")}
        </div>
        <div className="settings-row__desc">{t("settings.sshTunnelDesc")}</div>
      </div>
      <div className="settings-ssh-field">
        <input
          className="settings-input"
          value={target}
          placeholder={t("settings.sshTunnelTargetPh")}
          onChange={(e) => onTarget(e.target.value)}
        />
        <input
          className="settings-input settings-input--port"
          type="number"
          min={1}
          max={65535}
          value={remotePort ?? ""}
          placeholder={t("settings.sshTunnelRemotePortPh")}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const n = Number(raw);
            onRemotePort(raw === "" || !Number.isFinite(n) ? null : Math.round(n));
          }}
        />
        <input
          className="settings-input settings-input--port"
          type="number"
          min={1}
          max={65535}
          value={localPort ?? ""}
          placeholder={t("settings.sshTunnelLocalPortPh")}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const n = Number(raw);
            onLocalPort(raw === "" || !Number.isFinite(n) ? null : Math.round(n));
          }}
        />
      </div>
      <input
        className="settings-input"
        value={identityFile}
        placeholder={t("settings.sshTunnelIdentityFilePh")}
        onChange={(e) => onIdentityFile(e.target.value)}
      />
      <div className="settings-row__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canConnect}
          onClick={() => void connect()}
        >
          {busy ? t("settings.sshTunnelConnecting") : t("settings.sshTunnelConnect")}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!api.isTauri() || busy || !status || status.state === "idle"}
          onClick={() => void disconnect()}
        >
          {t("settings.sshTunnelDisconnect")}
        </button>
      </div>
      {statusLine ? (
        <div
          className={
            "settings-row__hint" + (status?.state === "error" ? " is-danger" : "")
          }
        >
          {statusLine}
        </div>
      ) : null}
    </div>
  );
}

/** Windows-only: pick the WSL distro `grok agent stdio` should run inside of. */
function WslDistroField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string, vars?: Vars) => string;
}) {
  const [distros, setDistros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api.isTauri()) return;
    setLoading(true);
    void api
      .wslListDistros()
      .then(setDistros)
      .catch(() => setDistros([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">
          <IconWindows size={16} />
          {t("settings.wslDistro")}
        </div>
        <div className="settings-row__desc">{t("settings.wslDistroDesc")}</div>
      </div>
      <Select
        value={value}
        onChange={onChange}
        disabled={loading}
        options={[
          { value: "", label: t("settings.wslDistroNone") },
          ...distros.map((d) => ({ value: d, label: d })),
        ]}
      />
      {!loading && distros.length === 0 ? (
        <div className="settings-row__hint">{t("settings.wslDistroEmpty")}</div>
      ) : null}
    </div>
  );
}

/**
 * Desktop notifications toggle + live OS-permission status, patterned after
 * `AcpServerField`'s "control + inline live status" layout above.
 */
function NotificationsField({
  enabled,
  onChange,
  t,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  t: (k: string, vars?: Vars) => string;
}) {
  const [permission, setPermission] = useState<NotifyPermission | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getNotifyPermission().then((p) => {
      if (!cancelled) setPermission(p);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const requestOsPermission = async () => {
    setRequesting(true);
    try {
      setPermission(await ensureNotifyPermission());
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">
          <IconBell size={16} />
          {t("settings.notifications")}
        </div>
        <div className="settings-row__desc">
          {t("settings.notificationsDesc")}
        </div>
      </div>
      <UiCheck
        checked={enabled}
        onChange={() => onChange(!enabled)}
        ariaLabel={t("settings.notifications")}
      />
      {permission === "granted" && (
        <div className="settings-row__hint">
          {t("settings.notificationsGranted")}
        </div>
      )}
      {permission === "denied" && (
        <div className="settings-row__hint is-danger">
          {t("settings.notificationsDenied")}
        </div>
      )}
      {permission === "default" && (
        <div className="settings-row__hint">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={requesting}
            onClick={() => void requestOsPermission()}
          >
            {t("settings.notificationsRequest")}
          </button>
        </div>
      )}
      {enabled && permission === "granted" && (
        <div style={{ marginTop: "6px" }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              void showDesktopNotification({
                title: "Grok Desktop",
                body: "Desktop notifications are active!",
                force: true,
              });
            }}
          >
            {t("settings.testNotification")}
          </button>
        </div>
      )}
    </div>
  );
}

function PresetsSettingsSection({ t }: { t: (k: string, vars?: Vars) => string }) {
  const [presets, setPresets] = useState<SessionPreset[]>([]);

  const refresh = async () => {
    try {
      const list = await api.loadSessionPresets();
      setPresets(list || []);
    } catch {
      setPresets([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const updated = await api.deleteSessionPreset(id);
      setPresets(updated);
    } catch {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">
          <IconSettings size={16} />
          {t("settings.sessionPresets")}
        </div>
        <div className="settings-row__desc">
          {t("settings.sessionPresetsDesc")}
        </div>
      </div>

      <div className="presets-settings-list" style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "8px" }}>
        {presets.length === 0 ? (
          <div className="settings-row__hint">{t("settings.noPresetsSaved")}</div>
        ) : (
          presets.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))",
                border: "1px solid var(--c-border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
                <div style={{ fontSize: "11px", opacity: 0.7 }}>
                  Model: {p.model} | Effort: {p.effort} | YOLO: {p.yolo ? "On" : "Off"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void handleDelete(p.id)}
                style={{ color: "var(--c-danger, #ef4444)" }}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** App-styled checkbox (no native OS control). */
function UiCheck({
  checked,
  indeterminate = false,
  onChange,
  label,
  ariaLabel,
  className = "",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const on = indeterminate || checked;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      className={
        "ui-check" +
        (checked && !indeterminate ? " is-on" : "") +
        (indeterminate ? " is-mixed" : "") +
        (className ? ` ${className}` : "")
      }
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="ui-check__box" aria-hidden>
        {indeterminate ? (
          <IconMinimize size={12} stroke={2.4} />
        ) : on ? (
          <IconCheck size={12} stroke={2.4} />
        ) : null}
      </span>
      {label != null ? <span className="ui-check__label">{label}</span> : null}
    </button>
  );
}

type MarqueeBox = { x0: number; y0: number; x1: number; y1: number };

function marqueeClientRect(m: MarqueeBox) {
  const left = Math.min(m.x0, m.x1);
  const top = Math.min(m.y0, m.y1);
  const right = Math.max(m.x0, m.x1);
  const bottom = Math.max(m.y0, m.y1);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: DOMRect,
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function SettingsPage({
  section,
  onSection,
  onBack,
  labels: _legacyLabels,
  locale,
  onLocale,
  theme,
  onTheme,
  sessionDataMode,
  onSessionDataMode,
  onCliSessionsImported,
  onSettingsImported,
  policy,
  onPolicy,
  prefsScope = "global",
  onPrefsScope,
  availableModels = [],
  manualCliPath,
  onManualCliPath,
  onCliBlur,
  acpServerAddr,
  onAcpServerAddr,
  sshTunnelTarget = "",
  onSshTunnelTarget,
  sshTunnelRemotePort = null,
  onSshTunnelRemotePort,
  sshTunnelLocalPort = null,
  onSshTunnelLocalPort,
  sshTunnelIdentityFile = "",
  onSshTunnelIdentityFile,
  isWindows = false,
  wslDistro = "",
  onWslDistro,
  maxConcurrentAgents = 3,
  onMaxConcurrentAgents,
  maxConcurrentTerminals = 4,
  onMaxConcurrentTerminals,
  agentIdleMinutes = 30,
  onAgentIdleMinutes,
  streamStallSeconds = 120,
  onStreamStallSeconds,
  storeApiKeysInKeychain = false,
  onStoreApiKeysInKeychain,
  sandboxProfile = "off",
  onSandboxProfile,
  cliInfo,
  onDoctor,
  versionFooter,
  account,
  accountLoading,
  accountBusy,
  loginHint = null,
  savedAccounts = [],
  activeAccountId = null,
  onAccountLoginOauth,
  onAccountLoginDevice,
  onCancelLogin,
  onAccountLogout,
  onAccountRefresh,
  onAccountManageUsage,
  onAccountSubscribe,
  onSaveAccount,
  onAddAccount,
  onSwitchAccount,
  onRemoveAccount,
  onImportChat,
  defaultOpenTarget = "finder",
  onDefaultOpenTarget,
  onProviderActivated,
  archivedGroups = [],
  onRestoreArchivedSessions,
  onDeleteArchivedSessions,
  projectPath = null,
  onSkillsPrefsChanged,
  voiceId = "eve",
  onVoiceId,
  voiceDictationAutoSend = false,
  onVoiceDictationAutoSend,
  voiceKeepAgentsOnEnd = true,
  onVoiceKeepAgentsOnEnd,
  voicePlaybackRate = 1.0,
  onVoicePlaybackRate,
  voiceDictationLanguage = "auto",
  onVoiceDictationLanguage,
  voiceNoiseSuppression = true,
  onVoiceNoiseSuppression,
  voiceSensitivity = 50,
  onVoiceSensitivity,
  voiceMicDeviceId = "",
  onVoiceMicDeviceId,
  voiceFeedbackChime = false,
  onVoiceFeedbackChime,
  timestampFormat = "locale",
  onTimestampFormat,
  sidebarSortOrder = "updated_at",
  onSidebarSortOrder,
  wordWrap = true,
  onWordWrap,
  diffIgnoreWhitespace = true,
  onDiffIgnoreWhitespace,
  confirmDelete = true,
  onConfirmDelete,
  confirmArchive = false,
  onConfirmArchive,
  glassOpacity = 80,
  onGlassOpacity,
  sidebarThreadPreviewCount = 6,
  onSidebarThreadPreviewCount,
  threadAutoSettleDays = null,
  onThreadAutoSettleDays,
  autoOpenTaskPanel = false,
  onAutoOpenTaskPanel,
  addProjectBaseDir = "",
  onAddProjectBaseDir,
  enableProviderUpdateChecks = true,
  onEnableProviderUpdateChecks,
  binaryPath = "",
  onBinaryPath,
  homePath = "",
  onHomePath,
  customModels = "",
  onCustomModels,
  notificationsEnabled = true,
  onNotificationsEnabled,
  customCss = "",
  onCustomCssApply,
  onCustomCssReset,
}: SettingsPageProps) {
  const [query, setQuery] = useState("");
  const [voiceOptions, setVoiceOptions] = useState<api.VoiceOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void api.voiceListVoices().then((opts) => {
      if (!cancelled) setVoiceOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [micDevices, setMicDevices] = useState<{ deviceId: string; label: string }[]>([]);
  useEffect(() => {
    if (typeof navigator?.mediaDevices?.enumerateDevices !== "function") return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 8)}` }));
      setMicDevices(mics);
    }).catch(() => {});
  }, []);
  const [accountTab, setAccountTab] = useState<"official" | "providers">(
    "official",
  );
  const [editors, setEditors] = useState<DetectedEditor[]>([]);
  /** Selected archived session ids (settings → archived multi-select). */
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(
    () => new Set(),
  );
  /** Rubber-band marquee (client coords) while dragging on the list surface. */
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const archivedSurfaceRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<{
    active: boolean;
    dragging: boolean;
    additive: boolean;
    base: Set<string>;
    box: MarqueeBox;
    pointerId: number;
  } | null>(null);
  // Full catalog via createT — do not depend on App's partial `labels` whitelist
  // (missing keys used to render raw "settings.acpServer" etc.).
  const tr = useMemo(() => createT(resolveLocale(locale)), [locale]);
  const t = useCallback(
    (k: string, vars?: Vars) => tr(k as MessageKey, vars),
    [tr],
  );

  useEffect(() => {
    if (!api.isTauri()) return;
    void api.editorsList().then((r) => setEditors(r.editors ?? [])).catch(() => {});
  }, []);

  const nav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter((n) => t(n.labelKey).toLowerCase().includes(q));
  }, [query, t]);

  const archivedAllIds = useMemo(
    () => archivedGroups.flatMap((g) => g.sessions.map((s) => s.id)),
    [archivedGroups],
  );

  const archivedTotal = archivedAllIds.length;

  // Drop stale selection when list changes (restore/delete/refresh).
  useEffect(() => {
    setArchivedSelected((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(archivedAllIds);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [archivedAllIds]);

  const archivedSelectedCount = archivedSelected.size;
  const archivedAllSelected =
    archivedTotal > 0 && archivedSelectedCount === archivedTotal;
  const archivedSomeSelected =
    archivedSelectedCount > 0 && !archivedAllSelected;

  const toggleArchivedId = (id: string) => {
    setArchivedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleArchivedAll = () => {
    if (archivedAllSelected) {
      setArchivedSelected(new Set());
    } else {
      setArchivedSelected(new Set(archivedAllIds));
    }
  };

  const toggleArchivedGroup = (ids: string[]) => {
    setArchivedSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allOn) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  };

  const collectMarqueeHits = useCallback((box: MarqueeBox): string[] => {
    const root = archivedSurfaceRef.current;
    if (!root) return [];
    const r = marqueeClientRect(box);
    // Ignore tiny jitter before true drag.
    if (r.width < 4 && r.height < 4) return [];
    const hits: string[] = [];
    root.querySelectorAll<HTMLElement>("[data-archived-id]").forEach((el) => {
      const id = el.dataset.archivedId;
      if (!id) return;
      if (rectsOverlap(r, el.getBoundingClientRect())) hits.push(id);
    });
    return hits;
  }, []);

  const applyMarqueeSelection = useCallback(
    (box: MarqueeBox, additive: boolean, base: Set<string>) => {
      const hits = collectMarqueeHits(box);
      if (hits.length === 0 && !additive) {
        // Still dragging — keep empty if not additive.
        setArchivedSelected(new Set());
        return;
      }
      if (additive) {
        const next = new Set(base);
        for (const id of hits) next.add(id);
        setArchivedSelected(next);
      } else {
        setArchivedSelected(new Set(hits));
      }
    },
    [collectMarqueeHits],
  );

  const onArchivedPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't start marquee from action controls / custom checks.
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest(".ui-check") ||
      target.closest(".settings-archived-toolbar")
    ) {
      return;
    }
    const additive = e.metaKey || e.ctrlKey || e.shiftKey;
    const box: MarqueeBox = {
      x0: e.clientX,
      y0: e.clientY,
      x1: e.clientX,
      y1: e.clientY,
    };
    marqueeRef.current = {
      active: true,
      dragging: false,
      additive,
      base: new Set(archivedSelected),
      box,
      pointerId: e.pointerId,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onArchivedPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = marqueeRef.current;
    if (!st?.active || st.pointerId !== e.pointerId) return;
    const box: MarqueeBox = {
      ...st.box,
      x1: e.clientX,
      y1: e.clientY,
    };
    st.box = box;
    const r = marqueeClientRect(box);
    if (!st.dragging && (r.width > 5 || r.height > 5)) {
      st.dragging = true;
      setMarquee(box);
    }
    if (st.dragging) {
      setMarquee(box);
      applyMarqueeSelection(box, st.additive, st.base);
    }
  };

  const onArchivedPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = marqueeRef.current;
    if (!st?.active || st.pointerId !== e.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (st.dragging) {
      applyMarqueeSelection(st.box, st.additive, st.base);
      return;
    }
    // Click without drag: toggle row under pointer (if any).
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-archived-id]",
    );
    const id = el?.dataset.archivedId;
    if (id) toggleArchivedId(id);
  };

  const onArchivedPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = marqueeRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
  };

  const title =
    section === "general"
      ? t("settings.nav.general")
      : section === "appearance"
        ? t("settings.nav.appearance")
        : section === "account"
          ? t("settings.nav.account")
          : section === "voice"
            ? t("settings.nav.voice")
            : section === "archived"
            ? t("settings.nav.archived")
            : section === "extensions"
              ? t("settings.nav.extensions")
              : section === "runtime"
                ? t("settings.nav.runtime")
                : t("settings.nav.about");

  return (
    <div className="settings-page" data-testid="settings-page">
      {/* Full-width overlay drag band (does not break glass nav continuity) */}
      <div
        className="settings-page__chrome"
        data-tauri-drag-region
        aria-hidden
        onDoubleClick={() => {
          void import("@tauri-apps/api/window")
            .then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize())
            .catch(() => {});
        }}
      />
      <aside className="settings-page__nav">
        <div className="settings-page__nav-inner">
        <button
          type="button"
          className="settings-page__back"
          onClick={onBack}
        >
          <IconArrowLeft size={16} />
          <span>{t("settings.backToApp")}</span>
        </button>

        <div className="settings-page__search">
          <IconSearch size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.searchPlaceholder")}
          />
        </div>

        <div className="settings-page__group-label">
          {t("settings.group.personal")}
        </div>
        {nav
          .filter((n) => n.group === "personal")
          .map((n) => (
            <button
              key={n.id}
              type="button"
              className={
                "settings-page__nav-item" +
                (section === n.id ? " is-active" : "")
              }
              onClick={() => onSection(n.id)}
            >
              <NavIcon name={n.icon} />
              <span>{t(n.labelKey)}</span>
            </button>
          ))}

        <div className="settings-page__group-label">
          {t("settings.group.system")}
        </div>
        {nav
          .filter((n) => n.group === "system")
          .map((n) => (
            <button
              key={n.id}
              type="button"
              className={
                "settings-page__nav-item" +
                (section === n.id ? " is-active" : "")
              }
              onClick={() => onSection(n.id)}
            >
              <NavIcon name={n.icon} />
              <span>{t(n.labelKey)}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="settings-page__content">
      <main className="settings-page__main">
        <h1 className="settings-page__title">{title}</h1>

        {section === "general" && (
          <>
            <h2 className="settings-page__h2">{t("settings.section.composer")}</h2>
            <div className="settings-card">
              {onPrefsScope && (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">
                      {t("settings.prefsScope")}
                    </div>
                    <div className="settings-row__desc">
                      {t("settings.prefsScopeDesc")}
                    </div>
                  </div>
                  <Select
                    value={prefsScope}
                    onChange={(v) => onPrefsScope(v as ComposerPrefsScope)}
                    options={COMPOSER_PREFS_SCOPES.map((s) => ({
                      value: s,
                      label: t(
                        (
                          {
                            global: "settings.prefsScope.global",
                            project: "settings.prefsScope.project",
                            session: "settings.prefsScope.session",
                          } as const
                        )[s],
                      ),
                    }))}
                  />
                </div>
              )}
              <div className="settings-row settings-row--stack">
                <div className="settings-row__text">
                  <div className="settings-row__label">
                    {t("settings.availableModels")}
                  </div>
                  <div className="settings-row__desc">
                    {t("settings.availableModelsDesc")}
                  </div>
                </div>
                <div className="settings-models-list" role="list">
                  {availableModels.length === 0 ? (
                    <span className="settings-row__desc">
                      {t("settings.availableModelsEmpty")}
                    </span>
                  ) : (
                    availableModels.map((m) => (
                      <div
                        key={m.id}
                        className="settings-models-list__item"
                        role="listitem"
                      >
                        <span className="settings-models-list__name">
                          {m.label}
                        </span>
                        <span className="settings-models-list__id">{m.id}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <h2 className="settings-page__h2">{t("settings.section.permissions")}</h2>
            <div className="settings-card">
              <div className="settings-row settings-row--stack">
                <div className="settings-row__text">
                  <div className="settings-row__label">
                    <IconShield size={16} />
                    {t("settings.permissionDeep")}
                  </div>
                  <div className="settings-row__desc">
                    {t("settings.permissionDeepDesc")}
                  </div>
                </div>
                <Select
                  value={policy}
                  onChange={(v) => onPolicy(v as PermissionPolicyId)}
                  options={PERMISSION_POLICIES.map((p) => ({
                    value: p.id,
                    label: t(
                      (
                        {
                          ask: "policy.ask",
                          accept_edits: "policy.accept_edits",
                          allow_for_session: "policy.allow_for_session",
                          dont_ask: "policy.dont_ask",
                          always_approve: "policy.always_approve",
                        } as const
                      )[p.id],
                    ),
                  }))}
                />
              </div>
              {onSandboxProfile ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">
                      {t("settings.sandboxProfile")}
                    </div>
                    <div className="settings-row__desc">
                      {t("settings.sandboxProfileDesc")}
                    </div>
                  </div>
                  <Select
                    value={sandboxProfile || "off"}
                    onChange={(v) => onSandboxProfile(v)}
                    options={[
                      {
                        value: "off",
                        label: t("settings.sandbox.off"),
                      },
                      {
                        value: "workspace",
                        label: t("settings.sandbox.workspace"),
                      },
                      {
                        value: "read-only",
                        label: t("settings.sandbox.readOnly"),
                      },
                      {
                        value: "strict",
                        label: t("settings.sandbox.strict"),
                      },
                      {
                        value: "devbox",
                        label: t("settings.sandbox.devbox"),
                      },
                    ]}
                  />
                </div>
              ) : null}
            </div>

            <h2 className="settings-page__h2">{t("settings.section.general")}</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">
                    <IconLanguage size={16} />
                    {t("settings.language")}
                  </div>
                  <div className="settings-row__desc">
                    {t("settings.languageDesc")}
                  </div>
                </div>
                <Select
                  value={locale}
                  onChange={onLocale}
                  options={[
                    { value: "en", label: "English" },
                    { value: "zh", label: "简体中文" },
                    { value: "zh-TW", label: "繁體中文" },
                  ]}
                />
              </div>
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">
                    {t("settings.sessionDataMode")}
                  </div>
                  <div className="settings-row__desc">
                    {t("settings.sessionDataModeDesc")}
                  </div>
                </div>
                <Select
                  value={sessionDataMode}
                  onChange={onSessionDataMode}
                  options={[
                    {
                      value: "independent",
                      label: t("settings.modeIndependent"),
                    },
                    { value: "shared", label: t("settings.modeShared") },
                  ]}
                />
              </div>
              {sessionDataMode === "shared" ? (
                <CliSessionsPanel
                  t={t}
                  onImported={onCliSessionsImported}
                />
              ) : null}
              {onStoreApiKeysInKeychain ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">
                      {t("settings.storeApiKeysInKeychain")}
                    </div>
                    <div className="settings-row__desc">
                      {t("settings.storeApiKeysInKeychainDesc")}
                    </div>
                  </div>
                  <UiCheck
                    checked={storeApiKeysInKeychain}
                    onChange={() =>
                      onStoreApiKeysInKeychain(!storeApiKeysInKeychain)
                    }
                    ariaLabel={t("settings.storeApiKeysInKeychain")}
                  />
                </div>
              ) : null}
              {onDefaultOpenTarget && (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">
                      {t("settings.openTarget")}
                    </div>
                    <div className="settings-row__desc">
                      {t("settings.openTargetDesc")}
                    </div>
                  </div>
                  <Select
                    value={defaultOpenTarget}
                    onChange={onDefaultOpenTarget}
                    options={[
                      { value: "finder", label: t("settings.openFinder") },
                      ...editors.map((e) => ({
                        value: e.id,
                        label: e.label,
                      })),
                    ]}
                  />
                </div>
              )}
              {onSidebarSortOrder ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.sidebar.sort")}</div>
                    <div className="settings-row__desc">{t("settings.sidebar.sortDesc")}</div>
                  </div>
                  <Select
                    value={sidebarSortOrder}
                    onChange={(v) => onSidebarSortOrder(v)}
                    options={[
                      { value: "updated_at", label: t("settings.sidebar.sortUpdated") },
                      { value: "created_at", label: t("settings.sidebar.sortCreated") },
                      { value: "manual", label: t("settings.sidebar.sortManual") },
                    ]}
                    aria-label={t("settings.sidebar.sort")}
                  />
                </div>
              ) : null}
              {onSidebarThreadPreviewCount ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.sidebar.previewCount")}</div>
                    <div className="settings-row__desc">{t("settings.sidebar.previewCountDesc")}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      value={sidebarThreadPreviewCount}
                      onChange={(e) => onSidebarThreadPreviewCount(Number(e.target.value))}
                      style={{ flex: 1, maxWidth: 200, accentColor: 'var(--accent)' }}
                      aria-label={t("settings.sidebar.previewCount")}
                    />
                    <output style={{ minWidth: 24, textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                      {sidebarThreadPreviewCount}
                    </output>
                  </div>
                </div>
              ) : null}
              {onThreadAutoSettleDays !== undefined ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.threadAutoSettle")}</div>
                    <div className="settings-row__desc">{t("settings.threadAutoSettleDesc")}</div>
                  </div>
                  <Select
                    value={String(threadAutoSettleDays ?? "")}
                    onChange={(v) => onThreadAutoSettleDays(v ? Number(v) : null)}
                    options={[
                      { value: "", label: t("settings.threadAutoSettleOff") },
                      { value: "1", label: "1" },
                      { value: "3", label: "3" },
                      { value: "7", label: "7" },
                      { value: "14", label: "14" },
                      { value: "30", label: "30" },
                      { value: "60", label: "60" },
                      { value: "90", label: "90" },
                    ]}
                    aria-label={t("settings.threadAutoSettle")}
                  />
                </div>
              ) : null}
              {onAutoOpenTaskPanel ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.autoOpenTaskPanel")}</div>
                    <div className="settings-row__desc">{t("settings.autoOpenTaskPanelDesc")}</div>
                  </div>
                  <UiCheck
                    checked={autoOpenTaskPanel}
                    onChange={() => onAutoOpenTaskPanel(!autoOpenTaskPanel)}
                    ariaLabel={t("settings.autoOpenTaskPanel")}
                  />
                </div>
              ) : null}
              {onConfirmDelete ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.confirmDelete")}</div>
                    <div className="settings-row__desc">{t("settings.confirmDeleteDesc")}</div>
                  </div>
                  <UiCheck
                    checked={confirmDelete}
                    onChange={() => onConfirmDelete(!confirmDelete)}
                    ariaLabel={t("settings.confirmDelete")}
                  />
                </div>
              ) : null}
              {onConfirmArchive ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.confirmArchive")}</div>
                    <div className="settings-row__desc">{t("settings.confirmArchiveDesc")}</div>
                  </div>
                  <UiCheck
                    checked={confirmArchive}
                    onChange={() => onConfirmArchive(!confirmArchive)}
                    ariaLabel={t("settings.confirmArchive")}
                  />
                </div>
              ) : null}
              {onEnableProviderUpdateChecks ? (
                <div className="settings-row">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.providerUpdateChecks")}</div>
                    <div className="settings-row__desc">{t("settings.providerUpdateChecksDesc")}</div>
                  </div>
                  <UiCheck
                    checked={enableProviderUpdateChecks}
                    onChange={() => onEnableProviderUpdateChecks(!enableProviderUpdateChecks)}
                    ariaLabel={t("settings.providerUpdateChecks")}
                  />
                </div>
              ) : null}
              <div className="settings-row settings-row--stack">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("settings.keybindings")}</div>
                  <div className="settings-row__desc">{t("settings.keybindingsDesc")}</div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    const overrides = JSON.stringify(getUserOverrides(), null, 2);
                    const blob = new Blob([overrides], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                >
                  {t("settings.keybindingsOpen")}
                </button>
              </div>
              {onAddProjectBaseDir ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.addProjectBaseDir")}</div>
                    <div className="settings-row__desc">{t("settings.addProjectBaseDirDesc")}</div>
                  </div>
                  <input
                    className="settings-input"
                    value={addProjectBaseDir}
                    placeholder="~/"
                    onChange={(e) => onAddProjectBaseDir(e.target.value)}
                    aria-label={t("settings.addProjectBaseDir")}
                  />
                </div>
              ) : null}
              {onBinaryPath ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.binaryPath")}</div>
                    <div className="settings-row__desc">{t("settings.binaryPathDesc")}</div>
                  </div>
                  <input
                    className="settings-input"
                    value={binaryPath ?? ""}
                    placeholder={t("settings.binaryPathPh")}
                    onChange={(e) => onBinaryPath(e.target.value)}
                    aria-label={t("settings.binaryPath")}
                  />
                </div>
              ) : null}
              {onHomePath ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.homePath")}</div>
                    <div className="settings-row__desc">{t("settings.homePathDesc")}</div>
                  </div>
                  <input
                    className="settings-input"
                    value={homePath ?? ""}
                    placeholder={t("settings.homePathPh")}
                    onChange={(e) => onHomePath(e.target.value)}
                    aria-label={t("settings.homePath")}
                  />
                </div>
              ) : null}
              {onCustomModels ? (
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__text">
                    <div className="settings-row__label">{t("settings.customModels")}</div>
                    <div className="settings-row__desc">{t("settings.customModelsDesc")}</div>
                  </div>
                  <input
                    className="settings-input"
                    value={customModels ?? ""}
                    placeholder={t("settings.customModelsPh")}
                    onChange={(e) => onCustomModels(e.target.value)}
                    aria-label={t("settings.customModels")}
                  />
                </div>
              ) : null}
              <NotificationsField
                enabled={notificationsEnabled}
                onChange={(v) => onNotificationsEnabled?.(v)}
                t={t}
              />
              <PresetsSettingsSection t={t} />
              <NotificationSettingsSection />
              <GitHubIntegrationSection />
              <SyncSettingsSection />
              <ExportImportSettingsPanel
                t={t}
                onImported={onSettingsImported}
              />
            </div>
          </>
        )}

        {section === "appearance" && (
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  <IconAppearance size={16} />
                  {t("settings.theme")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.themeDesc")}
                </div>
              </div>
              <div className="settings-seg">
                <button
                  type="button"
                  className={
                    "settings-seg__btn" + (theme === "light" ? " is-on" : "")
                  }
                  onClick={() => onTheme("light")}
                >
                  {t("settings.themeLight")}
                </button>
                <button
                  type="button"
                  className={
                    "settings-seg__btn" + (theme === "dark" ? " is-on" : "")
                  }
                  onClick={() => onTheme("dark")}
                >
                  {t("settings.themeDark")}
                </button>
              </div>
            </div>
            {onGlassOpacity ? (
              <div className="settings-row settings-row--stack">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("settings.glassOpacity")}</div>
                  <div className="settings-row__desc">{t("settings.glassOpacityDesc")}</div>
                </div>
                <div className="settings-row__control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <output style={{ minWidth: 40, textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                    {glassOpacity}%
                  </output>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    step={5}
                    value={glassOpacity}
                    onChange={(e) => onGlassOpacity(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                    aria-label={t("settings.glassOpacity")}
                  />
                </div>
              </div>
            ) : null}
            {onTimestampFormat ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("settings.format.timestamp")}</div>
                  <div className="settings-row__desc">{t("settings.format.timestampDesc")}</div>
                </div>
                <Select
                  value={timestampFormat}
                  onChange={(v) => onTimestampFormat(v)}
                  options={[
                    { value: "locale", label: t("settings.format.timestampLocale") },
                    { value: "12-hour", label: t("settings.format.timestamp12h") },
                    { value: "24-hour", label: t("settings.format.timestamp24h") },
                  ]}
                  aria-label={t("settings.format.timestamp")}
                />
              </div>
            ) : null}
            {onWordWrap ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("settings.wordWrap")}</div>
                  <div className="settings-row__desc">{t("settings.wordWrapDesc")}</div>
                </div>
                <UiCheck
                  checked={wordWrap}
                  onChange={() => onWordWrap(!wordWrap)}
                  ariaLabel={t("settings.wordWrap")}
                />
              </div>
            ) : null}
            {onDiffIgnoreWhitespace ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("settings.diffWhitespace")}</div>
                  <div className="settings-row__desc">{t("settings.diffWhitespaceDesc")}</div>
                </div>
                <UiCheck
                  checked={diffIgnoreWhitespace}
                  onChange={() => onDiffIgnoreWhitespace(!diffIgnoreWhitespace)}
                  ariaLabel={t("settings.diffWhitespace")}
                />
              </div>
            ) : null}
            {onCustomCssApply ? (
              <CustomCssField
                value={customCss}
                onApply={onCustomCssApply}
                onReset={() => onCustomCssReset?.()}
                t={t}
              />
            ) : null}
          </div>
        )}

        {section === "voice" && (
          <>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  <IconHeadset size={16} />
                  {t("voice.settingsVoiceId")}
                </div>
              </div>
              <Select
                value={voiceId}
                options={voiceOptions.map((o) => ({
                  value: o.voiceId,
                  label: o.name,
                }))}
                onChange={(v) => onVoiceId?.(v)}
                aria-label={t("voice.settingsVoiceId")}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("voice.settingsAutoSend")}
                </div>
              </div>
              <UiCheck
                checked={voiceDictationAutoSend}
                onChange={() => onVoiceDictationAutoSend?.(!voiceDictationAutoSend)}
                ariaLabel={t("voice.settingsAutoSend")}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("voice.settingsKeepAgents")}
                </div>
              </div>
              <UiCheck
                checked={voiceKeepAgentsOnEnd}
                onChange={() => onVoiceKeepAgentsOnEnd?.(!voiceKeepAgentsOnEnd)}
                ariaLabel={t("voice.settingsKeepAgents")}
              />
            </div>
          </div>

          <h2 className="settings-page__h2">{t("voice.settingsAudio")}</h2>
          <div className="settings-card">
            {onVoicePlaybackRate ? (
              <div className="settings-row settings-row--stack">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("voice.playbackRate")}</div>
                  <div className="settings-row__desc">{t("voice.playbackRateDesc")}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    value={Math.round(voicePlaybackRate * 100)}
                    onChange={(e) => onVoicePlaybackRate(Number(e.target.value) / 100)}
                    style={{ flex: 1, maxWidth: 200, accentColor: 'var(--accent)' }}
                    aria-label={t("voice.playbackRate")}
                  />
                  <output style={{ minWidth: 36, textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                    {voicePlaybackRate.toFixed(1)}x
                  </output>
                </div>
              </div>
            ) : null}

            {onVoiceNoiseSuppression ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("voice.noiseSuppression")}</div>
                  <div className="settings-row__desc">{t("voice.noiseSuppressionDesc")}</div>
                </div>
                <UiCheck
                  checked={voiceNoiseSuppression}
                  onChange={() => onVoiceNoiseSuppression(!voiceNoiseSuppression)}
                  ariaLabel={t("voice.noiseSuppression")}
                />
              </div>
            ) : null}

          {onVoiceSensitivity ? (
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">{t("voice.sensitivity")}</div>
                <div className="settings-row__desc">{t("voice.sensitivityDesc")}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={Math.round(voiceSensitivity * 100)}
                  onChange={(e) => onVoiceSensitivity(Number(e.target.value) / 100)}
                  style={{ flex: 1, maxWidth: 200, accentColor: 'var(--accent)' }}
                  aria-label={t("voice.sensitivity")}
                />
                <output style={{ minWidth: 28, textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                  {Math.round(voiceSensitivity * 100)}%
                </output>
              </div>
            </div>
          ) : null}
          </div>

          <h2 className="settings-page__h2">{t("voice.settingsDictation")}</h2>
          <div className="settings-card">
            {onVoiceDictationLanguage ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("voice.dictationLanguage")}</div>
                  <div className="settings-row__desc">{t("voice.dictationLanguageDesc")}</div>
                </div>
                <Select
                  value={voiceDictationLanguage}
                  onChange={(v) => onVoiceDictationLanguage(v)}
                  options={[
                    { value: "auto", label: t("voice.langAuto") },
                    { value: "en", label: "English" },
                    { value: "zh", label: "中文" },
                    { value: "ja", label: "日本語" },
                    { value: "ko", label: "한국어" },
                    { value: "es", label: "Español" },
                    { value: "fr", label: "Français" },
                    { value: "de", label: "Deutsch" },
                  ]}
                  aria-label={t("voice.dictationLanguage")}
                />
              </div>
            ) : null}

            {onVoiceMicDeviceId && micDevices.length > 0 ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("voice.micDevice")}</div>
                  <div className="settings-row__desc">{t("voice.micDeviceDesc")}</div>
                </div>
                <Select
                  value={voiceMicDeviceId || ""}
                  onChange={(v) => onVoiceMicDeviceId(v)}
                  options={[
                    { value: "", label: t("voice.micDefault") },
                    ...micDevices.map((d) => ({
                      value: d.deviceId,
                      label: d.label,
                    })),
                  ]}
                  aria-label={t("voice.micDevice")}
                />
              </div>
            ) : null}

            {onVoiceFeedbackChime ? (
              <div className="settings-row">
                <div className="settings-row__text">
                  <div className="settings-row__label">{t("voice.feedbackChime")}</div>
                  <div className="settings-row__desc">{t("voice.feedbackChimeDesc")}</div>
                </div>
                <UiCheck
                  checked={voiceFeedbackChime}
                  onChange={() => onVoiceFeedbackChime(!voiceFeedbackChime)}
                  ariaLabel={t("voice.feedbackChime")}
                />
              </div>
            ) : null}
          </div>
          </>
        )}

        {section === "account" && (
          <>
            <div className="settings-account-tabs" role="tablist">
              <div className="settings-seg settings-seg--lg" role="presentation">
                <button
                  type="button"
                  role="tab"
                  className={
                    "settings-seg__btn" +
                    (accountTab === "official" ? " is-on" : "")
                  }
                  aria-selected={accountTab === "official"}
                  onClick={() => setAccountTab("official")}
                >
                  {t("settings.tabOfficial")}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={
                    "settings-seg__btn" +
                    (accountTab === "providers" ? " is-on" : "")
                  }
                  aria-selected={accountTab === "providers"}
                  onClick={() => setAccountTab("providers")}
                >
                  {t("settings.tabProviders")}
                </button>
              </div>
              {accountTab === "official" ? (
                <p className="settings-account-tabs__hint">
                  {t("settings.tabOfficialHint")}
                </p>
              ) : null}
            </div>
            {accountTab === "providers" ? (
              <ProvidersPanel
                locale={resolveLocale(locale)}
                officialAvailable={
                  !!(
                    account?.profile?.signedIn ||
                    account?.cliAuthPresent ||
                    account?.hasOfficialKey
                  )
                }
                onProviderActivated={onProviderActivated}
              />
            ) : (
          <AccountPanel
            status={account}
            loading={accountLoading}
            busy={accountBusy}
            locale={locale}
            t={t}
            labels={{
              signedIn: t("account.signedIn"),
              signedOut: t("account.signedOut"),
              loginOauth: t("account.loginOauth"),
              loginDevice: t("account.loginDevice"),
              logout: t("account.logout"),
              refresh: t("account.refresh"),
              refreshing: t("account.refreshing"),
              manageUsage: t("account.manageUsage"),
              subscribe: t("account.subscribe"),
              channel: t("account.channel"),
              subscription: t("account.subscription"),
              quota: t("account.quota"),
              quotaRemaining: t("account.quotaRemaining"),
              quotaUsed: t("account.quotaUsed"),
              quotaUnknown: t("account.quotaUnknown"),
              period: t("account.period"),
              prepaid: t("account.prepaid"),
              onDemand: t("account.onDemand"),
              heatmap: t("account.heatmap"),
              heatmapHint: t("account.heatmapHint"),
              callLogs: t("account.callLogs"),
              callLogsEmpty: t("account.callLogsEmpty"),
              colSession: t("account.col.session"),
              colModel: t("account.col.model"),
              colTurns: t("account.col.turns"),
              colTokens: t("account.col.tokens"),
              colDuration: t("account.col.duration"),
              colWhen: t("account.col.when"),
              less: t("account.heatmap.less"),
              more: t("account.heatmap.more"),
              expired: t("account.expired"),
              team: t("account.team"),
              billingUnavailable: t("account.billingUnavailable"),
              loginBusy: t("account.loginBusy"),
              loginCancel: t("account.loginCancel"),
              resetsAt: t("account.resetsAt"),
              fetchedAt: t("account.fetchedAt"),
              products: t("account.products"),
              heatmapNoData: t("account.heatmap.noData"),
              heatmapAria: t("account.heatmap.aria"),
              heatmapRequests: t("account.heatmap.requests"),
              heatmapTokens: t("account.heatmap.tokens"),
              weeklyTitle: t("account.weeklyTitle"),
              loginHelpTitle: t("account.loginHelpTitle"),
              loginHelpBody: t("account.loginHelpBody"),
              loginTryDevice: t("account.loginTryDevice"),
              profiles: t("account.profiles"),
              profilesHint: t("account.profilesHint"),
              profilesEmpty: t("account.profilesEmpty"),
              profileSave: t("account.profileSave"),
              profileSwitch: t("account.profileSwitch"),
              profileRemove: t("account.profileRemove"),
              profileActive: t("account.profileActive"),
              manageAccounts: t("account.manageAccounts"),
              addAccount: t("account.addAccount"),
              importChat: t("account.importChat"),
              importChatHint: t("account.importChatHint"),
              importChatBtn: t("account.importChatBtn"),
              close: t("common.close"),
            }}
            loginHint={loginHint}
            savedAccounts={savedAccounts}
            activeAccountId={activeAccountId}
            onLoginOauth={onAccountLoginOauth}
            onLoginDevice={onAccountLoginDevice}
            onCancelLogin={onCancelLogin}
            onLogout={onAccountLogout}
            onRefresh={onAccountRefresh}
            onManageUsage={onAccountManageUsage}
            onSubscribe={onAccountSubscribe}
            onSaveAccount={onSaveAccount}
            onAddAccount={onAddAccount}
            onSwitchAccount={onSwitchAccount}
            onRemoveAccount={onRemoveAccount}
            onImportChat={onImportChat}
          />
            )}
          </>
        )}

        {section === "archived" && (
          <>
            <p className="settings-page__lead">
              {t("settings.archived.desc")}
            </p>
            {archivedTotal === 0 ? (
              <div className="settings-card">
                <div className="settings-archived-empty">
                  {t("settings.archived.empty")}
                </div>
              </div>
            ) : (
              <>
                <div className="settings-archived-toolbar">
                  <UiCheck
                    className="ui-check--all"
                    checked={archivedAllSelected}
                    indeterminate={archivedSomeSelected}
                    onChange={toggleArchivedAll}
                    ariaLabel={t("settings.archived.selectAll")}
                    label={
                      archivedAllSelected
                        ? t("settings.archived.deselectAll")
                        : t("settings.archived.selectAll")
                    }
                  />
                  <span className="settings-archived-toolbar__count">
                    {archivedSelectedCount > 0
                      ? t("settings.archived.selectedCount", {
                          n: archivedSelectedCount,
                        })
                      : t("settings.archived.totalCount", {
                          n: archivedTotal,
                        })}
                  </span>
                  <div className="settings-archived-toolbar__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={archivedSelectedCount === 0}
                      onClick={() => {
                        const ids = [...archivedSelected];
                        if (!ids.length) return;
                        onRestoreArchivedSessions?.(ids);
                        setArchivedSelected(new Set());
                      }}
                    >
                      {t("settings.archived.restore")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      disabled={archivedSelectedCount === 0}
                      onClick={() => {
                        const ids = [...archivedSelected];
                        if (!ids.length) return;
                        onDeleteArchivedSessions?.(ids);
                      }}
                    >
                      <IconTrash size={14} />
                      {t("settings.archived.delete")}
                    </button>
                  </div>
                </div>
                <div
                  ref={archivedSurfaceRef}
                  className={
                    "settings-archived-surface" +
                    (marquee ? " is-marqueeing" : "")
                  }
                  onPointerDown={onArchivedPointerDown}
                  onPointerMove={onArchivedPointerMove}
                  onPointerUp={onArchivedPointerUp}
                  onPointerCancel={onArchivedPointerCancel}
                >
                  {marquee
                    ? (() => {
                        const r = marqueeClientRect(marquee);
                        if (r.width < 2 && r.height < 2) return null;
                        return (
                          <div
                            className="settings-archived-marquee"
                            style={{
                              left: r.left,
                              top: r.top,
                              width: r.width,
                              height: r.height,
                            }}
                            aria-hidden
                          />
                        );
                      })()
                    : null}
                  {archivedGroups.map((group) => {
                    const groupIds = group.sessions.map((s) => s.id);
                    const groupAll =
                      groupIds.length > 0 &&
                      groupIds.every((id) => archivedSelected.has(id));
                    const groupSome =
                      !groupAll &&
                      groupIds.some((id) => archivedSelected.has(id));
                    return (
                      <div
                        key={group.id ?? "__orphan__"}
                        className="settings-archived-group"
                      >
                        <h2 className="settings-page__h2">
                          <UiCheck
                            className="ui-check--group"
                            checked={groupAll}
                            indeterminate={groupSome}
                            onChange={() => toggleArchivedGroup(groupIds)}
                            ariaLabel={group.name}
                          />
                          <IconArchive size={15} />
                          <span>{group.name}</span>
                          <span className="settings-archived-group__count">
                            {group.sessions.length}
                          </span>
                        </h2>
                        <div className="settings-card settings-card--flush">
                          {group.sessions.map((s) => {
                            const selected = archivedSelected.has(s.id);
                            return (
                              <div
                                key={s.id}
                                data-archived-id={s.id}
                                className={
                                  "settings-archived-row" +
                                  (selected ? " is-selected" : "")
                                }
                              >
                                <UiCheck
                                  checked={selected}
                                  onChange={() => toggleArchivedId(s.id)}
                                  ariaLabel={
                                    s.title || t("session.untitled")
                                  }
                                />
                                <div className="settings-archived-row__text">
                                  <div className="settings-archived-row__title">
                                    {s.title || t("session.untitled")}
                                  </div>
                                  <div className="settings-archived-row__meta">
                                    {formatSessionWhen(s.updatedAt, locale)}
                                  </div>
                                </div>
                                <div className="settings-archived-row__actions">
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() =>
                                      onRestoreArchivedSessions?.([s.id])
                                    }
                                  >
                                    {t("settings.archived.restore")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm btn--danger"
                                    onClick={() =>
                                      onDeleteArchivedSessions?.([s.id])
                                    }
                                  >
                                    <IconTrash size={14} />
                                    {t("settings.archived.delete")}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {section === "extensions" && (
          <ExtensionsPanel
            locale={resolveLocale(locale)}
            projectPath={projectPath}
            cliFound={cliInfo.found}
            onOpenRuntime={() => onSection("runtime")}
            onSkillsPrefsChanged={onSkillsPrefsChanged}
          />
        )}

        {section === "runtime" && (
          <div className="settings-card">
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("settings.cliPath")}{" "}
                  {cliInfo.found
                    ? `(${cliInfo.source || "ok"})`
                    : t("settings.cliNotFound")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.cliPathDesc")}
                </div>
              </div>
              <input
                className="settings-input"
                value={manualCliPath}
                placeholder={cliInfo.path || "e.g. ~/.grok/bin/grok"}
                onChange={(e) => onManualCliPath(e.target.value)}
                onBlur={(e) => onCliBlur(e.target.value.trim())}
              />
              {cliInfo.version && (
                <div className="settings-row__hint">
                  {cliInfo.version}
                  {cliInfo.path ? ` · ${cliInfo.path}` : ""}
                  {cliInfo.cliAuthPresent
                    ? ` · ${t("account.cliAuthOk")}`
                    : ` · ${t("account.cliAuthMissing")}`}
                </div>
              )}
            </div>
            <AcpServerField
              value={acpServerAddr}
              onChange={onAcpServerAddr}
              t={t}
            />
            <SshTunnelField
              target={sshTunnelTarget}
              onTarget={(v) => onSshTunnelTarget?.(v)}
              remotePort={sshTunnelRemotePort}
              onRemotePort={(v) => onSshTunnelRemotePort?.(v)}
              localPort={sshTunnelLocalPort}
              onLocalPort={(v) => onSshTunnelLocalPort?.(v)}
              identityFile={sshTunnelIdentityFile}
              onIdentityFile={(v) => onSshTunnelIdentityFile?.(v)}
              onConnected={(port) => onAcpServerAddr(formatLoopbackAcpAddr(port))}
              t={t}
            />
            {isWindows && (
              <WslDistroField
                value={wslDistro}
                onChange={(v) => onWslDistro?.(v)}
                t={t}
              />
            )}
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("settings.maxConcurrentAgents")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.maxConcurrentAgentsDesc")}
                </div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={8}
                step={1}
                value={maxConcurrentAgents}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onMaxConcurrentAgents?.(Math.min(8, Math.max(1, Math.round(n))));
                }}
              />
            </div>
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("settings.maxConcurrentTerminals")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.maxConcurrentTerminalsDesc")}
                </div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={8}
                step={1}
                value={maxConcurrentTerminals}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onMaxConcurrentTerminals?.(
                    Math.min(8, Math.max(1, Math.round(n))),
                  );
                }}
              />
            </div>
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("settings.agentIdleMinutes")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.agentIdleMinutesDesc")}
                </div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={1440}
                step={1}
                value={agentIdleMinutes}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onAgentIdleMinutes?.(
                    Math.min(1440, Math.max(1, Math.round(n))),
                  );
                }}
              />
            </div>
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  {t("settings.streamStallSeconds")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.streamStallSecondsDesc")}
                </div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={15}
                max={900}
                step={15}
                value={streamStallSeconds}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onStreamStallSeconds?.(
                    Math.min(900, Math.max(15, Math.round(n))),
                  );
                }}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  <IconDoctor size={16} />
                  {t("doctor.title")}
                </div>
                <div className="settings-row__desc">
                  {t("settings.doctorDesc")}
                </div>
              </div>
              <button
                type="button"
                className="btn btn--ghost settings-row__action"
                onClick={onDoctor}
              >
                {t("settings.runDoctor")}
              </button>
            </div>
            <div className="settings-card settings-card--nested pi-settings-block">
              <ProjectInspectPanel
                locale={resolveLocale(locale)}
                projectPath={projectPath}
                cliFound={cliInfo.found}
              />
            </div>
          </div>
        )}

        {section === "about" && (
          <div className="settings-card">
            <div className="settings-row settings-row--stack">
              <div className="settings-row__text">
                <div className="settings-row__label">
                  <IconInfo size={16} />
                  {t("settings.aboutApp")}
                </div>
                <div className="settings-row__desc">{versionFooter}</div>
              </div>
            </div>
            <AboutUpdateRow t={t} />
          </div>
        )}

        {section !== "account" && section !== "extensions" && section !== "archived" ? (
          <div className="settings-card" style={{ marginTop: 24 }}>
            <div className="settings-row">
              <div className="settings-row__text">
                <div className="settings-row__label">{t("settings.restoreDefaults")}</div>
                <div className="settings-row__desc">{t("settings.restoreDefaultsDesc")}</div>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => {
                  if (window.confirm(t("settings.restoreDefaultsConfirm"))) {
                    onTimestampFormat?.("locale");
                    onSidebarSortOrder?.("updated_at");
                    onWordWrap?.(true);
                    onDiffIgnoreWhitespace?.(true);
                    onConfirmDelete?.(true);
                    onConfirmArchive?.(false);
                    onGlassOpacity?.(80);
                    onSidebarThreadPreviewCount?.(6);
                    onThreadAutoSettleDays?.(null);
                    onAutoOpenTaskPanel?.(false);
                    onAddProjectBaseDir?.("");
                    onEnableProviderUpdateChecks?.(true);
                  }
                }}
              >
                {t("settings.restoreDefaultsBtn")}
              </button>
            </div>
          </div>
        ) : null}
      </main>
      </div>
    </div>
  );
}

/** Shared-mode: list / import Grok Build CLI sessions from GROK_HOME. */
function CliSessionsPanel({
  t,
  onImported,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  onImported?: () => void;
}) {
  const [rows, setRows] = useState<api.CliSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.cliSessionsList();
      setRows(list);
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importOne = async (row: api.CliSessionSummary) => {
    setBusyId(row.agentSessionId);
    setError(null);
    setStatus(null);
    try {
      await api.cliSessionImport(row.agentSessionId, { dir: row.dir });
      setStatus(t("settings.cliSessionsImportedOne", { title: row.title }));
      await refresh();
      onImported?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const importAll = async () => {
    setBusyId("__all__");
    setError(null);
    setStatus(null);
    try {
      const imported = await api.cliSessionsImportAll(50);
      setStatus(
        t("settings.cliSessionsImportedN", { n: String(imported.length) }),
      );
      await refresh();
      onImported?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows.filter((r) => !r.alreadyLinked).length;

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">{t("settings.cliSessions")}</div>
        <div className="settings-row__desc">{t("settings.cliSessionsDesc")}</div>
      </div>
      <div className="settings-cli-sessions">
        <div className="settings-cli-sessions__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loading || !!busyId}
            onClick={() => void refresh()}
          >
            {t("resources.refresh")}
          </button>
          <button
            type="button"
            className="btn btn--solid"
            disabled={loading || !!busyId || pending === 0}
            onClick={() => void importAll()}
          >
            {busyId === "__all__"
              ? t("settings.cliSessionsImporting")
              : t("settings.cliSessionsImportAll", { n: String(pending) })}
          </button>
        </div>
        {error ? (
          <div className="settings-cli-sessions__err" role="alert">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="settings-cli-sessions__ok" role="status">
            {status}
          </div>
        ) : null}
        {loading && rows.length === 0 ? (
          <div className="settings-cli-sessions__empty">
            {t("settings.cliSessionsLoading")}
          </div>
        ) : rows.length === 0 ? (
          <div className="settings-cli-sessions__empty">
            {t("settings.cliSessionsEmpty")}
          </div>
        ) : (
          <ul className="settings-cli-sessions__list">
            {rows.slice(0, 40).map((r) => (
              <li key={r.agentSessionId} className="settings-cli-sessions__item">
                <div className="settings-cli-sessions__meta">
                  <div className="settings-cli-sessions__title">{r.title}</div>
                  <div className="settings-cli-sessions__sub">
                    {r.cwd || r.agentSessionId.slice(0, 12)}
                    {r.numMessages
                      ? ` · ${t("settings.cliSessionsMsgs", { n: String(r.numMessages) })}`
                      : ""}
                  </div>
                </div>
                {r.alreadyLinked ? (
                  <span className="settings-cli-sessions__badge">
                    {t("settings.cliSessionsLinked")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!!busyId}
                    onClick={() => void importOne(r)}
                  >
                    {busyId === r.agentSessionId
                      ? t("settings.cliSessionsImporting")
                      : t("settings.cliSessionsImport")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Export/import the full app settings blob as a JSON file (native dialogs). */
function ExportImportSettingsPanel({
  t,
  onImported,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  onImported?: () => void;
}) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const doExport = async () => {
    setBusy("export");
    setError(null);
    setStatus(null);
    try {
      await api.exportSettings();
      setStatus(t("settings.exportSettingsSuccess"));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy("import");
    setError(null);
    setStatus(null);
    try {
      await api.importSettings();
      setStatus(t("settings.importSettingsSuccess"));
      onImported?.();
    } catch (e) {
      setError(t("settings.importSettingsError", { error: String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">{t("settings.exportSettings")}</div>
        <div className="settings-row__desc">{t("settings.exportSettingsDesc")}</div>
      </div>
      <div className="settings-cli-sessions__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!!busy}
          onClick={() => void doExport()}
        >
          {t("settings.exportSettings")}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!!busy}
          onClick={() => void doImport()}
          title={t("settings.importSettingsDesc")}
        >
          {t("settings.importSettings")}
        </button>
      </div>
      {error ? (
        <div className="settings-cli-sessions__err" role="alert">
          {error}
        </div>
      ) : null}
      {status ? (
        <div className="settings-cli-sessions__ok" role="status">
          {status}
        </div>
      ) : null}
    </div>
  );
}

function AboutUpdateRow({
  t,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<api.AppUpdateCheck | null>(null);

  const check = async () => {
    if (!api.isTauri()) {
      setError("not in Tauri");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.appCheckUpdate();
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const openRelease = async (url: string) => {
    try {
      await api.openExternalUrl(url);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="settings-row settings-row--stack">
      <div className="settings-row__text">
        <div className="settings-row__label">{t("settings.checkUpdate")}</div>
        <div className="settings-row__desc">{t("settings.checkUpdateDesc")}</div>
      </div>
      <div className="settings-about-update">
        <div className="settings-about-update__actions">
          <button
            type="button"
            className="btn btn--solid"
            disabled={busy}
            onClick={() => void check()}
          >
            {busy
              ? t("settings.checkUpdateChecking")
              : t("settings.checkUpdate")}
          </button>
          {result?.updateAvailable ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void openRelease(result.htmlUrl)}
            >
              {t("settings.checkUpdateOpen")}
            </button>
          ) : null}
        </div>
        {error ? (
          <div className="settings-about-update__err" role="alert">
            {t("settings.checkUpdateFailed", { error })}
          </div>
        ) : null}
        {result && !error ? (
          <div
            className={
              "settings-about-update__status" +
              (result.updateAvailable ? " is-available" : "")
            }
            role="status"
          >
            {result.updateAvailable
              ? t("settings.checkUpdateAvailable", {
                  latest: result.latestVersion,
                  current: result.currentVersion,
                })
              : t("settings.checkUpdateLatest", {
                  version: result.currentVersion,
                })}
          </div>
        ) : null}
        {result?.updateAvailable && result.assetNames.length > 0 ? (
          <div className="settings-about-update__assets">
            {result.assetNames.slice(0, 6).join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
