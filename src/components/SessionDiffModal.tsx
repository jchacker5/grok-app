/**
 * Session diff modal (plan 012) — compare the message history of two
 * sessions. Opened from the sidebar session context menu ("Compare with…").
 *
 * Session A is fixed (the session the menu was opened on); the user picks
 * Session B from a dropdown of every other known session. Diffing itself is
 * pure (`computeSessionDiff` in `lib/sessionDiff.ts`); this component only
 * fetches messages, gates on the "large session" warning, and renders.
 */

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n";
import { createT, type MessageKey } from "@/i18n";
import { GlassModal } from "@/components/GlassModal";
import { parseUnifiedDiff } from "@/lib/diffModel";
import {
  computeSessionDiff,
  SESSION_DIFF_LARGE_THRESHOLD,
  type SessionDiffEntryKind,
  type SessionDiffMessage,
  type SessionDiffResult,
} from "@/lib/sessionDiff";

export interface SessionDiffCandidate {
  id: string;
  title: string;
  projectId: string | null;
}

export interface SessionDiffModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  /** Session the context menu was opened on — fixed left side of the compare. */
  sessionA: { id: string; title: string } | null;
  /** Every other session the user can pick as Session B. */
  candidates: SessionDiffCandidate[];
  projectNameFor: (projectId: string | null) => string | null;
  /** Fetch + normalize a session's messages (App owns the ChatMessage shape). */
  loadMessages: (id: string) => Promise<SessionDiffMessage[]>;
}

const KIND_LABEL_KEY: Record<SessionDiffEntryKind, MessageKey> = {
  added: "sessionDiff.kindAdded",
  removed: "sessionDiff.kindRemoved",
  changed: "sessionDiff.kindChanged",
  unchanged: "sessionDiff.kindUnchanged",
};

function roleLabelKey(role: string): MessageKey | null {
  if (role === "user") return "sessionDiff.roleUser";
  if (role === "assistant") return "sessionDiff.roleAssistant";
  if (role === "tool") return "sessionDiff.roleTool";
  return null;
}

