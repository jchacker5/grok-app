/**
 * Commit dialog (Feature 2 — Git commit & PR workflow).
 * GlassModal shell (same family as AskUserModal): list of staged files, a
 * message textarea (blank on open auto-triggers the AI-draft flow from
 * `gitCommit.ts`, editable after), a per-commit model picker following the
 * `Automation.modelId` override precedent, and Commit / Commit & Push / Cancel.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassModal } from "@/components/GlassModal";
import { Select, type SelectOption } from "@/components/Select";
import { IconGitCommit, IconSparkles } from "@/components/icons";
import { createT, type Locale } from "@/i18n";
import * as api from "@/lib/api";
import { draftCommitMessage } from "@/lib/gitCommit";
import { GROK_BUILD_MODELS, type ModelOption } from "@/lib/grokCatalog";

export interface CommitDialogProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  projectPath: string;
  /** Repo-relative staged file paths (display only — commit acts on the index as-is). */
  stagedPaths: string[];
  /** Live model catalog when available; falls back to the static catalog. */
  models?: ModelOption[];
  /** App's current default model id (composer prefs) — the picker's initial value. */
  defaultModelId: string;
  onCommitted: (result: { sha: string; subject: string; pushed: boolean }) => void;
}

export function CommitDialog({
  open,
  onClose,
  locale,
  projectPath,
  stagedPaths,
  models,
  defaultModelId,
  onCommitted,
}: CommitDialogProps) {
  const t = useMemo(() => createT(locale), [locale]);
  const [message, setMessage] = useState("");
  const [modelId, setModelId] = useState(defaultModelId);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"commit" | "commitPush" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftedOnOpen = useRef(false);

  const modelOptions: SelectOption[] = useMemo(
    () =>
      (models?.length ? models : GROK_BUILD_MODELS).map((m) => ({
        value: m.id,
        label: m.label,
      })),
    [models],
  );

  const runDraft = async () => {
    setDrafting(true);
    setDraftError(null);
    try {
      const diffRes = await api.gitStagedDiff(projectPath);
      const diff = diffRes.available ? diffRes.diff || "" : "";
      const drafted = await draftCommitMessage(projectPath, diff, modelId);
      setMessage(drafted);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  };

  // Reset on close; auto-draft once per open when the message starts blank.
  useEffect(() => {
    if (!open) {
      draftedOnOpen.current = false;
      setMessage("");
      setModelId(defaultModelId);
      setDrafting(false);
      setDraftError(null);
      setBusy(null);
      setError(null);
      return;
    }
    if (!draftedOnOpen.current) {
      draftedOnOpen.current = true;
      void runDraft();
    }
    // Intentionally only re-runs on `open` transitions — drafting is a
    // one-shot side effect, not tied to modelId/projectPath churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = async (push: boolean) => {
    const msg = message.trim();
    if (!msg || busy) return;
    setBusy(push ? "commitPush" : "commit");
    setError(null);
    try {
      const result = await api.gitCommit(projectPath, msg);
      let pushed = false;
      if (push) {
        await api.gitPush(projectPath, true);
        pushed = true;
      }
      onCommitted({ ...result, pushed });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        <span className="commit-dialog__title">
          <IconGitCommit size={16} />
          {t("changes.commit.title")}
        </span>
      }
      size="md"
      closeLabel={t("changes.commit.cancel")}
      closeOnOverlay={!busy}
      wrapBody
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!!busy}
            onClick={onClose}
          >
            {t("changes.commit.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!!busy || !message.trim()}
            onClick={() => void commit(true)}
          >
            {busy === "commitPush"
              ? t("changes.commit.committing")
              : t("changes.commit.commitAndPush")}
          </button>
          <button
            type="button"
            className="btn btn--solid"
            disabled={!!busy || !message.trim()}
            onClick={() => void commit(false)}
          >
            {busy === "commit"
              ? t("changes.commit.committing")
              : t("changes.commit.commit")}
          </button>
        </>
      }
    >
      <div className="commit-dialog">
        <div className="commit-dialog__files">
          <div className="commit-dialog__files-title">
            {t("changes.commit.filesTitle", { n: stagedPaths.length })}
          </div>
          {stagedPaths.length === 0 ? (
            <div className="commit-dialog__files-empty">
              {t("changes.commit.filesEmpty")}
            </div>
          ) : (
            <ul className="commit-dialog__files-list">
              {stagedPaths.map((p) => (
                <li key={p} title={p}>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="commit-dialog__field">
          <span className="commit-dialog__label-row">
            {t("changes.commit.messageLabel")}
            <button
              type="button"
              className="chrome-btn commit-dialog__draft-btn"
              disabled={drafting || !!busy}
              onClick={() => void runDraft()}
              title={t("changes.commit.draftWithAi")}
            >
              <IconSparkles size={13} />
              {drafting ? t("changes.commit.drafting") : t("changes.commit.draftWithAi")}
            </button>
          </span>
          <textarea
            className="commit-dialog__textarea"
            rows={6}
            value={message}
            placeholder={
              drafting
                ? t("changes.commit.drafting")
                : t("changes.commit.messagePlaceholder")
            }
            disabled={!!busy}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        {draftError ? (
          <div className="commit-dialog__hint commit-dialog__hint--warn">
            {t("changes.commit.draftFailed", { error: draftError })}
          </div>
        ) : null}

        <div className="commit-dialog__field commit-dialog__field--row">
          <span>{t("changes.commit.modelLabel")}</span>
          <Select
            value={modelId}
            options={modelOptions}
            onChange={setModelId}
            aria-label={t("changes.commit.modelLabel")}
          />
        </div>

        {error ? (
          <div className="commit-dialog__hint commit-dialog__hint--error">{error}</div>
        ) : null}
      </div>
    </GlassModal>
  );
}
