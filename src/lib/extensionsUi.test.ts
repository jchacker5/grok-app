import { describe, expect, it } from "vitest";
import {
  buildPluginComponentGraph,
  countDisabled,
  filterEnabledByName,
  filterPluginsByLoadState,
  isCliMissingError,
  isExtensionEnabled,
  mergeEnableSet,
  mergeInspectErrors,
  mcpMetaLine,
  normalizePluginInstallSource,
  normalizePluginUpdateName,
  normalizeSkillSource,
  pluginLoadLabel,
  pluginMetaLine,
  pluginProvidesLine,
  pluginRowKey,
  pluginStatusTone,
  shortPathLabel,
  skillMetaLine,
  skillSourceTone,
  sortMcpByName,
  sortPluginsByName,
  sortSkillsByName,
  truncateInstallLog,
} from "./extensionsUi";

describe("enable-set merge / filter", () => {
  it("defaults to enabled when missing", () => {
    expect(isExtensionEnabled(undefined)).toBe(true);
    expect(isExtensionEnabled(null)).toBe(true);
    expect(isExtensionEnabled(true)).toBe(true);
    expect(isExtensionEnabled(false)).toBe(false);
  });

  it("mergeEnableSet builds default-on map with overlay", () => {
    expect(mergeEnableSet(["a", "b", "c"], { b: false })).toEqual({
      a: true,
      b: false,
      c: true,
    });
    expect(mergeEnableSet(["a"], null)).toEqual({ a: true });
    expect(mergeEnableSet(["  ", "x"], { x: false })).toEqual({ x: false });
  });

  it("filterEnabledByName drops only explicit false", () => {
    const items = [{ name: "keep" }, { name: "drop" }, { name: "default" }];
    expect(filterEnabledByName(items, { drop: false }).map((i) => i.name)).toEqual([
      "keep",
      "default",
    ]);
    expect(filterEnabledByName(items, undefined).map((i) => i.name)).toEqual([
      "keep",
      "drop",
      "default",
    ]);
  });

  it("countDisabled only counts explicit false", () => {
    expect(countDisabled(["a", "b", "c"], { a: false, b: true })).toBe(1);
    expect(countDisabled(["a"], {})).toBe(0);
  });
});

describe("isCliMissingError", () => {
  it("detects host CLI missing message", () => {
    expect(isCliMissingError("Grok Build CLI not found")).toBe(true);
    expect(isCliMissingError("CLI not found")).toBe(true);
  });

  it("ignores other errors and empty", () => {
    expect(isCliMissingError(null)).toBe(false);
    expect(isCliMissingError("")).toBe(false);
    expect(isCliMissingError("grok inspect timed out after 12s")).toBe(false);
    expect(isCliMissingError("Failed to parse grok inspect JSON")).toBe(false);
  });
});

describe("normalizeSkillSource / skillSourceTone", () => {
  it("normalizes empty source", () => {
    expect(normalizeSkillSource("")).toBe("unknown");
    expect(normalizeSkillSource(null)).toBe("unknown");
    expect(normalizeSkillSource("  project  ")).toBe("project");
  });

  it("maps known tones", () => {
    expect(skillSourceTone("user")).toBe("user");
    expect(skillSourceTone("project")).toBe("project");
    expect(skillSourceTone("plugin")).toBe("plugin");
    expect(skillSourceTone("something-else")).toBe("muted");
  });
});

describe("skillMetaLine / mcpMetaLine", () => {
  it("builds skill meta", () => {
    expect(
      skillMetaLine({
        name: "demo",
        source: "user",
        userInvocable: true,
      }),
    ).toBe("user · user-invocable");
    expect(
      skillMetaLine({ name: "x", source: "project", userInvocable: false }),
    ).toBe("project");
  });

  it("builds mcp meta and skips empties", () => {
    expect(
      mcpMetaLine({
        name: "s",
        transport: "stdio",
        compatibilityStatus: "ok",
        vendor: "xai",
      }),
    ).toBe("stdio · ok · xai");
    expect(
      mcpMetaLine({
        name: "s",
        transport: "  ",
        compatibilityStatus: null,
        vendor: "acme",
      }),
    ).toBe("acme");
  });
});