export function SessionDiffModal({
  open,
  onClose,
  locale,
  sessionA,
  candidates,
  projectNameFor,
  loadMessages,
}: SessionDiffModalProps) {
  const tr = useMemo(() => createT(locale), [locale]);

  const [selectedBId, setSelectedBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionDiffResult | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [pendingLarge, setPendingLarge] = useState<{
    a: SessionDiffMessage[];
    b: SessionDiffMessage[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedBId("");
    setResult(null);
    setError(null);
    setShowUnchanged(false);
    setPendingLarge(null);
  }, [open, sessionA?.id]);

  const runDiff = async (idB: string, force: boolean) => {
    if (!sessionA || !idB) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPendingLarge(null);
    try {
      const [a, b] = await Promise.all([
        loadMessages(sessionA.id),
        loadMessages(idB),
      ]);
      if (
        !force &&
        (a.length > SESSION_DIFF_LARGE_THRESHOLD ||
          b.length > SESSION_DIFF_LARGE_THRESHOLD)
      ) {
        setPendingLarge({ a, b });
        return;
      }
      setResult(computeSessionDiff(a, b));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const onSelectB = (id: string) => {
    setSelectedBId(id);
    if (id) void runDiff(id, false);
    else {
      setResult(null);
      setPendingLarge(null);
    }
  };

  const entries = result?.entries ?? [];
  const visibleEntries = useMemo(
    () =>
      showUnchanged ? entries : entries.filter((e) => e.kind !== "unchanged"),
    [entries, showUnchanged],
  );

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={tr("sessionDiff.title")}
      titleId="session-diff-modal-title"
      closeLabel={tr("common.close")}
      size="lg"
      className="session-diff-modal"
      bodyClassName="session-diff-modal__body"
      footer={
        <button type="button" className="btn btn--solid" onClick={onClose}>
          {tr("common.close")}
        </button>
      }
    >
      <div className="session-diff-modal__pickers">
        <div className="session-diff-modal__picker">
          <span className="session-diff-modal__picker-label">
            {tr("sessionDiff.sessionA")}
          </span>
          <span className="session-diff-modal__picker-value">
            {sessionA?.title || tr("session.untitled")}
          </span>
        </div>
        <div className="session-diff-modal__picker">
          <label
            className="session-diff-modal__picker-label"
            htmlFor="session-diff-b-select"
          >
            {tr("sessionDiff.sessionB")}
          </label>
          <select
            id="session-diff-b-select"
            className="session-diff-modal__select"
            value={selectedBId}
            onChange={(e) => onSelectB(e.target.value)}
          >
            <option value="">{tr("sessionDiff.selectSession")}</option>
            {candidates.map((c) => {
              const proj = projectNameFor(c.projectId);
              return (
                <option key={c.id} value={c.id}>
                  {proj ? `${c.title || tr("session.untitled")} — ${proj}` : c.title || tr("session.untitled")}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {!selectedBId && !loading && (
        <p className="session-diff-modal__hint">
          {tr("sessionDiff.selectTwoHint")}
        </p>
      )}
      {loading && <p className="modal-status">{tr("sessionDiff.loading")}</p>}
      {error && <p className="modal-status modal-status--error">{error}</p>}

      {pendingLarge && (
        <div className="session-diff-modal__warning">
          <p>{tr("sessionDiff.largeWarning")}</p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void runDiff(selectedBId, true)}
          >
            {tr("sessionDiff.computeAnyway")}
          </button>
        </div>
      )}

      {result && (
        <>
          <div className="session-diff-modal__summary">
            <span className="session-diff-modal__stat session-diff-modal__stat--added">
              {tr("sessionDiff.messagesAdded", { n: result.summary.added })}
            </span>
            <span className="session-diff-modal__stat session-diff-modal__stat--removed">
              {tr("sessionDiff.messagesRemoved", { n: result.summary.removed })}
            </span>
            <span className="session-diff-modal__stat session-diff-modal__stat--changed">
              {tr("sessionDiff.messagesChanged", { n: result.summary.changed })}
            </span>
            <label className="session-diff-modal__toggle">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
              />
              {tr("sessionDiff.showUnchanged", { n: result.summary.unchanged })}
            </label>
          </div>

          {visibleEntries.length === 0 ? (
            <p className="session-diff-modal__hint">{tr("sessionDiff.noDiff")}</p>
          ) : (
            <ul className="session-diff-modal__list">
              {visibleEntries.map((entry, idx) => {
                const sample = entry.after ?? entry.before;
                const roleKey = sample ? roleLabelKey(sample.role) : null;
                return (
                  <li
                    key={idx}
                    className={`session-diff-modal__entry session-diff-modal__entry--${entry.kind}`}
                  >
                    <div className="session-diff-modal__entry-head">
                      <span className="session-diff-modal__entry-kind">
                        {tr(KIND_LABEL_KEY[entry.kind])}
                      </span>
                      {roleKey ? (
                        <span className="session-diff-modal__entry-role">
                          {tr(roleKey)}
                        </span>
                      ) : sample ? (
                        <span className="session-diff-modal__entry-role">
                          {sample.role}
                        </span>
                      ) : null}
                    </div>
                    {entry.kind === "changed" && entry.diffText ? (
                      <SessionDiffHunks unified={entry.diffText} />
                    ) : (
                      <pre className="session-diff-modal__entry-body">
                        {sample?.content}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </GlassModal>
  );
}

/** Render a unified-diff string (from `buildUnifiedDiff`) as +/- rows. */
function SessionDiffHunks({ unified }: { unified: string }) {
  const model = useMemo(() => parseUnifiedDiff(unified, "message"), [unified]);
  return (
    <div className="session-diff-modal__diff">
      {model.hunks.map((hunk) => (
        <div key={hunk.header} className="session-diff-modal__hunk">
          {hunk.lines.map((line) => (
            <div
              key={line.stableId}
              className={`session-diff-modal__diff-row session-diff-modal__diff-row--${line.kind}`}
            >
              <span className="session-diff-modal__diff-marker" aria-hidden>
                {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
              </span>
              <span className="session-diff-modal__diff-text">{line.content}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
