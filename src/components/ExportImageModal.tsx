/**
 * Export a chat transcript as a shareable PNG.
 * Select messages -> pick light/dark style -> render a hidden preview clone
 * -> rasterize with html-to-image -> download.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { GlassModal } from "@/components/GlassModal";
import { IconPhoto } from "@/components/icons";
import { createT, type Locale } from "@/i18n";
import type { ChatMessage } from "@/lib/session";
import {
  EXPORT_IMAGE_BACKGROUNDS,
  EXPORT_IMAGE_WIDTH,
  MAX_EXPORT_IMAGE_MESSAGES,
  downloadBlob,
  exportNodeAsImage,
  imageExportFilename,
  type ExportImageStyle,
} from "@/lib/imageExport";

export type ExportImageModalProps = {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  sessionTitle: string;
  sessionId: string | null;
  projectName?: string | null;
  messages: ChatMessage[];
  onExported?: (ok: boolean, message: string) => void;
};

type ExportableMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

function formatTimestamp(iso: string | undefined, locale: Locale): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(locale === "zh" || locale === "zh-TW" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

/** Only user/assistant turns with real text are shareable — matches Markdown export filtering. */
function exportableMessages(messages: ChatMessage[]): ExportableMessage[] {
  const out: ExportableMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (m.isError) continue;
    const body = (m.content || "").trim();
    if (!body) continue;
    out.push({ id: m.id, role: m.role, content: body, createdAt: m.createdAt });
  }
  return out;
}

export function ExportImageModal({
  open,
  onClose,
  locale,
  sessionTitle,
  sessionId,
  projectName,
  messages,
  onExported,
}: ExportImageModalProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<ExportImageStyle>("dark");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const items = useMemo(() => exportableMessages(messages), [messages]);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  // Lazily default-select the most recent messages, capped, whenever the
  // modal is opened with a fresh message list.
  const selectedIds = useMemo(() => {
    if (selected) return selected;
    const initial = items.slice(-MAX_EXPORT_IMAGE_MESSAGES).map((m) => m.id);
    return new Set(initial);
  }, [selected, items]);

  if (!open) return null;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setStatus(null);
  };

  const selectAll = () => {
    setSelected(new Set(items.map((m) => m.id)));
    setStatus(null);
  };
  const deselectAll = () => {
    setSelected(new Set());
    setStatus(null);
  };

  const selectedItems = items.filter((m) => selectedIds.has(m.id));
  const tooMany = selectedItems.length > MAX_EXPORT_IMAGE_MESSAGES;
  const canExport = selectedItems.length > 0 && !tooMany && !exporting;

  const handleExport = async () => {
    if (!previewRef.current) return;
    if (selectedItems.length === 0) {
      setStatus({ kind: "error", text: tr("exportImage.noMessagesSelected") });
      return;
    }
    if (tooMany) {
      setStatus({
        kind: "error",
        text: tr("exportImage.tooMany", { max: MAX_EXPORT_IMAGE_MESSAGES }),
      });
      return;
    }
    setExporting(true);
    setStatus(null);
    try {
      const blob = await exportNodeAsImage(previewRef.current, {
        backgroundColor: EXPORT_IMAGE_BACKGROUNDS[style],
        width: EXPORT_IMAGE_WIDTH,
      });
      downloadBlob(blob, imageExportFilename(sessionTitle, sessionId));
      const okMsg = tr("exportImage.exportSuccess");
      setStatus({ kind: "ok", text: okMsg });
      onExported?.(true, okMsg);
    } catch (e) {
      const failMsg = `${tr("exportImage.exportFail")}: ${String(e)}`;
      setStatus({ kind: "error", text: failMsg });
      onExported?.(false, failMsg);
    } finally {
      setExporting(false);
    }
  };

  const footer: ReactNode = (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={onClose}
        disabled={exporting}
      >
        {tr("common.close")}
      </button>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => void handleExport()}
        disabled={!canExport}
      >
        <IconPhoto size={14} />
        {exporting ? tr("exportImage.exporting") : tr("exportImage.export")}
      </button>
    </>
  );

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={tr("exportImage.title")}
      size="lg"
      closeLabel={tr("common.close")}
      footer={footer}
      bodyClassName="export-image-modal__body"
    >
      {items.length === 0 ? (
        <p className="modal-status">{tr("exportImage.empty")}</p>
      ) : (
        <>
          <div className="export-image-modal__controls">
            <div className="export-image-modal__style-toggle" role="group">
              <button
                type="button"
                className={`btn btn--ghost btn--sm${style === "light" ? " is-active" : ""}`}
                aria-pressed={style === "light"}
                onClick={() => setStyle("light")}
              >
                {tr("exportImage.styleLight")}
              </button>
              <button
                type="button"
                className={`btn btn--ghost btn--sm${style === "dark" ? " is-active" : ""}`}
                aria-pressed={style === "dark"}
                onClick={() => setStyle("dark")}
              >
                {tr("exportImage.styleDark")}
              </button>
            </div>
            <label className="export-image-modal__metadata-check">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
              />
              <span>{tr("exportImage.includeMetadata")}</span>
            </label>
          </div>

          <div className="export-image-modal__select-head">
            <span className="export-image-modal__select-label">
              {tr("exportImage.selectMessages")}
            </span>
            <span className="export-image-modal__count">
              {tr("exportImage.messageCount", { count: selectedItems.length })}
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={selectAll}>
              {tr("exportImage.selectAll")}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={deselectAll}>
              {tr("exportImage.deselectAll")}
            </button>
          </div>

          <ul className="export-image-modal__list">
            {items.map((m) => (
              <li key={m.id} className="export-image-modal__row">
                <label className="export-image-modal__row-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span
                    className={`export-image-modal__row-role export-image-modal__row-role--${m.role}`}
                  >
                    {m.role === "user"
                      ? tr("exportImage.roleUser")
                      : tr("exportImage.roleAssistant")}
                  </span>
                  <span className="export-image-modal__row-preview">
                    {m.content.slice(0, 140)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {status ? (
            <p
              className={`modal-status${status.kind === "error" ? " modal-status--error" : ""}`}
              role={status.kind === "error" ? "alert" : "status"}
            >
              {status.text}
            </p>
          ) : null}

          {/* Hidden render target — captured by html-to-image, never shown live. */}
          <div className="export-image-offscreen" aria-hidden="true">
            <div
              ref={previewRef}
              className={`export-image-preview export-image-preview--${style}`}
              style={{ width: EXPORT_IMAGE_WIDTH }}
            >
              {includeMetadata ? (
                <div className="export-image-preview__header">
                  <div className="export-image-preview__title">
                    {sessionTitle || tr("session.untitled")}
                  </div>
                  {projectName ? (
                    <div className="export-image-preview__meta">{projectName}</div>
                  ) : null}
                </div>
              ) : null}
              <div className="export-image-preview__body">
                {selectedItems.map((m) => (
                  <div
                    key={m.id}
                    className={`export-image-preview__msg export-image-preview__msg--${m.role}`}
                  >
                    <div className="export-image-preview__bubble">
                      {m.content}
                    </div>
                    {includeMetadata && m.createdAt ? (
                      <div className="export-image-preview__ts">
                        {formatTimestamp(m.createdAt, locale)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="export-image-preview__footer">{tr("app.name")}</div>
            </div>
          </div>
        </>
      )}
    </GlassModal>
  );
}
