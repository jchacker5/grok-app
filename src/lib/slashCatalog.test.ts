import { describe, expect, it } from "vitest";
import {
  buildSlashCatalog,
  builtinSlashItems,
  customCommandsToSlashItems,
  filterSlashItems,
  skillsToSlashItems,
  type CustomCommandInfo,
  type SkillInfo,
  type SlashItem,
} from "./slashCatalog";

describe("builtinSlashItems", () => {
  it("includes expected commands with i18n keys", () => {
    const items = builtinSlashItems();
    const names = items.map((i) => i.name);
    expect(names).toEqual([
      "goal",
      "plan",
      "compact",
      "status",
      "mcp",
      "doctor",
      "new",
      "automations",
      "gh",
      "settings",
      "commands",
      "yolo",
    ]);

    const goal = items.find((i) => i.name === "goal")!;
    expect(goal.kind).toBe("mode");
    expect(goal.mode).toBe("goal");
    expect(goal.titleKey).toBe("slash.goal");
    expect(goal.descriptionKey).toBe("slash.goalDesc");

    const plan = items.find((i) => i.name === "plan")!;
    expect(plan.kind).toBe("mode");
    expect(plan.mode).toBe("plan");

    const compact = items.find((i) => i.name === "compact")!;
    expect(compact.kind).toBe("action");
    expect(compact.action).toBe("compact");

    const doctor = items.find((i) => i.name === "doctor")!;
    expect(doctor.kind).toBe("action");
    expect(doctor.action).toBe("doctor");

    const yolo = items.find((i) => i.name === "yolo")!;
    expect(yolo.kind).toBe("action");
    expect(yolo.action).toBe("yolo");

    const gh = items.find((i) => i.name === "gh")!;
    expect(gh.kind).toBe("action");
    expect(gh.action).toBe("github");
    expect(gh.titleKey).toBe("slash.github");
    expect(gh.descriptionKey).toBe("slash.githubDesc");
  });
});

describe("skillsToSlashItems", () => {
  it("maps skill info to slash items", () => {
    const skills: SkillInfo[] = [
      {
        name: "aihot",
        description: "Hot tips",
        source: "user",
        userInvocable: true,
      },
      { name: "hidden", description: "nope", userInvocable: false },
    ];
    const items = skillsToSlashItems(skills);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "skill:aihot",
      kind: "skill",
      name: "aihot",
      displayTitle: "aihot",
      displayDescription: "Hot tips",
      source: "user",
    });
  });

  it("includes skills when userInvocable is undefined", () => {
    expect(
      skillsToSlashItems([{ name: "x", description: "d" }]),
    ).toHaveLength(1);
  });
});

