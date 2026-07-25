/**
 * Read-only viewer for Grok Build's on-disk memory (`{GROK_HOME}/memory/`):
 * a global `MEMORY.md`, the matched project's `MEMORY.md`, and its interval
 * `sessions/*.md` notes. "Clear" only resets the human-readable MEMORY.md
 * text for a scope — it never touches the semantic index or session notes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { createT, type Locale } from "@/i18n";
import { formatRelativeTime } from "@/lib/accountUi";
import { GlassModal } from "@/components/GlassModal";
import { OverlayScroll } from "@/components/OverlayScroll";
import {
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@/components/icons";
import "@/styles/agent-memory.css";

export interface AgentMemoryViewerProps {
  locale: Locale;
  /** Active workbench project path — used to match `memory/{slug}/`. */
  projectPath: string | null;
}

type Scope = "global" | "project" | "sessions";

interface MemoryEntry {
  key: string | null;
  text: string;
}

interface MemorySection {
  heading: string;
  entries: MemoryEntry[];
}

/**
 * Parse a MEMORY.md into `## heading` sections of bullet/paragraph entries.
 * `- **key**: value` bullets become key/value entries; everything else keeps
 * its raw text with `key: null`. Returns `[]` when nothing recognizable is
 * found (caller falls back to showing the raw text).
 */
function parseMemoryMarkdown(content: string): MemorySection[] {
  const lines = content.split(/\r?\n/);
  const sections: MemorySection[] = [];
  let current: MemorySection = { heading: "", entries: [] };

  const flush = () => {
    if (current.entries.length > 0) sections.push(current);
  };

  for (const raw of lines) {
    const line = raw.trim();
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flush();
      current = { heading: h2[1].trim(), entries: [] };
      continue;
    }
    if (!line || /^#\s+/.test(line) || line.startsWith(">") || line.startsWith("<!--")) {
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const body = bullet ? bullet[1] : line;
    const kv = /^\*\*(.+?)\*\*:?\s*(.*)$/.exec(body);
    if (kv) {
      current.entries.push({ key: kv[1].trim(), text: kv[2].trim() || kv[1].trim() });
    } else {
      current.entries.push({ key: null, text: body });
    }
  }
  flush();
  return sections;
}

function matchesQuery(entry: MemoryEntry, q: string): boolean {
  if (!q) return true;
  const hay = `${entry.key ?? ""} ${entry.text}`.toLowerCase();
  return hay.includes(q);
}

function filterSections(
  sections: MemorySection[],
  category: string | null,
  query: string,
): MemorySection[] {
  const q = query.trim().toLowerCase();
  return sections
    .filter((s) => category == null || s.heading === category)
    .map((s) => ({ ...s, entries: s.entries.filter((e) => matchesQuery(e, q)) }))
    .filter((s) => s.entries.length > 0);
}