describe("sort helpers", () => {
  it("sorts skills and mcp by name case-insensitively", () => {
    expect(sortSkillsByName([{ name: "zeta" }, { name: "Alpha" }]).map((s) => s.name)).toEqual([
      "Alpha",
      "zeta",
    ]);
    expect(sortMcpByName([{ name: "b" }, { name: "a" }]).map((s) => s.name)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("shortPathLabel", () => {
  it("returns short paths unchanged", () => {
    expect(shortPathLabel("/tmp/a")).toBe("/tmp/a");
  });

  it("truncates long paths keeping basename tail", () => {
    const long =
      "/Users/someone/Library/Application Support/com.grokapp.grok-app/agent-home/skills/my-skill/SKILL.md";
    const label = shortPathLabel(long, 40);
    expect(label.startsWith("…")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(40);
    expect(label.includes("SKILL.md") || label.includes("my-skill")).toBe(true);
  });

  it("handles empty", () => {
    expect(shortPathLabel("")).toBe("");
    expect(shortPathLabel(null)).toBe("");
  });
});

describe("mergeInspectErrors", () => {
  it("returns null when both empty", () => {
    expect(mergeInspectErrors(null, undefined)).toBeNull();
    expect(mergeInspectErrors("", "")).toBeNull();
  });

  it("prefers CLI missing message", () => {
    expect(
      mergeInspectErrors("Grok Build CLI not found", "timeout"),
    ).toBe("Grok Build CLI not found");
    expect(
      mergeInspectErrors("timeout", "Grok Build CLI not found"),
    ).toBe("Grok Build CLI not found");
  });

  it("dedupes identical messages", () => {
    expect(mergeInspectErrors("same", "same")).toBe("same");
  });

  it("joins distinct non-cli errors", () => {
    expect(mergeInspectErrors("a", "b")).toBe("a · b");
  });

  it("includes plugins error and prefers CLI missing across three", () => {
    expect(mergeInspectErrors("a", "b", "c")).toBe("a · b · c");
    expect(
      mergeInspectErrors("timeout", null, "Grok Build CLI not found"),
    ).toBe("Grok Build CLI not found");
  });
});

describe("plugin helpers", () => {
  it("sorts plugins by name", () => {
    expect(
      sortPluginsByName([{ name: "zeta" }, { name: "Alpha" }]).map((p) => p.name),
    ).toEqual(["Alpha", "zeta"]);
  });

  it("maps load state separately from CLI install status", () => {
    expect(pluginLoadLabel(true)).toBe("enabled");
    expect(pluginLoadLabel(false)).toBe("disabled");
    expect(pluginStatusTone("installed", false)).toBe("disabled");
    expect(pluginStatusTone("installed", true)).toBe("enabled");
  });

  it("builds plugin meta, provides, and row key like Grok Build", () => {
    expect(
      pluginMetaLine({
        name: "demo",
        scope: "user",
        version: "1.5.0",
        marketplace: "xAI Official",
      }),
    ).toBe("user · v1.5.0 · xAI Official");
    expect(
      pluginMetaLine({
        name: "demo",
        source: "https://github.com/ChromeDevTools/chrome-devtools-mcp",
      }),
    ).toContain("ChromeDevTools/chrome-devtools-mcp");
    expect(
      pluginProvidesLine({
        name: "superpowers",
        provides: { skills: 14, agents: 0, hooks: true, mcpServers: 0 },
      }),
    ).toBe("14 skills · hooks");
    expect(
      pluginProvidesLine({
        name: "github",
        provides: { skills: 0, agents: 0, hooks: false, mcpServers: 1 },
      }),
    ).toBe("1 MCP");
    expect(
      pluginRowKey({
        name: "cloudflare",
        repoKey: "skills-39968d19",
      }),
    ).toBe("skills-39968d19:cloudflare");
    expect(pluginRowKey({ name: "solo" })).toBe("solo");
  });

  it("filters by load state (Grok Build f key)", () => {
    const rows = [
      { name: "a", enabled: true },
      { name: "b", enabled: false },
      { name: "c", enabled: true },
    ];
    expect(filterPluginsByLoadState(rows, "all").map((p) => p.name)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(filterPluginsByLoadState(rows, "enabled").map((p) => p.name)).toEqual([
      "a",
      "c",
    ]);
    expect(filterPluginsByLoadState(rows, "disabled").map((p) => p.name)).toEqual([
      "b",
    ]);
  });

  it("normalizes install source and update name", () => {
    expect(normalizePluginInstallSource("  owner/repo  ")).toBe("owner/repo");
    expect(
      normalizePluginInstallSource("https://github.com/a/b.git"),
    ).toBe("https://github.com/a/b.git");
    expect(normalizePluginInstallSource("/tmp/plugin")).toBe("/tmp/plugin");
    expect(normalizePluginInstallSource("")).toBeNull();
    expect(normalizePluginInstallSource("   ")).toBeNull();
    expect(normalizePluginInstallSource(null)).toBeNull();

    expect(normalizePluginUpdateName("  demo ")).toBe("demo");
    expect(normalizePluginUpdateName("")).toBeNull();
    expect(normalizePluginUpdateName(undefined)).toBeNull();
  });
});

describe("truncateInstallLog", () => {
  it("returns the log unchanged when under the cap", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    expect(truncateInstallLog(lines, 500, 50, 50)).toEqual(lines);
  });

  it("keeps head + tail with an omission marker once over the cap", () => {
    const lines = Array.from({ length: 120 }, (_, i) => `line ${i}`);
    const out = truncateInstallLog(lines, 100, 10, 10);
    expect(out).toHaveLength(21);
    expect(out.slice(0, 10)).toEqual(lines.slice(0, 10));
    expect(out[10]).toBe("… 100 lines omitted …");
    expect(out.slice(11)).toEqual(lines.slice(-10));
  });

  it("is a no-op when head+tail already cover the whole log", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    expect(truncateInstallLog(lines, 10, 10, 10)).toEqual(lines);
  });
});

describe("buildPluginComponentGraph", () => {
  const plugins = [
    {
      name: "superpowers",
      path: "/home/user/.grok/installed-plugins/superpowers",
      enabled: true,
      version: "1.2.0",
      provides: { skills: 2, agents: 0, hooks: false, mcpServers: 1 },
    },
    {
      name: "disabled-plugin",
      path: "/home/user/.grok/installed-plugins/disabled-plugin",
      enabled: false,
      provides: { skills: 0, agents: 0, hooks: false, mcpServers: 0 },
    },
  ];

  it("attributes skills and MCP servers by path containment under a plugin dir", () => {
    const skills = [
      {
        name: "brainstorm",
        source: "plugin",
        path: "/home/user/.grok/installed-plugins/superpowers/skills/brainstorm/SKILL.md",
      },
      { name: "user-skill", source: "user", path: "/home/user/.grok/skills/user-skill/SKILL.md" },
    ];
    const servers = [
      {
        name: "sp-server",
        target: "/home/user/.grok/installed-plugins/superpowers/mcp/sp-server",
      },
    ];
    const graph = buildPluginComponentGraph(plugins, skills, servers);

    const superpowersNode = graph.plugins.find((p) => p.name === "superpowers");
    expect(superpowersNode?.attributedCount).toBe(2);
    expect(graph.components.some((c) => c.name === "brainstorm" && c.kind === "skill")).toBe(
      true,
    );
    expect(graph.components.some((c) => c.name === "sp-server" && c.kind === "mcp")).toBe(true);
    expect(graph.unattributedSkills).toBe(1);
    expect(graph.unattributedMcp).toBe(0);
    const brainstormEdge = graph.edges.find((e) => e.to.includes("brainstorm"));
    expect(brainstormEdge?.from).toBe(`plugin:${pluginRowKey(plugins[0])}`);
  });

  it("flags same-name components as conflicts", () => {
    const skills = [
      {
        name: "shared-name",
        source: "plugin",
        path: "/home/user/.grok/installed-plugins/superpowers/skills/shared-name/SKILL.md",
      },
      {
        name: "shared-name",
        source: "plugin",
        path: "/home/user/.grok/installed-plugins/disabled-plugin/skills/shared-name/SKILL.md",
      },
    ];
    const graph = buildPluginComponentGraph(plugins, skills, []);
    expect(graph.components.every((c) => c.conflict)).toBe(true);
  });

  it("leaves skills/servers with no matching plugin dir as unattributed", () => {
    const graph = buildPluginComponentGraph(
      plugins,
      [{ name: "loose", source: "user", path: "/home/user/somewhere/loose/SKILL.md" }],
      [{ name: "loose-mcp", target: "not-a-path" }],
    );
    expect(graph.unattributedSkills).toBe(1);
    expect(graph.unattributedMcp).toBe(1);
    expect(graph.components).toHaveLength(0);
  });

  it("marks the graph as large past the node threshold", () => {
    const bigPlugins = Array.from({ length: 60 }, (_, i) => ({
      name: `p${i}`,
      path: `/plugins/p${i}`,
      enabled: true,
    }));
    const graph = buildPluginComponentGraph(bigPlugins, [], []);
    expect(graph.isLarge).toBe(true);
  });

  it("does not falsely attribute a plugin whose name is a prefix of another", () => {
    const prefixPlugins = [
      { name: "foo", path: "/plugins/foo", enabled: true },
      { name: "foobar", path: "/plugins/foobar", enabled: true },
    ];
    const skills = [
      { name: "s1", source: "plugin", path: "/plugins/foobar/skills/s1/SKILL.md" },
    ];
    const graph = buildPluginComponentGraph(prefixPlugins, skills, []);
    const edge = graph.edges[0];
    expect(edge.from).toBe(`plugin:${pluginRowKey(prefixPlugins[1])}`);
  });
});