describe("filterSlashItems", () => {
  const items: SlashItem[] = [
    {
      id: "goal",
      kind: "mode",
      name: "goal",
      titleKey: "slash.goal",
      mode: "goal",
    },
    {
      id: "skill:aihot",
      kind: "skill",
      name: "aihot",
      displayTitle: "aihot",
      displayDescription: "AI hot reload helper",
    },
    {
      id: "doctor",
      kind: "action",
      name: "doctor",
      displayDescription: "health check",
    },
  ];

  it("returns all on empty query", () => {
    expect(filterSlashItems(items, "")).toHaveLength(3);
    expect(filterSlashItems(items, "  ")).toHaveLength(3);
  });

  it("filters by name substring", () => {
    expect(filterSlashItems(items, "go").map((i) => i.name)).toEqual(["goal"]);
    expect(filterSlashItems(items, "aih").map((i) => i.name)).toEqual([
      "aihot",
    ]);
  });

  it("filters by description only when query length >= 4", () => {
    expect(filterSlashItems(items, "health").map((i) => i.name)).toEqual([
      "doctor",
    ]);
    // "hot" is 3 chars — name-only; aihot matches by name, doctor does not
    expect(filterSlashItems(items, "hot").map((i) => i.name)).toEqual([
      "aihot",
    ]);
  });

  it("does not match description for short queries", () => {
    const onlyName = filterSlashItems(items, "a").map((i) => i.name);
    expect(onlyName).not.toContain("doctor");
  });

  it("dedupes skills by name", () => {
    const skills: SkillInfo[] = [
      { name: "make-pdf", description: "a" },
      { name: "make-pdf", description: "b" },
      { name: "docx", description: "c" },
    ];
    const items = skillsToSlashItems(skills);
    expect(items.map((i) => i.name)).toEqual(["make-pdf", "docx"]);
  });

  it("is case-insensitive", () => {
    expect(filterSlashItems(items, "GOAL").map((i) => i.name)).toEqual([
      "goal",
    ]);
  });

  it("matches resolved Chinese i18n titles", () => {
    const resolve = (item: SlashItem) => {
      if (item.name === "goal") return { title: "目标", description: "设置目标" };
      if (item.name === "aihot")
        return { title: "aihot", description: "中文资讯热点" };
      return {};
    };
    expect(
      filterSlashItems(items, "目标", resolve).map((i) => i.name),
    ).toEqual(["goal"]);
    expect(
      filterSlashItems(items, "资讯", resolve).map((i) => i.name),
    ).toEqual(["aihot"]);
  });

  it("matches Chinese in displayDescription without resolver", () => {
    const zh: SlashItem[] = [
      {
        id: "skill:x",
        kind: "skill",
        name: "x",
        displayTitle: "x",
        displayDescription: "查询 AI 热点新闻",
      },
    ];
    expect(filterSlashItems(zh, "热点").map((i) => i.name)).toEqual(["x"]);
  });
});

describe("buildSlashCatalog", () => {
  it("splits commands and skills", () => {
    const skills: SkillInfo[] = [
      { name: "s1", description: "one" },
      { name: "s2", description: "two", userInvocable: false },
    ];
    const cat = buildSlashCatalog(skills);
    expect(cat.commands).toEqual(builtinSlashItems());
    expect(cat.skills).toHaveLength(1);
    expect(cat.skills[0]!.name).toBe("s1");
  });

  it("merges user-defined custom commands after built-ins", () => {
    const customCommands: CustomCommandInfo[] = [
      {
        id: "c1",
        name: "review",
        description: "Insert a code review prompt",
        actionType: "insertText",
        actionValue: "Please review this code.",
      },
    ];
    const cat = buildSlashCatalog([], customCommands);
    expect(cat.commands).toHaveLength(builtinSlashItems().length + 1);
    const custom = cat.commands.find((i) => i.name === "review")!;
    expect(custom.kind).toBe("custom");
    expect(custom.customActionType).toBe("insertText");
    expect(custom.customActionValue).toBe("Please review this code.");
  });
});

describe("customCommandsToSlashItems", () => {
  it("maps custom commands to slash items", () => {
    const cmds: CustomCommandInfo[] = [
      {
        id: "abc",
        name: "standup",
        description: "Open the automations panel",
        actionType: "openPanel",
        actionValue: "automations",
      },
    ];
    const items = customCommandsToSlashItems(cmds);
    expect(items).toEqual([
      {
        id: "custom:abc",
        kind: "custom",
        name: "standup",
        displayTitle: "standup",
        displayDescription: "Open the automations panel",
        customActionType: "openPanel",
        customActionValue: "automations",
      },
    ]);
  });

  it("dedupes by name", () => {
    const cmds: CustomCommandInfo[] = [
      {
        id: "a",
        name: "dup",
        description: "first",
        actionType: "insertText",
        actionValue: "x",
      },
      {
        id: "b",
        name: "dup",
        description: "second",
        actionType: "insertText",
        actionValue: "y",
      },
    ];
    expect(customCommandsToSlashItems(cmds)).toHaveLength(1);
  });
});
