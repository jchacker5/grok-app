/**
 * Prompt Library — browse built-in + custom prompts, search/filter by
 * category, apply one to the composer draft, or save/edit/delete your own.
 * Rendered inside a `GlassModal` (size="lg") from App.tsx.
 */

import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import {
  BUILT_IN_PROMPTS,
  CUSTOM_PROMPTS_WARN_LIMIT,
  PROMPT_CATEGORIES,
  filterPrompts,
  toLibraryPrompt,
  type LibraryPrompt,
  type PromptCategory,
} from "@/lib/promptLibrary";
import {
  IconCheck,
  IconClose,
  IconEdit,
  IconPromptAnalysis,
  IconPromptCoding,
  IconPromptCustom,
  IconPromptGeneral,
  IconPromptWriting,
  IconSearch,
  IconTrash,
} from "@/components/icons";

export interface PromptLibraryPanelProps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  onApply: (prompt: LibraryPrompt) => void;
  /** Prefill the "save as custom" form with the current composer draft. */
  currentDraft: string;
}

type CategoryFilter = PromptCategory | "all";

type FormState = {
  name: string;
  description: string;
  content: string;
  category: PromptCategory;
};

const emptyForm = (content = ""): FormState => ({
  name: "",
  description: "",
  content,
  category: "custom",
});

function categoryIcon(cat: PromptCategory) {
  switch (cat) {
    case "coding":
      return <IconPromptCoding size={14} />;
    case "writing":
      return <IconPromptWriting size={14} />;
    case "analysis":
      return <IconPromptAnalysis size={14} />;
    case "custom":
      return <IconPromptCustom size={14} />;
    default:
      return <IconPromptGeneral size={14} />;
  }
}

export function PromptLibraryPanel({
  t,
  onApply,
  currentDraft,
}: PromptLibraryPanelProps) {
  const [custom, setCustom] = useState<LibraryPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LibraryPrompt | null>(null);

  const reload = () => {
    setLoading(true);
    void api
      .customPromptsList()
      .then((rows) => setCustom(rows.map(toLibraryPrompt)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = useMemo(() => [...BUILT_IN_PROMPTS, ...custom], [custom]);
  const filtered = useMemo(
    () => filterPrompts(all, { category, query }),
    [all, category, query],
  );

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm(currentDraft));
    setFormOpen(true);
  };

  const openEditForm = (p: LibraryPrompt) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      content: p.content,
      category: p.category,
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const name = form.name.trim();
    const content = form.content.trim();
    if (!name || !content) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.customPromptUpdate(editingId, {
          name,
          description: form.description.trim(),
          content,
          category: form.category,
        });
      } else {
        await api.customPromptCreate({
          name,
          description: form.description.trim(),
          content,
          category: form.category,
        });
      }
      setFormOpen(false);
      setEditingId(null);
      reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.customPromptDelete(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const overLimit = custom.length >= CUSTOM_PROMPTS_WARN_LIMIT;

  return (
    <div className="promptlib">
      <div className="promptlib__toolbar">
        <div className="promptlib__search">
          <IconSearch size={15} />
          <input
            type="search"
            className="settings-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("promptLibrary.searchPlaceholder")}
            aria-label={t("promptLibrary.searchPlaceholder")}
            autoFocus
          />
        </div>
        <button
          type="button"
          className="btn btn--solid btn--sm"
          onClick={openCreateForm}
        >
          {t("promptLibrary.saveCurrent")}
        </button>
      </div>

      <div className="settings-seg promptlib__tabs" role="tablist">
        {(["all", ...PROMPT_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={"settings-seg__btn" + (category === c ? " is-on" : "")}
            onClick={() => setCategory(c)}
          >
            {t(`promptLibrary.category.${c}`)}
          </button>
        ))}
      </div>

      {overLimit && (
        <div className="ext-alert ext-alert--warn" role="status">
          {t("promptLibrary.limitWarning", { n: CUSTOM_PROMPTS_WARN_LIMIT })}
        </div>
      )}

      {error && (
        <div className="ext-alert ext-alert--error promptlib__error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setError(null)}
            aria-label={t("common.close")}
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      <div className="promptlib__body">
        {loading ? (
          <p className="ext-empty">{t("promptLibrary.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="ext-empty">
            {!query.trim() && category === "custom"
              ? t("promptLibrary.noCustom")
              : t("promptLibrary.noResults")}
          </p>
        ) : (
          <div className="promptlib__grid">
            {filtered.map((p) => (
              <div key={p.id} className="promptlib__card">
                <div className="promptlib__card-head">
                  <span className="ext-badge ext-badge--muted promptlib__badge">
                    {categoryIcon(p.category)}
                    {t(`promptLibrary.category.${p.category}`)}
                  </span>
                  {p.isBuiltIn ? (
                    <span className="ext-badge">
                      {t("promptLibrary.builtIn")}
                    </span>
                  ) : null}
                </div>
                <strong className="promptlib__card-title">{p.name}</strong>
                <p className="promptlib__card-desc">{p.description}</p>
                <div className="promptlib__card-actions">
                  <button
                    type="button"
                    className="btn btn--solid btn--sm"
                    onClick={() => onApply(p)}
                  >
                    <IconCheck size={13} />
                    {t("promptLibrary.apply")}
                  </button>
                  {!p.isBuiltIn && (
                    <>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => openEditForm(p)}
                        aria-label={t("promptLibrary.edit")}
                      >
                        <IconEdit size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setDeleteTarget(p)}
                        aria-label={t("promptLibrary.delete")}
                      >
                        <IconTrash size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="promptlib-form-overlay" role="presentation">
          <div className="promptlib-form" role="dialog" aria-modal="true">
            <div className="promptlib-form__head">
              <strong>
                {editingId
                  ? t("promptLibrary.editTitle")
                  : t("promptLibrary.saveCustomTitle")}
              </strong>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFormOpen(false)}
                aria-label={t("common.close")}
              >
                <IconClose size={14} />
              </button>
            </div>
            <label className="promptlib-form__field">
              <span>{t("promptLibrary.field.name")}</span>
              <input
                type="text"
                className="settings-input"
                value={form.name}
                placeholder={t("promptLibrary.field.namePh")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <label className="promptlib-form__field">
              <span>{t("promptLibrary.field.description")}</span>
              <input
                type="text"
                className="settings-input"
                value={form.description}
                placeholder={t("promptLibrary.field.descriptionPh")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>
            <label className="promptlib-form__field">
              <span>{t("promptLibrary.field.category")}</span>
              <select
                className="settings-input"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as PromptCategory,
                  }))
                }
              >
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`promptLibrary.category.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="promptlib-form__field">
              <span>{t("promptLibrary.field.content")}</span>
              <textarea
                className="settings-input promptlib-form__textarea"
                value={form.content}
                placeholder={t("promptLibrary.field.contentPh")}
                rows={6}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </label>
            <div className="promptlib-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setFormOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn--solid"
                disabled={
                  saving || !form.name.trim() || !form.content.trim()
                }
                onClick={() => void submitForm()}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="promptlib-form-overlay" role="presentation">
          <div className="promptlib-form promptlib-form--sm" role="alertdialog">
            <p>
              {t("promptLibrary.deleteConfirm", { name: deleteTarget.name })}
            </p>
            <div className="promptlib-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteTarget(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void confirmDelete()}
              >
                {t("promptLibrary.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
