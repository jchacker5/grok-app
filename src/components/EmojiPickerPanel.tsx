/**
 * Composer emoji picker — mirrors `ComposerPlusPanel`'s structure (search
 * input + OverlayScroll-wrapped list) but renders a grid instead of rows.
 *
 * CRITICAL: content lives inside `OverlayScroll`, never a raw
 * `overflow-y: auto` div — the app hides native scrollbars globally, so a
 * raw overflow div silently clips content with no scroll affordance (the
 * exact bug just fixed in `ComposerPlusPanel`).
 */

import { useMemo, useRef, type CSSProperties, type Ref } from "react";
import type { Locale } from "@/i18n";
import { createT } from "@/i18n";
import { OverlayScroll } from "@/components/OverlayScroll";
import {
  EMOJI_CATEGORIES,
  filterEmoji,
  type EmojiEntry,
} from "@/lib/emojiCatalog";
import type { MessageKey } from "@/i18n";

function categoryLabelKey(category: string): MessageKey {
  return `emoji.category.${category}` as MessageKey;
}

export interface EmojiPickerPanelProps {
  open: boolean;
  locale: Locale;
  style?: CSSProperties;
  panelRef?: Ref<HTMLDivElement | null>;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (char: string) => void;
}

export function EmojiPickerPanel({
  open,
  locale,
  style,
  panelRef,
  query,
  onQueryChange,
  onSelect,
}: EmojiPickerPanelProps) {
  const tr = createT(locale);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    if (typeof panelRef === "function") panelRef(node);
    else if (panelRef && "current" in panelRef) {
      (panelRef as { current: HTMLDivElement | null }).current = node;
    }
  };

  const q = query.trim();

  /** Grouped by category when not searching; flat filtered list otherwise. */
  const groups = useMemo(() => {
    if (q) {
      return [{ category: "", items: filterEmoji(q) }];
    }
    return EMOJI_CATEGORIES.map((category) => ({
      category,
      items: filterEmoji("", category),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);

  if (!open) return null;

  return (
    <div
      ref={setRefs}
      className="menu-panel emoji-picker emoji-picker--portal"
      role="dialog"
      aria-label={tr("composer.emoji")}
      style={style}
    >
      <div className="emoji-picker__search-row">
        <input
          ref={searchRef}
          type="text"
          className="emoji-picker__search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={tr("composer.emojiSearch")}
          aria-label={tr("composer.emojiSearch")}
          autoFocus
        />
      </div>
      <OverlayScroll className="emoji-picker__scroll" viewportRef={viewportRef}>
        {totalCount === 0 ? (
          <div className="emoji-picker__empty">{tr("composer.emojiEmpty")}</div>
        ) : (
          groups.map((g) => (
            <div key={g.category || "search"} className="emoji-picker__group">
              {g.category ? (
                <div className="emoji-picker__section">
                  {tr(categoryLabelKey(g.category))}
                </div>
              ) : null}
              <div className="emoji-picker__grid" role="listbox">
                {g.items.map((e: EmojiEntry) => (
                  <button
                    key={`${g.category}:${e.char}:${e.name}`}
                    type="button"
                    role="option"
                    className="emoji-picker__cell"
                    title={e.name}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => onSelect(e.char)}
                  >
                    <span aria-hidden>{e.char}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </OverlayScroll>
    </div>
  );
}
