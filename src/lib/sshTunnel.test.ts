import { describe, expect, it } from "vitest";
import {
  formatLoopbackAcpAddr,
  isLoopbackAcpAddr,
  isValidPort,
  splitHostPort,
  validateSshTarget,
} from "./sshTunnel";

describe("splitHostPort", () => {
  it("splits host:port", () => {
    expect(splitHostPort("127.0.0.1:8799")).toEqual({
      host: "127.0.0.1",
      port: "8799",
    });
  });

  it("returns the whole string as host when there is no colon", () => {
    expect(splitHostPort("localhost")).toEqual({ host: "localhost", port: "" });
  });
});

describe("isLoopbackAcpAddr", () => {
  it("treats empty/unset as loopback", () => {
    expect(isLoopbackAcpAddr(undefined)).toBe(true);
    expect(isLoopbackAcpAddr(null)).toBe(true);
    expect(isLoopbackAcpAddr("")).toBe(true);
    expect(isLoopbackAcpAddr("   ")).toBe(true);
  });

  it("treats 127.0.0.1 and localhost as loopback", () => {
    expect(isLoopbackAcpAddr("127.0.0.1:8799")).toBe(true);
    expect(isLoopbackAcpAddr("localhost:8799")).toBe(true);
    expect(isLoopbackAcpAddr("LOCALHOST:8799")).toBe(true);
  });

  it("flags a remote host as non-loopback", () => {
    expect(isLoopbackAcpAddr("203.0.113.5:8799")).toBe(false);
    expect(isLoopbackAcpAddr("build-host.example.com:8799")).toBe(false);
  });
});

describe("formatLoopbackAcpAddr", () => {
  it("formats a rounded local port", () => {
    expect(formatLoopbackAcpAddr(8799)).toBe("127.0.0.1:8799");
    expect(formatLoopbackAcpAddr(8799.6)).toBe("127.0.0.1:8800");
  });
});

describe("validateSshTarget", () => {
  it("rejects empty input", () => {
    expect(validateSshTarget("").valid).toBe(false);
    expect(validateSshTarget("   ").valid).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(validateSshTarget("user@ host").valid).toBe(false);
  });

  it("rejects a bare '@' with no host", () => {
    expect(validateSshTarget("user@").valid).toBe(false);
  });

  it("accepts user@host", () => {
    expect(validateSshTarget("user@host.example.com").valid).toBe(true);
  });

  it("accepts a bare host with no user", () => {
    expect(validateSshTarget("host.example.com").valid).toBe(true);
  });
});

describe("isValidPort", () => {
  it("accepts 1-65535 integers", () => {
    expect(isValidPort(1)).toBe(true);
    expect(isValidPort(8799)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
  });

  it("rejects out-of-range, non-integer, and missing values", () => {
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(8799.5)).toBe(false);
    expect(isValidPort(null)).toBe(false);
    expect(isValidPort(undefined)).toBe(false);
  });
});