export function AgentMemoryViewer({ locale, projectPath }: AgentMemoryViewerProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const [snapshot, setSnapshot] = useState<api.AgentMemorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("global");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [confirmScope, setConfirmScope] = useState<"global" | "project" | null>(null);
  const [clearing, setClearing] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionBodies, setSessionBodies] = useState<Record<string, string>>({});
  const [sessionLoading, setSessionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await api.agentMemoryRead(projectPath);
      setSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    void load();
    setCategory(null);
    setExpandedSession(null);
    setSessionBodies({});
  }, [load]);

  const activeDoc =
    scope === "global" ? snapshot?.global ?? null : scope === "project" ? snapshot?.project ?? null : null;

  const sections = useMemo(
    () => (activeDoc ? parseMemoryMarkdown(activeDoc.content) : []),
    [activeDoc],
  );
  const categories = useMemo(
    () => Array.from(new Set(sections.map((s) => s.heading).filter(Boolean))),
    [sections],
  );
  const filtered = useMemo(
    () => filterSections(sections, category, query),
    [sections, category, query],
  );
  const totalEntries = useMemo(
    () => sections.reduce((n, s) => n + s.entries.length, 0),
    [sections],
  );
  const rawFallback = !!activeDoc && sections.length === 0 && activeDoc.content.trim().length > 0;

  const toggleSession = useCallback(
    async (name: string) => {
      if (expandedSession === name) {
        setExpandedSession(null);
        return;
      }
      setExpandedSession(name);
      if (sessionBodies[name] != null || !projectPath) return;
      setSessionLoading(name);
      try {
        const body = await api.agentMemoryReadSessionFile(projectPath, name);
        setSessionBodies((prev) => ({ ...prev, [name]: body }));
      } catch (e) {
        setSessionBodies((prev) => ({
          ...prev,
          [name]: `(${tr("memory.loadError")}: ${e instanceof Error ? e.message : String(e)})`,
        }));
      } finally {
        setSessionLoading(null);
      }
    },
    [expandedSession, sessionBodies, projectPath, tr],
  );

  const runClear = useCallback(async () => {
    if (!confirmScope) return;
    setClearing(true);
    try {
      const snap = await api.agentMemoryClear(confirmScope, projectPath);
      setSnapshot(snap);
      setConfirmScope(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearing(false);
    }
  }, [confirmScope, projectPath]);

  if (loading) {
    return (
      <div className="mem__empty">
        <div className="mem__empty-desc">{tr("memory.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mem__empty">
        <div className="mem__empty-title">{tr("memory.error")}</div>
        <div className="mem__empty-desc">{error}</div>
        <button type="button" className="btn btn--ghost mem__retry" onClick={() => void load()}>
          <IconRefresh size={14} />
          {tr("memory.refresh")}
        </button>
      </div>
    );
  }

  if (!snapshot?.available) {
    return (
      <div className="mem__empty">
        <div className="mem__empty-title">{tr("memory.title")}</div>
        <div className="mem__empty-desc">{tr("memory.notFound")}</div>
      </div>
    );
  }

  return (
    <div className="mem">
      <div className="mem__scopes" role="tablist" aria-label={tr("memory.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "global"}
          className={"mem__scope-btn" + (scope === "global" ? " is-active" : "")}
          onClick={() => {
            setScope("global");
            setCategory(null);
          }}
        >
          {tr("memory.scopeGlobal")}
        </button>
        {projectPath ? (
          <button
            type="button"
            role="tab"
            aria-selected={scope === "project"}
            className={"mem__scope-btn" + (scope === "project" ? " is-active" : "")}
            onClick={() => {
              setScope("project");
              setCategory(null);
            }}
          >
            {tr("memory.scopeProject")}
          </button>
        ) : null}
        {projectPath && snapshot.sessions.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={scope === "sessions"}
            className={"mem__scope-btn" + (scope === "sessions" ? " is-active" : "")}
            onClick={() => setScope("sessions")}
          >
            {tr("memory.scopeSessions")}
            <span className="mem__count">{snapshot.sessions.length}</span>
          </button>
        ) : null}
        <div className="mem__scopes-spacer" />
        <button type="button" className="chrome-btn" onClick={() => void load()} title={tr("memory.refresh")}>
          <IconRefresh size={14} />
        </button>
      </div>

      {scope !== "sessions" ? (
        <>
          <div className="mem__toolbar">
            <div className="mem__search">
              <IconSearch size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("memory.search")}
                aria-label={tr("memory.search")}
              />
            </div>
            {activeDoc ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm mem__clear-btn"
                onClick={() => setConfirmScope(scope === "global" ? "global" : "project")}
              >
                <IconTrash size={14} />
                {tr("memory.clear")}
              </button>
            ) : null}
          </div>

          {categories.length > 1 ? (
            <div className="mem__chips" role="tablist">
              <button
                type="button"
                className={"mem__chip" + (category == null ? " is-active" : "")}
                onClick={() => setCategory(null)}
              >
                {tr("memory.all")}
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"mem__chip" + (category === c ? " is-active" : "")}
                  onClick={() => setCategory(c)}
                  title={c}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}

          <OverlayScroll className="mem__scroll">
            {!activeDoc ? (
              <div className="mem__empty">
                <div className="mem__empty-title">{tr("memory.empty")}</div>
                <div className="mem__empty-desc">{tr("memory.emptyHint")}</div>
              </div>
            ) : rawFallback ? (
              <pre className="mem__raw">{activeDoc.content}</pre>
            ) : totalEntries === 0 ? (
              <div className="mem__empty">
                <div className="mem__empty-title">{tr("memory.empty")}</div>
                <div className="mem__empty-desc">{tr("memory.emptyHint")}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="mem__empty">
                <div className="mem__empty-desc">{tr("memory.noMatch")}</div>
              </div>
            ) : (
              <div className="mem__list">
                {filtered.map((section) => (
                  <div className="mem__section" key={section.heading || "_"}>
                    {section.heading ? (
                      <div className="mem__section-head">{section.heading}</div>
                    ) : null}
                    {section.entries.map((entry, i) => (
                      <div className="mem__card" key={`${section.heading}-${i}`}>
                        {entry.key ? <div className="mem__card-key">{entry.key}</div> : null}
                        <div className="mem__card-text">{entry.text}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </OverlayScroll>
          {activeDoc ? (
            <div className="mem__footer">
              {tr("memory.updated", {
                time: formatRelativeTime(
                  new Date(activeDoc.modifiedAt * 1000).toISOString(),
                  locale,
                ),
              })}
            </div>
          ) : null}
        </>
      ) : (
        <OverlayScroll className="mem__scroll">
          <div className="mem__list">
            {snapshot.sessions.map((s) => {
              const open = expandedSession === s.name;
              return (
                <div className="mem__session" key={s.name}>
                  <button
                    type="button"
                    className="mem__session-head"
                    onClick={() => void toggleSession(s.name)}
                    aria-expanded={open}
                  >
                    {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    <span className="mem__session-name">{s.name}</span>
                    <span className="mem__session-meta">
                      {formatRelativeTime(new Date(s.modifiedAt * 1000).toISOString(), locale)}
                    </span>
                  </button>
                  {open ? (
                    <pre className="mem__raw mem__raw--session">
                      {sessionLoading === s.name
                        ? tr("memory.loading")
                        : sessionBodies[s.name] ?? ""}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        </OverlayScroll>
      )}

      <GlassModal
        open={confirmScope != null}
        onClose={() => setConfirmScope(null)}
        title={tr("memory.clearConfirmTitle")}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirmScope(null)}
              disabled={clearing}
            >
              {tr("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void runClear()}
              disabled={clearing}
            >
              {tr("memory.clear")}
            </button>
          </>
        }
      >
        <p className="mem__confirm-msg">
          {confirmScope === "global" ? tr("memory.clearConfirmGlobal") : tr("memory.clearConfirmProject")}
        </p>
      </GlassModal>
    </div>
  );
}
