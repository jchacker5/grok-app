/**
 * "Manage commands" — CRUD for user-defined `/name` slash commands.
 *
 * SAFE actions only: insert text, toggle a whitelisted setting, or open a
 * whitelisted panel. Arbitrary shell execution is intentionally not offered
 * here (see plans/014-custom-slash-commands.md — deferred).
 */

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type {
  CustomCommandActionType,
  CustomCommandDto,
  CustomCommandInputDto,
} from "@/lib/api";
import { GlassModal } from "@/components/GlassModal";
import { Select } from "@/components/Select";
import { IconEdit, IconPlus, IconTrash } from "@/components/icons";

const NAME_RE = /^[a-zA-Z0-9_]+$/;

/** Fixed, safe whitelist for `toggleSetting` — real settings already wired in App. */
const TOGGLE_SETTING_KEYS = [
  "wordWrap",
  "notificationsEnabled",
  "autoOpenTaskPanel",
  "diffIgnoreWhitespace",
] as const;

/** Fixed, safe whitelist for `openPanel` — existing navigation targets only. */
const OPEN_PANEL_KEYS = [
  "automations",
  "settings",
  "extensions",
  "commands",
] as const;

type FormState = {
  name: string;
  description: string;
  actionType: CustomCommandActionType;
  actionValue: string;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  actionType: "insertText",
  actionValue: "",
});

export interface CustomCommandsModalProps {
  open: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  /** Fired after any create/update/delete so the caller can refresh the slash catalog. */
  onChanged?: () => void;
}

export function CustomCommandsModal({
  open,
  t,
  onClose,
  onChanged,
}: CustomCommandsModalProps) {
  const [list, setList] = useState<CustomCommandDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomCommandDto | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.customCommandsList();
      setList(rows);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    setFormOpen(false);
    setEditingId(null);
    setDeleteTarget(null);
  }, [open, refresh]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (cmd: CustomCommandDto) => {
    setEditingId(cmd.id);
    setForm({
      name: cmd.name,
      description: cmd.description,
      actionType: cmd.actionType,
      actionValue: cmd.actionValue,
    });
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!NAME_RE.test(name)) {
      setError(t("commands.errName"));
      return;
    }
    const actionValue = form.actionValue.trim();
    if (!actionValue) {
      setError(t("commands.errValue"));
      return;
    }
    const input: CustomCommandInputDto = {
      name,
      description: form.description.trim(),
      actionType: form.actionType,
      actionValue,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.customCommandUpdate(editingId, input);
      } else {
        await api.customCommandCreate(input);
      }
      closeForm();
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const cmd = deleteTarget;
    if (!cmd) return;
    setSaving(true);
    try {
      await api.customCommandDelete(cmd.id);
      setDeleteTarget(null);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const actionTypeOptions = [
    { value: "insertText", label: t("commands.action.insertText") },
    { value: "toggleSetting", label: t("commands.action.toggleSetting") },
    { value: "openPanel", label: t("commands.action.openPanel") },
  ];

  const settingOptions = TOGGLE_SETTING_KEYS.map((key) => ({
    value: key,
    label: t(`commands.setting.${key}` as `commands.setting.${typeof key}`),
  }));

  const panelOptions = OPEN_PANEL_KEYS.map((key) => ({
    value: key,
    label: t(`commands.panel.${key}` as `commands.panel.${typeof key}`),
  }));

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={t("commands.title")}
      titleId="custom-commands-modal-title"
      closeLabel={t("common.close")}
      size="md"
      className="cmd-modal"
      wrapBody
      footer={
        !formOpen ? (
          <button type="button" className="btn btn--solid" onClick={onClose}>
            {t("common.close")}
          </button>
        ) : undefined
      }
    >
      <p className="settings-page__lead">{t("commands.subtitle")}</p>

      {error && (
        <div className="ext-alert ext-alert--error" role="alert">
          <div className="ext-alert__body">{error}</div>
        </div>
      )}

      {deleteTarget ? (
        <div className="app-dialog__form">
          <p className="app-dialog__msg">
            {t("commands.deleteConfirm", { name: deleteTarget.name })}
          </p>
          <div className="app-dialog__actions modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={saving}
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={saving}
              onClick={() => void confirmDelete()}
            >
              {t("commands.delete")}
            </button>
          </div>
        </div>
      ) : formOpen ? (
        <div className="app-dialog__form">
          <label className="auto-field">
            <span>{t("commands.field.name")}</span>
            <input
              type="text"
              value={form.name}
              placeholder={t("commands.field.namePh")}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <span className="ext-item__desc">
              {t("commands.field.nameHint")}
            </span>
          </label>
          <label className="auto-field">
            <span>{t("commands.field.description")}</span>
            <input
              type="text"
              value={form.description}
              placeholder={t("commands.field.descriptionPh")}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <div className="auto-field auto-field--row">
            <span>{t("commands.field.actionType")}</span>
            <Select
              value={form.actionType}
              options={actionTypeOptions}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  actionType: v as CustomCommandActionType,
                  actionValue: "",
                }))
              }
              aria-label={t("commands.field.actionType")}
            />
          </div>

          {form.actionType === "insertText" && (
            <label className="auto-field">
              <span>{t("commands.field.insertText")}</span>
              <textarea
                rows={4}
                value={form.actionValue}
                placeholder={t("commands.field.insertTextPh")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, actionValue: e.target.value }))
                }
              />
            </label>
          )}
          {form.actionType === "toggleSetting" && (
            <div className="auto-field auto-field--row">
              <span>{t("commands.field.settingKey")}</span>
              <Select
                value={form.actionValue || TOGGLE_SETTING_KEYS[0]}
                options={settingOptions}
                onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
                aria-label={t("commands.field.settingKey")}
              />
            </div>
          )}
          {form.actionType === "openPanel" && (
            <div className="auto-field auto-field--row">
              <span>{t("commands.field.panel")}</span>
              <Select
                value={form.actionValue || OPEN_PANEL_KEYS[0]}
                options={panelOptions}
                onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
                aria-label={t("commands.field.panel")}
              />
            </div>
          )}

          <p className="ext-section-note">{t("commands.shellNote")}</p>

          <div className="app-dialog__actions modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={saving}
              onClick={closeForm}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--solid"
              disabled={saving}
              onClick={() => void save()}
            >
              {t("commands.save")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ext-toolbar__actions">
            <button
              type="button"
              className="btn btn--solid btn--sm"
              onClick={openCreate}
            >
              <IconPlus size={14} />
              {t("commands.add")}
            </button>
          </div>

          {loading ? (
            <p className="ext-empty">…</p>
          ) : list.length === 0 ? (
            <p className="ext-empty">
              <strong>{t("commands.empty")}</strong>
              <br />
              {t("commands.emptyHint")}
            </p>
          ) : (
            <ul className="ext-list">
              {list.map((cmd) => (
                <li key={cmd.id} className="ext-item">
                  <div className="ext-item__head">
                    <strong className="ext-item__name">/{cmd.name}</strong>
                    <span className="ext-badge ext-badge--muted">
                      {t(`commands.action.${cmd.actionType}`)}
                    </span>
                  </div>
                  {cmd.description ? (
                    <p className="ext-item__desc">{cmd.description}</p>
                  ) : null}
                  <div className="ext-item__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => openEdit(cmd)}
                    >
                      <IconEdit size={14} />
                      {t("commands.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm ext-item__danger"
                      onClick={() => setDeleteTarget(cmd)}
                    >
                      <IconTrash size={14} />
                      {t("commands.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </GlassModal>
  );
}
