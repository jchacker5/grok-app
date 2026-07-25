/**
 * Pure helpers for the SSH tunnel manager UI (`SshTunnelField` /
 * `WslDistroField` in `SettingsPage.tsx`) — kept free of Tauri/React so they
 * can be unit-tested directly.
 *
 * The tunnel manager itself is a convenience layer on top of the
 * already-existing raw-TCP "ACP server (API mode)" transport
 * (`acpServerAddr` / `acp_client::connect_tcp`), which has no auth/TLS of its
 * own — `isLoopbackAcpAddr` backs the security-nudge warning shown next to
 * that field when it points somewhere other than the local machine.
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Split `host:port` (IPv4/hostname form) into `{ host, port }`. No IPv6
 * bracket support beyond the loopback literal above — not needed for the
 * simple `127.0.0.1:<port>` values this feature produces/consumes. */
export function splitHostPort(addr: string): { host: string; port: string } {
  const trimmed = addr.trim();
  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) return { host: trimmed, port: "" };
  return { host: trimmed.slice(0, idx), port: trimmed.slice(idx + 1) };
}

/**
 * True when an ACP server address (`host:port`, or empty/unset) resolves to
 * the local machine — i.e. it's safe to assume the raw, unauthenticated TCP
 * transport is not exposed beyond localhost. Empty/unset counts as loopback
 * (local CLI spawn path, no remote address configured at all).
 */
export function isLoopbackAcpAddr(addr: string | null | undefined): boolean {
  const trimmed = (addr ?? "").trim();
  if (!trimmed) return true;
  const { host } = splitHostPort(trimmed);
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/** Build the `127.0.0.1:<port>` value written into the ACP server field on a
 * successful tunnel connect. */
export function formatLoopbackAcpAddr(localPort: number): string {
  return `127.0.0.1:${Math.round(localPort)}`;
}

export interface SshTargetValidation {
  valid: boolean;
  /** Reason the target is invalid; unset when `valid` is true. */
  error?: string;
}

/**
 * Loose validation for the `user@host` SSH target field — just enough to
 * catch obviously-empty/malformed input before spawning `ssh`; the real
 * validation is `ssh` itself failing fast (BatchMode + ExitOnForwardFailure).
 */
export function validateSshTarget(target: string): SshTargetValidation {
  const trimmed = target.trim();
  if (!trimmed) {
    return { valid: false, error: "Target is required (e.g. user@host)." };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, error: "Target must not contain whitespace." };
  }
  // Accept "host" or "user@host" — host may be a hostname or IP literal.
  const at = trimmed.indexOf("@");
  const host = at >= 0 ? trimmed.slice(at + 1) : trimmed;
  if (!host || at === trimmed.length - 1) {
    return { valid: false, error: "Missing host after '@'." };
  }
  return { valid: true };
}

/** 1-65535 port validation shared by remote/local port inputs. */
export function isValidPort(port: number | null | undefined): boolean {
  return (
    typeof port === "number" &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}
