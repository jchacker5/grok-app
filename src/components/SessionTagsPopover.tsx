/**
 * Session tags/labels management popover — "Manage tags" context-menu item.
 *
 * Structurally mirrors `ContextMenu.tsx` (portaled to document.body, clamped
 * near viewport edges, closes on outside mousedown / Escape) but is a
 * dedicated component rather than reusing `ContextMenu`'s `items` list: tag
 * toggling needs multi-select checkbox behavior that stays open across
 * clicks, plus a freeform text input for adding brand-new tags — neither fits
 * `ContextMenu`'s "click an item, close the menu" model.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clampContextMenuPos } from "./ContextMenu";
import { IconCheck, IconTag } from "./icons";

export interface SessionTagsPopoverLabels {
  tagsLabel: string;
  noTags: string;
  newTagPlaceholder: string;
}

export interface SessionTagsPopoverProps {
  x: number;
  y: number;
  /** Tags currently on the session being edited. */
  tags: string[];
  /** All known tags across loaded sessions (checkbox list). */
  knownTags: string[];
  onClose: () => void;
  onToggleTag: (tag: string) => void;
  onAddTag: (tag: string) => void;
  labels: SessionTagsPopoverLabels;
}

export function SessionTagsPopover({
  x,
  y,
  tags,
  knownTags,
  onClose,
  onToggleTag,
  onAddTag,
  labels,
}: SessionTagsPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => clampContextMenuPos(x, y, 220, 260));
  const [draft, setDraft] = useState("");

  useLayoutEffect(() => {
    setPos(clampContextMenuPos(x, y, 220, 260));
  }, [x, y]);

  // After paint, re-clamp using the real popover size (list can grow tall).
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setPos(
      clampContextMenuPos(
        x,
        y,
        Math.ceil(rect.width) || 220,
        Math.ceil(rect.height) || 260,
      ),
    );
  }, [x, y, knownTags.length, tags.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".session-tags-popover")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer so the opening click does not immediately dismiss the popover.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      className="menu-panel context-menu att-menu session-tags-popover"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="session-tags-popover__head">{labels.tagsLabel}</div>
      {knownTags.length === 0 ? (
        <div className="session-tags-popover__empty">{labels.noTags}</div>
      ) : (
        <div className="session-tags-popover__list">
          {knownTags.map((tag) => {
            const checked = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className={
                  "session-tags-popover__item" +
                  (checked ? " is-checked" : "")
                }
                onClick={() => onToggleTag(tag)}
              >
                <span className="session-tags-popover__check" aria-hidden>
                  {checked ? <IconCheck size={14} /> : null}
                </span>
                <span className="session-tags-popover__label">{tag}</span>
              </button>
            );
          })}
        </div>
      )}
      <form
        className="session-tags-popover__add"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onAddTag(draft);
            setDraft("");
          }
        }}
      >
        <IconTag size={14} />
        <input
          type="text"
          value={draft}
          placeholder={labels.newTagPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          // Popover only opens via explicit click — autofocus is expected here.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </form>
    </div>,
    document.body,
  );
}
