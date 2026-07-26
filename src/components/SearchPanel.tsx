import React, { useState, useEffect } from "react";
import "../styles/components/SearchPanel.css";

export interface SearchMatch {
  lineNumber?: number;
  lineContent?: string;
  score?: number;
  messageIndex?: number;
}

export interface GroupedSearchResult {
  sessionId: string;
  sessionTitle: string;
  matches: SearchMatch[];
}

/** One find-in-files content hit (greps file bodies — distinct from
 * session/chat search above and from any filename-only fuzzy finder). */
export interface FileSearchHit {
  path: string;
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export type SearchPanelMode = "sessions" | "files";

/**
 * Optional find-in-files mode. When omitted the panel behaves exactly as
 * before (sessions-only, no tab switcher) — existing callers are
 * unaffected.
 */
export interface SearchPanelFileSearch {
  hits: FileSearchHit[];
  loading: boolean;
  /** Whether a project is active (files search needs a workspace root). */
  enabled: boolean;
  ripgrepUnavailable: boolean;
  onSelectHit: (hit: FileSearchHit) => void;
  labels: {
    sessionsTab: string;
    filesTab: string;
    filesPlaceholder: string;
    filesEmpty: string;
    filesEmptyProject: string;
    ripgrepUnavailable: string;
  };
}

export interface SearchPanelProps {
  query: string;
  results: GroupedSearchResult[];
  loading?: boolean;
  onQueryChange: (q: string) => void;
  onSelectMatch: (sessionId: string, match?: SearchMatch) => void;
  onClose?: () => void;
  /** Controlled sessions/files mode — defaults to "sessions" when omitted. */
  mode?: SearchPanelMode;
  onModeChange?: (mode: SearchPanelMode) => void;
  fileSearch?: SearchPanelFileSearch;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  results,
  loading,
  onQueryChange,
  onSelectMatch,
  onClose,
  mode = "sessions",
  onModeChange,
  fileSearch,
}) => {
  const [localQuery, setLocalQuery] = useState(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Debounce query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      onQueryChange(localQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [localQuery, onQueryChange]);

  // Reset keyboard selection when switching modes so stale indices don't
  // point at the wrong list.
  useEffect(() => {
    setSelectedIndex(0);
  }, [mode]);

  const filesMode = mode === "files" && !!fileSearch;

  // Flatten items for keyboard navigation
  const flatItems: Array<{ sessionId: string; match?: SearchMatch }> = [];
  if (!filesMode) {
    for (const group of results) {
      const isExpanded = expandedSessions[group.sessionId];
      const displayMatches = isExpanded ? group.matches : group.matches.slice(0, 5);
      for (const m of displayMatches) {
        flatItems.push({ sessionId: group.sessionId, match: m });
      }
    }
  }
  const fileHits = filesMode ? fileSearch!.hits : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const count = filesMode ? fileHits.length : flatItems.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, count));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + count) % Math.max(1, count));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filesMode) {
        const hit = fileHits[selectedIndex];
        if (hit) fileSearch!.onSelectHit(hit);
      } else if (flatItems[selectedIndex]) {
        const item = flatItems[selectedIndex];
        onSelectMatch(item.sessionId, item.match);
      }
    } else if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
    }
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  let globalMatchCounter = 0;

  return (
    <div className="search-panel" onKeyDown={handleKeyDown}>
      <div className="search-panel__header">
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder={
            filesMode ? fileSearch!.labels.filesPlaceholder : "Search conversation history..."
          }
          className="search-panel__input"
          autoFocus
        />
        {(filesMode ? fileSearch!.loading : loading) && (
          <span style={{ marginLeft: "8px", fontSize: "12px", opacity: 0.7 }}>Searching…</span>
        )}
      </div>

      {fileSearch && onModeChange ? (
        <div className="search-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!filesMode}
            className={`search-panel__tab${!filesMode ? " is-active" : ""}`}
            onClick={() => onModeChange("sessions")}
          >
            {fileSearch.labels.sessionsTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filesMode}
            className={`search-panel__tab${filesMode ? " is-active" : ""}`}
            onClick={() => onModeChange("files")}
          >
            {fileSearch.labels.filesTab}
          </button>
        </div>
      ) : null}

      {filesMode && fileSearch!.ripgrepUnavailable ? (
        <div className="search-panel__hint" role="status">
          {fileSearch!.labels.ripgrepUnavailable}
        </div>
      ) : null}

      <div className="search-panel__results">
        {filesMode ? (
          !fileSearch!.enabled ? (
            <div className="search-panel__empty">{fileSearch!.labels.filesEmptyProject}</div>
          ) : localQuery.trim().length < 2 ? (
            <div className="search-panel__empty">{fileSearch!.labels.filesPlaceholder}</div>
          ) : fileHits.length === 0 ? (
            <div className="search-panel__empty">{fileSearch!.labels.filesEmpty}</div>
          ) : (
            <div className="search-result-group__matches">
              {fileHits.map((hit, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${hit.path}:${hit.lineNumber}:${idx}`}
                    className={`search-result-match ${isSelected ? "search-result-match--selected" : ""}`}
                    onClick={() => fileSearch!.onSelectHit(hit)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="search-result-match__path" title={hit.path}>
                      {hit.path}
                    </span>
                    <span className="search-result-match__snippet">
                      {highlightMatch(hit.lineText, localQuery)}
                    </span>
                    <span className="search-result-match__line">L{hit.lineNumber}</span>
                  </div>
                );
              })}
            </div>
          )
        ) : localQuery.trim().length < 2 ? (
          <div className="search-panel__empty">Type at least 2 characters to search...</div>
        ) : results.length === 0 ? (
          <div className="search-panel__empty">No matching messages found</div>
        ) : (
          results.map((group) => {
            const isExpanded = expandedSessions[group.sessionId];
            const visibleMatches = isExpanded ? group.matches : group.matches.slice(0, 5);
            const remainingCount = group.matches.length - 5;

            return (
              <div key={group.sessionId} className="search-result-group">
                <div
                  className="search-result-group__title"
                  onClick={() => onSelectMatch(group.sessionId)}
                >
                  {group.sessionTitle}
                </div>

                <div className="search-result-group__matches">
                  {visibleMatches.map((m, idx) => {
                    const itemIdx = globalMatchCounter++;
                    const isSelected = itemIdx === selectedIndex;

                    return (
                      <div
                        key={idx}
                        className={`search-result-match ${isSelected ? "search-result-match--selected" : ""}`}
                        onClick={() => onSelectMatch(group.sessionId, m)}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                      >
                        <span className="search-result-match__snippet">
                          {highlightMatch(m.lineContent || "", localQuery)}
                        </span>
                        {m.lineNumber != null && (
                          <span className="search-result-match__line">L{m.lineNumber}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isExpanded && remainingCount > 0 && (
                  <button
                    type="button"
                    className="search-result-group__expand"
                    onClick={() =>
                      setExpandedSessions((prev) => ({ ...prev, [group.sessionId]: true }))
                    }
                  >
                    Show all {group.matches.length} results in this session
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
