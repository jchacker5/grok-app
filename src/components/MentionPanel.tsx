/**
 * `@`-mention autocomplete panel (`@file:`, `@model:`, `@session:`).
 *
 * Built fresh (not a refactor of `ComposerPlusPanel`) but borrows the same
 * structural ideas: one shared `entries` array drives both rendering and
 * keyboard nav (so they can never desync), section headers group by mention
 * kind, and content is wrapped in `OverlayScroll` (never raw
 * `overflow-y: auto` — native scrollbars are hidden globally, so a raw
 * overflow div silently clips content with no scroll affordance).
 */

import { useEffect, useRef, type CSSProperties, type Ref } from "react";
import type { Locale } from "@/i18n";
import { createT } from "@/i18n";
import { OverlayScroll } from "@/components/OverlayScroll";
import type { MentionItem, MentionKind } from "@/lib/mentionCatalog";
import { IconAt, IconBolt, IconChat, IconFileText } from "@/components/icons";

const ICON_SIZE = 16;

function mentionIcon(kind: MentionKind) {
  switch (kind) {
    case "file":
      return <IconFileText size={ICON_SIZE} />;
    case "model":
      return <IconBolt size={ICON_SIZE} />;
    case "session":
      return <IconChat size={ICON_SIZE} />;
    default:
      return <IconAt size={ICON_SIZE} />;
  }
}

type Row =
  | { type: "section"; id: string; label: string }
  | { type: "entry"; item: MentionItem; navIndex: number };

function buildMentionRows(
  entries: MentionItem[],
  labels: { files: string; models: string; sessions: string },
): Row[] {
  const rows: Row[] = [];
  let navIndex = 0;
  let lastKind: MentionKind | null = null;
  for (const item of entries) {
    if (item.kind !== lastKind) {
      const label =
        item.kind === "file"
          ? labels.files
          : item.kind === "model"
            ? labels.models
            : labels.sessions;
      rows.push({ type: "section", id: `sec-${item.kind}`, label });
      lastKind = item.kind;
    }
    rows.push({ type: "entry", item, navIndex: navIndex++ });
  }
  return rows;
}

export interface MentionPanelProps {
  open: boolean;
  locale: Locale;
  style?: CSSProperties;
  panelRef?: Ref<HTMLDivElement | null>;
  /** Sole list of selectable items — same array the host uses for keyboard nav. */
  entries: MentionItem[];
  /** Active kind narrowing (`file:`/`model:`/`session:`) or null for bare `@`. */
  kind: MentionKind | null;
  /** Live filter text after the trigger (and optional kind prefix). */
  query: string;
  filesLoading?: boolean;
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onSelect: (item: MentionItem) => void;
}

export function MentionPanel({
  open,
  locale,
  style,
  panelRef,
  entries,
  kind,
  query,
  filesLoading,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: MentionPanelProps) {
  const tr = createT(locale);
  const listRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    if (typeof panelRef === "function") panelRef(node);
    else if (panelRef && "current" in panelRef) {
      (panelRef as { current: HTMLDivElement | null }).current = node;
    }
  };

  const rows = buildMentionRows(entries, {
    files: tr("mention.section.files"),
    models: tr("mention.section.models"),
    sessions: tr("mention.section.sessions"),
  });

  // Keep the active row in view (same scroll-into-view approach as ComposerPlusPanel).
  useEffect(() => {
    if (!open) return;
    const panel = listRef.current;
    if (!panel) return;
    const el = panel.querySelector<HTMLElement>(
      `[data-mention-idx="${activeIndex}"]`,
    );
    if (!el) return;
    const pRect = panel.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.top < pRect.top) {
      panel.scrollTop -= pRect.top - eRect.top;
    } else if (eRect.bottom > pRect.bottom) {
      panel.scrollTop += eRect.bottom - pRect.bottom;
    }
  }, [activeIndex, open, entries.length]);

  if (!open) return null;

  const q = query.trim();
  const empty = entries.length === 0 && !(filesLoading && kind !== "model" && kind !== "session");

  return (
    <div
      ref={setRefs}
      className="menu-panel mention-panel mention-panel--portal"
      role="listbox"
      aria-label={tr("mention.section.files")}
      aria-activedescendant={
        entries[activeIndex] ? `mention-opt-${activeIndex}` : undefined
      }
      style={style}
    >
      <OverlayScroll className="mention-panel__scroll" viewportRef={listRef}>
        <div className="mention-panel__filter" aria-live="polite">
          <span className="mention-panel__filter-ico" aria-hidden>
            <IconAt size={14} />
          </span>
          <span className="mention-panel__filter-q">
            {kind ? `${kind}:${q}` : q}
          </span>
          <span className="mention-panel__filter-count">{entries.length}</span>
        </div>

        {rows.map((row) => {
          if (row.type === "section") {
            return (
              <div key={row.id} className="composer-plus__section">
                {row.label}
              </div>
            );
          }
          const { item, navIndex } = row;
          const active = navIndex === activeIndex;
          return (
            <button
              key={item.id}
              id={`mention-opt-${navIndex}`}
              type="button"
              role="option"
              aria-selected={active}
              data-mention-idx={navIndex}
              className={"composer-plus__item" + (active ? " is-active" : "")}
              onMouseEnter={() => onActiveIndexChange(navIndex)}
              onClick={() => onSelect(item)}
            >
              <span className="composer-plus__ico" aria-hidden>
                {mentionIcon(item.kind)}
              </span>
              <span className="composer-plus__title">{item.label}</span>
              {item.detail ? (
                <span className="composer-plus__desc">{item.detail}</span>
              ) : null}
            </button>
          );
        })}

        {filesLoading && (kind === "file" || kind === null) && (
          <div className="composer-plus__item composer-plus__item--muted" aria-busy>
            <span className="composer-plus__ico" aria-hidden>
              <IconFileText size={ICON_SIZE} />
            </span>
            <span className="composer-plus__title">
              {tr("mention.filesLoading")}
            </span>
          </div>
        )}

        {empty && (
          <div className="composer-plus__item composer-plus__item--muted">
            <span className="composer-plus__title">{tr("mention.empty")}</span>
          </div>
        )}
      </OverlayScroll>
    </div>
  );
}
