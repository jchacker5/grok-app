import { describe, expect, it } from "vitest";
import type { FsEntry } from "@/lib/api";
import type { ModelOption } from "@/lib/grokCatalog";
import type { SearchableSession } from "@/lib/sessionSearch";
import {
  buildFileMentionItems,
  buildMentionEntries,
  buildModelMentionItems,
  buildSessionMentionItems,
  filterMentionItems,
  type MentionItem,
} from "./mentionCatalog";

function fsEntry(overrides: Partial<FsEntry> = {}): FsEntry {
  return {
    name: "App.tsx",
    relativePath: "src/App.tsx",
    isDir: false,
    size: 100,
    ext: "tsx",
    ...overrides,
  };
}

describe("buildFileMentionItems", () => {
  it("maps FsEntry[] to file MentionItems with @file: insertText", () => {
    const entries: FsEntry[] = [
      fsEntry({ name: "App.tsx", relativePath: "src/App.tsx" }),
      fsEntry({
        name: "components",
        relativePath: "src/components",
        isDir: true,
      }),
    ];
    const items = buildFileMentionItems(entries);
    expect(items).toEqual([
      {
        id: "file:src/App.tsx",
        kind: "file",
        label: "App.tsx",
        detail: "src/App.tsx",
        insertText: "@file:src/App.tsx ",
      },
      {
        id: "file:src/components",
        kind: "file",
        label: "components",
        detail: "src/components/",
        insertText: "@file:src/components ",
      },
    ]);
  });

  it("empty entries → empty items", () => {
    expect(buildFileMentionItems([])).toEqual([]);
  });
});

describe("buildModelMentionItems", () => {
  it("maps ModelOption[] to model MentionItems with @model: insertText", () => {
    const models: ModelOption[] = [
      { id: "grok-4.5", label: "Grok 4.5", isDefault: true },
    ];
    expect(buildModelMentionItems(models)).toEqual([
      {
        id: "model:grok-4.5",
        kind: "model",
        label: "Grok 4.5",
        detail: "grok-4.5",
        insertText: "@model:grok-4.5 ",
      },
    ]);
  });
});

describe("buildSessionMentionItems", () => {
  it("maps SearchableSession[] to session MentionItems with @session: insertText", () => {
    const sessions: SearchableSession[] = [
      { id: "s1", title: "Fix login bug" },
    ];
    expect(buildSessionMentionItems(sessions)).toEqual([
      {
        id: "session:s1",
        kind: "session",
        label: "Fix login bug",
        detail: "s1",
        insertText: '@session:"Fix login bug" ',
      },
    ]);
  });

  it("falls back to id when title is blank", () => {
    const sessions: SearchableSession[] = [{ id: "s2", title: "  " }];
    const [item] = buildSessionMentionItems(sessions);
    expect(item!.label).toBe("s2");
    expect(item!.insertText).toBe('@session:"s2" ');
  });

  it("strips double quotes from the title so insertText stays parseable", () => {
    const sessions: SearchableSession[] = [
      { id: "s3", title: 'Say "hi" nicely' },
    ];
    const [item] = buildSessionMentionItems(sessions);
    expect(item!.insertText).toBe("@session:\"Say 'hi' nicely\" ");
  });
});

describe("filterMentionItems", () => {
  const items: MentionItem[] = [
    {
      id: "file:src/App.tsx",
      kind: "file",
      label: "App.tsx",
      detail: "src/App.tsx",
      insertText: "@file:src/App.tsx ",
    },
    {
      id: "model:grok-4.5",
      kind: "model",
      label: "Grok 4.5",
      detail: "grok-4.5",
      insertText: "@model:grok-4.5 ",
    },
    {
      id: "session:s1",
      kind: "session",
      label: "Fix login bug",
      detail: "s1",
      insertText: '@session:"Fix login bug" ',
    },
  ];

  it("empty query, no kind → returns everything", () => {
    expect(filterMentionItems(items, null, "")).toEqual(items);
  });

  it("kind scopes to that kind only", () => {
    expect(filterMentionItems(items, "file", "")).toEqual([items[0]]);
    expect(filterMentionItems(items, "model", "")).toEqual([items[1]]);
    expect(filterMentionItems(items, "session", "")).toEqual([items[2]]);
  });

  it("case-insensitive substring match on label", () => {
    expect(filterMentionItems(items, null, "grok")).toEqual([items[1]]);
    expect(filterMentionItems(items, null, "GROK")).toEqual([items[1]]);
  });

  it("matches on detail too", () => {
    expect(filterMentionItems(items, null, "src/app")).toEqual([items[0]]);
  });

  it("no match → empty array", () => {
    expect(filterMentionItems(items, null, "nope-nothing-here")).toEqual([]);
  });
});

describe("buildMentionEntries", () => {
  const files: MentionItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `file:f${i}`,
    kind: "file" as const,
    label: `file${i}.ts`,
    insertText: `@file:f${i} `,
  }));
  const models: MentionItem[] = [
    { id: "model:a", kind: "model", label: "Model A", insertText: "@model:a " },
  ];
  const sessions: MentionItem[] = [
    {
      id: "session:s1",
      kind: "session",
      label: "Session One",
      insertText: '@session:"Session One" ',
    },
  ];

  it("bare @ (kind null) caps each section to capPerSection (default 6)", () => {
    const entries = buildMentionEntries({
      kind: null,
      query: "",
      files,
      models,
      sessions,
    });
    const fileEntries = entries.filter((e) => e.kind === "file");
    expect(fileEntries.length).toBe(6);
    expect(entries.filter((e) => e.kind === "model").length).toBe(1);
    expect(entries.filter((e) => e.kind === "session").length).toBe(1);
    // Order: files, then models, then sessions.
    expect(entries[0]!.kind).toBe("file");
    expect(entries[entries.length - 2]!.kind).toBe("model");
    expect(entries[entries.length - 1]!.kind).toBe("session");
  });

  it("kind prefix narrows to just that section, uncapped", () => {
    const entries = buildMentionEntries({
      kind: "file",
      query: "",
      files,
      models,
      sessions,
    });
    expect(entries.length).toBe(10);
    expect(entries.every((e) => e.kind === "file")).toBe(true);
  });

  it("custom capPerSection is honored", () => {
    const entries = buildMentionEntries({
      kind: null,
      query: "",
      files,
      models,
      sessions,
      capPerSection: 2,
    });
    expect(entries.filter((e) => e.kind === "file").length).toBe(2);
  });

  it("query filters within the combined view", () => {
    const entries = buildMentionEntries({
      kind: null,
      query: "session one",
      files,
      models,
      sessions,
    });
    expect(entries).toEqual([sessions[0]]);
  });
});
