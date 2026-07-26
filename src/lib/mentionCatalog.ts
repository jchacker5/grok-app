/**
 * `@`-mention catalog: `@file:`, `@model:`, `@session:` builders + filter.
 *
 * Mentions are a pure client-side text-expansion convenience — the agent
 * CLI/ACP protocol has no awareness of `@`-mention syntax. Selecting a
 * mention only splices plain readable text into the composer draft (e.g.
 * `@file:src/App.tsx `, `@model:grok-4.5 `, `@session:"Fix login bug" `).
 * Selecting `@model:`/`@session:` never switches the active model/session —
 * that's ComposerModelMenu's job; a mention duplicating it would confuse.
 */

import type { FsEntry } from "@/lib/api";
import type { ModelOption } from "@/lib/grokCatalog";
import type { SearchableSession } from "@/lib/sessionSearch";

export type MentionKind = "file" | "model" | "session";

export type MentionItem = {
  id: string;
  kind: MentionKind;
  label: string;
  detail?: string;
  insertText: string;
};

/** File entries — reuses the existing `fsListDir`/`fs_browser.rs` shape (project-root scoped, current dir only, non-recursive). */
export function buildFileMentionItems(entries: FsEntry[]): MentionItem[] {
  return entries.map((e) => {
    const relative = e.relativePath || e.name;
    return {
      id: `file:${relative}`,
      kind: "file" as const,
      label: e.name,
      detail: e.isDir ? `${relative}/` : relative,
      insertText: `@file:${relative} `,
    };
  });
}

/** Model entries — reuses the same `ModelOption[]` catalog as `ComposerModelMenu`. */
export function buildModelMentionItems(models: ModelOption[]): MentionItem[] {
  return models.map((m) => ({
    id: `model:${m.id}`,
    kind: "model" as const,
    label: m.label,
    detail: m.id,
    insertText: `@model:${m.id} `,
  }));
}

/** Session entries — reuses the existing session search data (no new listing mechanism). */
export function buildSessionMentionItems(
  sessions: SearchableSession[],
): MentionItem[] {
  return sessions.map((s) => {
    const title = (s.title || s.id).trim();
    const label = title || s.id;
    return {
      id: `session:${s.id}`,
      kind: "session" as const,
      label,
      detail: s.id,
      insertText: `@session:"${label.replace(/"/g, "'")}" `,
    };
  });
}

/** Case-insensitive substring match over label + detail; optional kind scope. */
export function filterMentionItems(
  items: MentionItem[],
  kind: MentionKind | null,
  query: string,
): MentionItem[] {
  const scoped = kind ? items.filter((i) => i.kind === kind) : items;
  const q = query.trim().toLowerCase();
  if (!q) return scoped;
  return scoped.filter((i) => {
    if (i.label.toLowerCase().includes(q)) return true;
    return (i.detail ?? "").toLowerCase().includes(q);
  });
}

/**
 * Build the flat keyboard-nav / render list for the mention panel.
 * Bare `@` (kind === null) shows a combined panel sectioned Files / Models /
 * Sessions, each capped to `capPerSection` (default 6). A kind prefix
 * (`file:` / `model:` / `session:`) narrows to just that one section.
 */
export function buildMentionEntries(opts: {
  kind: MentionKind | null;
  query: string;
  files: MentionItem[];
  models: MentionItem[];
  sessions: MentionItem[];
  capPerSection?: number;
}): MentionItem[] {
  const cap = opts.capPerSection ?? 6;
  if (opts.kind) {
    const all =
      opts.kind === "file"
        ? opts.files
        : opts.kind === "model"
          ? opts.models
          : opts.sessions;
    return filterMentionItems(all, opts.kind, opts.query);
  }
  const files = filterMentionItems(opts.files, null, opts.query).slice(0, cap);
  const models = filterMentionItems(opts.models, null, opts.query).slice(
    0,
    cap,
  );
  const sessions = filterMentionItems(opts.sessions, null, opts.query).slice(
    0,
    cap,
  );
  return [...files, ...models, ...sessions];
}
