import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { homeDir, join } from "@tauri-apps/api/path";
import { createT, type Locale } from "@/i18n";
import * as api from "@/lib/api";
import { GlassModal } from "@/components/GlassModal";
import { MarkdownBody } from "@/components/MarkdownBody";
import { IconCheck, IconTrash } from "@/components/icons";

type MemorySection = "global" | "workspace" | "sessions";

interface AgentMemoryViewerProps {
  projectPath: string;
  locale: Locale;
}

interface MemoryEditorProps {
  path: string;
  label: string;
  locale: Locale;
}

function MemoryEditor({ path, label, locale }: MemoryEditorProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = content !== savedContent;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.readAgentsFile(path);
      setContent(next);
      setSavedContent(next);
    } catch {
      // A missing MEMORY.md is a valid initial state; Save creates it.
      setContent("");
      setSavedContent("");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await api.writeAgentsFile(path, content);
      setSavedContent(content);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2_000);
    } catch (saveError) {
      setError(`${tr("memory.saveFailed")}: ${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  }, [content, dirty, path, saving, tr]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          <div
            title={path}
            style={{
              fontSize: 11,
              opacity: 0.6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {path}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-live="polite"
            style={{
              minWidth: 82,
              textAlign: "right",
              fontSize: 11,
              opacity: saved || dirty ? 0.8 : 0,
            }}
          >
            {saved ? (
              <>
                <IconCheck size={13} /> {tr("memory.saved")}
              </>
            ) : dirty ? (
              tr("memory.unsaved")
            ) : (
              tr("memory.saved")
            )}
          </span>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!dirty || saving}
            onClick={() => setContent(savedContent)}
          >
            {tr("memory.revert")}
          </button>
          <button
            type="button"
            className="btn btn--solid"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? tr("memory.saving") : tr("memory.save")}
          </button>
        </div>
      </div>
      {error && (
        <div className="settings-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", opacity: 0.65 }}>
          {tr("memory.loading")}
        </div>
      ) : (
        <textarea
          aria-label={label}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSaved(false);
          }}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight: 220,
            width: "100%",
            resize: "none",
            border: "1px solid var(--c-border)",
            borderRadius: 8,
            background: "var(--c-bg-tertiary)",
            color: "inherit",
            padding: 12,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        />
      )}
    </div>
  );
}

export const AgentMemoryViewer: React.FC<AgentMemoryViewerProps> = ({
  projectPath,
  locale,
}) => {
  const tr = useMemo(() => createT(locale), [locale]);
  const [section, setSection] = useState<MemorySection>("global");
  const [memoryRoot, setMemoryRoot] = useState("");
  const [globalMemoryPath, setGlobalMemoryPath] = useState("");
  const [globalRevision, setGlobalRevision] = useState(0);
  const [workspaceNames, setWorkspaceNames] = useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [workspaceMemoryPath, setWorkspaceMemoryPath] = useState("");
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [sessions, setSessions] = useState<api.MemorySessionEntry[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<api.MemorySessionEntry | null>(null);
  const [sessionContent, setSessionContent] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearScope, setClearScope] =
    useState<api.MemoryClearScope | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const root = await join(await homeDir(), ".grok", "memory");
        setMemoryRoot(root);
        setGlobalMemoryPath(await join(root, "MEMORY.md"));
      } catch (pathError) {
        setError(`${tr("memory.loadFailed")}: ${String(pathError)}`);
      }
    })();
  }, [tr]);

  const refreshWorkspaces = useCallback(async () => {
    if (!projectPath) {
      setWorkspaceNames([]);
      setSelectedWorkspace("");
      return;
    }
    const matches = await api.findProjectMemoryWorkspace(projectPath);
    setWorkspaceNames(matches);
    setSelectedWorkspace((current) =>
      current && matches.includes(current) ? current : (matches[0] ?? ""),
    );
  }, [projectPath]);

  useEffect(() => {
    void refreshWorkspaces().catch((workspaceError) => {
      setError(`${tr("memory.loadFailed")}: ${String(workspaceError)}`);
    });
  }, [refreshWorkspaces, tr]);

  useEffect(() => {
    if (!memoryRoot || !selectedWorkspace) {
      setWorkspaceMemoryPath("");
      return;
    }
    void join(memoryRoot, selectedWorkspace, "MEMORY.md").then(
      setWorkspaceMemoryPath,
      (pathError) =>
        setError(`${tr("memory.loadFailed")}: ${String(pathError)}`),
    );
  }, [memoryRoot, selectedWorkspace, tr]);

  const refreshSessions = useCallback(async () => {
    if (!selectedWorkspace) {
      setSessions([]);
      setSelectedSession(null);
      setSessionContent("");
      return;
    }
    setLoadingSessions(true);
    try {
      const entries = await api.listMemorySessions(selectedWorkspace);
      const sorted = [...entries].sort(
        (left, right) => right.modifiedAt - left.modifiedAt,
      );
      setSessions(sorted);
      setSelectedSession((current) =>
        current
          ? (sorted.find((entry) => entry.path === current.path) ?? null)
          : null,
      );
    } catch (sessionError) {
      setError(`${tr("memory.loadFailed")}: ${String(sessionError)}`);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedWorkspace, tr]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!selectedSession) {
      setSessionContent("");
      return;
    }
    setSessionContent("");
    void api.readAgentsFile(selectedSession.path).then(
      setSessionContent,
      (sessionError) =>
        setError(`${tr("memory.loadFailed")}: ${String(sessionError)}`),
    );
  }, [selectedSession, tr]);

  const clearLabels: Record<api.MemoryClearScope, string> = {
    global: tr("memory.global"),
    workspace: tr("memory.workspace"),
    all: tr("memory.all"),
  };

  const confirmClear = async () => {
    if (!clearScope || clearing) return;
    setClearing(true);
    setError(null);
    try {
      await api.memoryClear(
        clearScope,
        clearScope === "workspace" ? projectPath : null,
      );
      setClearScope(null);
      if (clearScope === "workspace" || clearScope === "all") {
        setWorkspaceRevision((revision) => revision + 1);
        await refreshWorkspaces();
        await refreshSessions();
      }
      if (clearScope === "global" || clearScope === "all") {
        setGlobalRevision((revision) => revision + 1);
      }
    } catch (clearError) {
      setError(`${tr("memory.clearFailed")}: ${String(clearError)}`);
    } finally {
      setClearing(false);
    }
  };

  const dateLocale =
    locale === "zh" ? "zh-CN" : locale === "zh-TW" ? "zh-TW" : "en-US";
  const sectionLabels: Record<MemorySection, string> = {
    global: tr("memory.global"),
    workspace: tr("memory.workspace"),
    sessions: tr("memory.sessions"),
  };

  return (
    <div
      className="agent-memory-viewer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {(["global", "workspace", "sessions"] as MemorySection[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={`btn ${section === item ? "btn--solid" : "btn--ghost"}`}
                onClick={() => setSection(item)}
              >
                {sectionLabels[item]}
              </button>
            ),
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setClearScope("global")}
          >
            <IconTrash size={14} /> {tr("memory.clearGlobal")}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!projectPath}
            onClick={() => setClearScope("workspace")}
          >
            <IconTrash size={14} /> {tr("memory.clearWorkspace")}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setClearScope("all")}
          >
            <IconTrash size={14} /> {tr("memory.clearAll")}
          </button>
        </div>
      </div>

      {error && (
        <div className="settings-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {section === "global" &&
          (globalMemoryPath ? (
            <MemoryEditor
              key={`${globalMemoryPath}:${globalRevision}`}
              path={globalMemoryPath}
              label={tr("memory.global")}
              locale={locale}
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", opacity: 0.65 }}>
              {tr("memory.loading")}
            </div>
          ))}

        {section === "workspace" &&
          (!selectedWorkspace ? (
            <div style={{ padding: 32, textAlign: "center", opacity: 0.65 }}>
              {tr("memory.noWorkspaceFound")}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                height: "100%",
                minHeight: 0,
              }}
            >
              {workspaceNames.length > 1 && (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12 }}>
                    {tr("memory.selectWorkspace")}
                  </span>
                  <select
                    value={selectedWorkspace}
                    onChange={(event) =>
                      setSelectedWorkspace(event.target.value)
                    }
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {workspaceNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {workspaceMemoryPath && (
                <MemoryEditor
                  key={`${workspaceMemoryPath}:${workspaceRevision}`}
                  path={workspaceMemoryPath}
                  label={tr("memory.workspace")}
                  locale={locale}
                />
              )}
            </div>
          ))}

        {section === "sessions" &&
          (!selectedWorkspace ? (
            <div style={{ padding: 32, textAlign: "center", opacity: 0.65 }}>
              {tr("memory.noWorkspaceFound")}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(190px, 0.8fr) minmax(0, 1.5fr)",
                gap: 12,
                height: "100%",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  overflowY: "auto",
                  border: "1px solid var(--c-border)",
                  borderRadius: 8,
                }}
              >
                {loadingSessions ? (
                  <div style={{ padding: 20, opacity: 0.65 }}>
                    {tr("memory.loading")}
                  </div>
                ) : sessions.length === 0 ? (
                  <div style={{ padding: 20, opacity: 0.65 }}>
                    {tr("memory.noSessions")}
                  </div>
                ) : (
                  sessions.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className={`cmm__opt ${
                        selectedSession?.path === entry.path ? "is-active" : ""
                      }`}
                      onClick={() => setSelectedSession(entry)}
                      style={{
                        width: "100%",
                        display: "block",
                        textAlign: "left",
                        borderRadius: 0,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {entry.name}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.6 }}>
                        {new Date(entry.modifiedAt).toLocaleString(dateLocale)}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div
                style={{
                  minWidth: 0,
                  overflow: "auto",
                  border: "1px solid var(--c-border)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {selectedSession ? (
                  <MarkdownBody locale={locale}>{sessionContent}</MarkdownBody>
                ) : (
                  <div style={{ padding: 20, opacity: 0.65 }}>
                    {tr("memory.selectSession")}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      <GlassModal
        open={clearScope !== null}
        onClose={() => {
          if (!clearing) setClearScope(null);
        }}
        title={tr("memory.clearTitle")}
        size="sm"
        closeLabel={tr("common.close")}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={clearing}
              onClick={() => setClearScope(null)}
            >
              {tr("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={clearing}
              onClick={() => void confirmClear()}
            >
              {clearScope
                ? tr("memory.clearAction", {
                    scope: clearLabels[clearScope],
                  })
                : tr("common.confirm")}
            </button>
          </>
        }
      >
        <p>
          {clearScope
            ? tr("memory.clearConfirm", {
                scope: clearLabels[clearScope],
              })
            : ""}
        </p>
      </GlassModal>
    </div>
  );
};
