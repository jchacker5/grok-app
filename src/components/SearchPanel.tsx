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

export interface SearchPanelProps {
  query: string;
  results: GroupedSearchResult[];
  loading?: boolean;
  onQueryChange: (q: string) => void;
  onSelectMatch: (sessionId: string, match?: SearchMatch) => void;
  onClose?: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  results,
  loading,
  onQueryChange,
  onSelectMatch,
  onClose,
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

  // Flatten items for keyboard navigation
  const flatItems: Array<{ sessionId: string; match?: SearchMatch }> = [];
  for (const group of results) {
    const isExpanded = expandedSessions[group.sessionId];
    const displayMatches = isExpanded ? group.matches : group.matches.slice(0, 5);
    for (const m of displayMatches) {
      flatItems.push({ sessionId: group.sessionId, match: m });
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
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
          placeholder="Search conversation history..."
          className="search-panel__input"
          autoFocus
        />
        {loading && <span style={{ marginLeft: "8px", fontSize: "12px", opacity: 0.7 }}>Searching…</span>}
      </div>

      <div className="search-panel__results">
        {localQuery.trim().length < 2 ? (
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
