/**
 * ⌘P fuzzy file finder — distinct from the ⌘K session/command palette
 * (`App.tsx`'s "Search / command palette (Codex-style)" + `SearchPanel`,
 * which searches chat sessions, not files). This searches every file under
 * the active project's workspace.
 *
 * Deviation note: composer toolbar panels (`ComposerPlusPanel`,
 * `EmojiPickerPanel`) anchor to a trigger button via `useFloatingMenu`. ⌘P
 * has no anchor button — it's a global shortcut, like the existing ⌘K
 * session search — so this reuses `GlassModal` (the same centered-dialog
 * chrome ⌘K already uses) instead of the floating-menu pattern. The list
 * itself still follows the established `OverlayScroll` convention (native
 * scrollbars are hidden app-wide; a raw `overflow-y: auto` list would clip
 * silently with no scroll affordance).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassModal } from "@/components/GlassModal";
import { OverlayScroll } from "@/components/OverlayScroll";
import { IconFileText } from "@/components/icons";
import type { Locale } from "@/i18n";
import { createT } from "@/i18n";
import { fuzzyFilterFiles } from "@/lib/fuzzyFile";

export interface FileFinderPanelProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  /** Project-relative file paths (from `listProjectFilesRecursive`). */
  files: string[];
  loading?: boolean;
  onSelect: (relativePath: string) => void;
}

function highlightMatch(path: string, query: string) {
  const q = query.trim();
  if (!q) return path;
  const idx = path.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return path;
  return (
    <>
      {path.slice(0, idx)}
      <mark className="file-finder__highlight">{path.slice(idx, idx + q.length)}</mark>
      {path.slice(idx + q.length)}
    </>
  );
}

export function FileFinderPanel({
  open,
  onClose,
  locale,
  files,
  loading,
  onSelect,
}: FileFinderPanelProps) {
  const tr = createT(locale);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(() => fuzzyFilterFiles(query, files, 200), [query, files]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length ? (prev - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[selectedIndex];
      if (hit) onSelect(hit.path);
    }
    // Escape is handled by GlassModal itself.
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={tr("shortcuts.fileFinder")}
      size="md"
      closeLabel={tr("common.close")}
      bodyClassName="file-finder__body"
      wrapBody
    >
      <div className="file-finder" onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("fileFinder.placeholder")}
          className="file-finder__input"
          autoComplete="off"
          spellCheck={false}
        />
        <OverlayScroll className="file-finder__scroll">
          {loading ? (
            <p className="file-finder__empty">{tr("fileFinder.loading")}</p>
          ) : results.length === 0 ? (
            <p className="file-finder__empty">{tr("fileFinder.empty")}</p>
          ) : (
            <ul className="file-finder__list">
              {results.map((r, idx) => (
                <li
                  key={r.path}
                  className={
                    "file-finder__item" +
                    (idx === selectedIndex ? " file-finder__item--selected" : "")
                  }
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => onSelect(r.path)}
                >
                  <IconFileText size={14} className="file-finder__icon" />
                  <span className="file-finder__path">{highlightMatch(r.path, query)}</span>
                </li>
              ))}
            </ul>
          )}
        </OverlayScroll>
      </div>
    </GlassModal>
  );
}
