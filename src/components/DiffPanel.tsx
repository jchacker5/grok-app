/**
 * Inline diff review panel — Changes tab only (see ResourceViewer.tsx).
 * Renders real per-line DOM rows (gutter + content), not a single
 * `dangerouslySetInnerHTML` blob, so lines are individually clickable for
 * review comments. `CodePreview.tsx` is untouched and keeps serving every
 * other tab kind.
 *
 * Reuses the same highlight.js core + language set as CodePreview for a
 * consistent look (own registration call — CodePreview.tsx is not modified).
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import hljs from "highlight.js/lib/core";

import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import rust from "highlight.js/lib/languages/rust";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import kotlin from "highlight.js/lib/languages/kotlin";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import swift from "highlight.js/lib/languages/swift";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import ini from "highlight.js/lib/languages/ini";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import xml from "highlight.js/lib/languages/xml";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import makefile from "highlight.js/lib/languages/makefile";
import graphql from "highlight.js/lib/languages/graphql";
import lua from "highlight.js/lib/languages/lua";
import r from "highlight.js/lib/languages/r";
import plaintext from "highlight.js/lib/languages/plaintext";

import { languageFromFileName } from "@/lib/codeLang";
import { cn } from "@/lib/utils";
import type { createT } from "@/i18n";
import {
  findLineByStableId,
  type DiffHunk,
  type DiffLine,
  type ParsedDiff,
} from "@/lib/diffModel";
import type { DiffComment, DiffCommentAnchor } from "@/lib/reviewComments";
import {
  IconClose,
  IconMessageSquare,
  IconMessageSquarePlus,
  IconPlus,
} from "@/components/icons";

// Same theme stylesheet as CodePreview (Atom One Dark / Light, scoped by
// `.rp-code--dark` / `.rp-code--light`) so hljs token colors match exactly.
import "@/styles/code-preview.css";
import "@/styles/diff-panel.css";

let registered = false;
function ensureLangs() {
  if (registered) return;
  registered = true;
  const langs: [string, typeof javascript][] = [
    ["javascript", javascript],
    ["typescript", typescript],
    ["json", json],
    ["markdown", markdown],
    ["rust", rust],
    ["python", python],
    ["go", go],
    ["java", java],
    ["kotlin", kotlin],
    ["c", c],
    ["cpp", cpp],
    ["csharp", csharp],
    ["ruby", ruby],
    ["php", php],
    ["swift", swift],
    ["sql", sql],
    ["bash", bash],
    ["shell", bash],
    ["yaml", yaml],
    ["ini", ini],
    ["css", css],
    ["scss", scss],
    ["xml", xml],
    ["html", xml],
    ["dockerfile", dockerfile],
    ["makefile", makefile],
    ["graphql", graphql],
    ["lua", lua],
    ["r", r],
    ["plaintext", plaintext],
  ];
  for (const [name, def] of langs) {
    if (!hljs.getLanguage(name)) hljs.registerLanguage(name, def);
  }
}

function readDocTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" ? "light" : "dark";
}

function highlightContent(content: string, lang: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(content, { language: lang, ignoreIllegals: true })
        .value;
    }
    return hljs.highlightAuto(content).value;
  } catch {
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

/** Prefer the "new" side for context/add lines, "old" for pure removals. */
function defaultAnchor(path: string, line: DiffLine): DiffCommentAnchor {
  const side: "old" | "new" = line.newLineNumber != null ? "new" : "old";
  const lineNumber =
    side === "new" ? line.newLineNumber! : line.oldLineNumber!;
  return {
    path,
    stableId: line.stableId,
    contentHash: line.contentHash,
    side,
    lineNumber,
  };
}

export interface DiffPanelProps {
  model: ParsedDiff;
  comments: DiffComment[];
  onAddComment: (anchor: DiffCommentAnchor, body: string) => void;
  onRemoveComment: (id: string) => void;
  /** Bound translator (createT(locale)) — copy stays in i18n/messages.ts. */
  tr: ReturnType<typeof createT>;
  className?: string;
  /**
   * Workspace git diffs only — stage a single hunk (`git apply --cached`
   * on a constructed patch; see `buildHunkPatch()` in `lib/diffModel.ts`).
   * Omitted entirely for session-change diffs, which are not git-backed.
   */
  onStageHunk?: (hunk: DiffHunk) => void;
  /** Hunk header currently mid-stage (disables its button + shows a spinner label). */
  stagingHunkHeader?: string | null;
}

export function DiffPanel({
  model,
  comments,
  onAddComment,
  onRemoveComment,
  tr,
  className,
  onStageHunk,
  stagingHunkHeader,
}: DiffPanelProps) {
  ensureLangs();

  const [theme, setTheme] = useState<"light" | "dark">(readDocTheme);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(readDocTheme());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const lang = useMemo(() => languageFromFileName(model.path), [model.path]);

  /** stableId -> comments anchored there (existing, already-sent comments). */
  const commentsByStableId = useMemo(() => {
    const map = new Map<string, DiffComment[]>();
    for (const c of comments) {
      if (!map.has(c.stableId)) map.set(c.stableId, []);
      map.get(c.stableId)!.push(c);
    }
    return map;
  }, [comments]);

  const [composingId, setComposingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const openComposer = (line: DiffLine) => {
    setEditingId(null);
    setComposingId((cur) => (cur === line.stableId ? null : line.stableId));
    setDraftText("");
  };

  const submitComposer = (line: DiffLine) => {
    const body = draftText.trim();
    if (!body) {
      setComposingId(null);
      return;
    }
    onAddComment(defaultAnchor(model.path, line), body);
    setComposingId(null);
    setDraftText("");
  };

  const startEdit = (comment: DiffComment) => {
    setComposingId(null);
    setEditingId(comment.id);
    setEditText(comment.body);
  };

  const submitEdit = (comment: DiffComment) => {
    const body = editText.trim();
    if (body && body !== comment.body) {
      onRemoveComment(comment.id);
      onAddComment(
        {
          path: comment.path,
          stableId: comment.stableId,
          contentHash: comment.contentHash,
          side: comment.side,
          lineNumber: comment.lineNumber,
        },
        body,
      );
    }
    setEditingId(null);
    setEditText("");
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, cb: () => void) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      cb();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setComposingId(null);
      setEditingId(null);
    }
  };

  if (!model.hunks.length) {
    return (
      <div className={cn("diff-panel diff-panel--empty", className)}>
        {tr("changes.noDiff")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "diff-panel",
        "rp-code",
        theme === "light" ? "rp-code--light diff-panel--light" : "rp-code--dark diff-panel--dark",
        className,
      )}
    >
      {model.hunks.map((hunk) => (
        <div className="diff-panel__hunk" key={hunk.header + hunk.oldStart}>
          <div className="diff-panel__hunk-header">
            <span className="diff-panel__hunk-header-text">{hunk.header}</span>
            {onStageHunk ? (
              <button
                type="button"
                className="diff-panel__btn diff-panel__hunk-stage-btn"
                disabled={stagingHunkHeader === hunk.header}
                onClick={() => onStageHunk(hunk)}
              >
                <IconPlus size={12} />
                {stagingHunkHeader === hunk.header
                  ? tr("changes.stage.stagingHunk")
                  : tr("changes.stage.stageHunk")}
              </button>
            ) : null}
          </div>
          {hunk.lines.map((line) => {
            const html = highlightContent(line.content, lang);
            const lineComments = commentsByStableId.get(line.stableId) ?? [];
            const isComposing = composingId === line.stableId;
            return (
              <div key={line.stableId} className="diff-panel__line-group">
                <div
                  className={cn(
                    "diff-panel__row",
                    line.kind === "add" && "diff-panel__row--add",
                    line.kind === "remove" && "diff-panel__row--remove",
                  )}
                >
                  <button
                    type="button"
                    className="diff-panel__gutter"
                    title={tr("changes.review.addComment")}
                    aria-label={tr("changes.review.addComment")}
                    onClick={() => openComposer(line)}
                  >
                    <span className="diff-panel__ln diff-panel__ln--old">
                      {line.oldLineNumber ?? ""}
                    </span>
                    <span className="diff-panel__ln diff-panel__ln--new">
                      {line.newLineNumber ?? ""}
                    </span>
                    <span className="diff-panel__gutter-hint" aria-hidden>
                      {lineComments.length > 0 ? (
                        <IconMessageSquare size={13} />
                      ) : (
                        <IconMessageSquarePlus size={13} />
                      )}
                    </span>
                  </button>
                  <pre className="diff-panel__pre">
                    <span className="diff-panel__marker" aria-hidden>
                      {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
                    </span>
                    <code
                      className={`hljs language-${lang}`}
                      dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
                    />
                  </pre>
                </div>

                {isComposing && (
                  <div className="diff-panel__composer">
                    <textarea
                      autoFocus
                      className="diff-panel__composer-input"
                      placeholder={tr("changes.review.placeholder")}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => onComposerKeyDown(e, () => submitComposer(line))}
                    />
                    <div className="diff-panel__composer-actions">
                      <button
                        type="button"
                        className="diff-panel__btn diff-panel__btn--ghost"
                        onClick={() => setComposingId(null)}
                      >
                        {tr("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="diff-panel__btn diff-panel__btn--primary"
                        disabled={!draftText.trim()}
                        onClick={() => submitComposer(line)}
                      >
                        {tr("common.save")}
                      </button>
                    </div>
                  </div>
                )}

                {lineComments.map((comment) => {
                  const currentLine = findLineByStableId(model, comment.stableId);
                  const stale =
                    !!currentLine && currentLine.contentHash !== comment.contentHash;
                  const isEditing = editingId === comment.id;
                  return (
                    <div className="diff-panel__comment" key={comment.id}>
                      {isEditing ? (
                        <>
                          <textarea
                            autoFocus
                            className="diff-panel__composer-input"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) =>
                              onComposerKeyDown(e, () => submitEdit(comment))
                            }
                          />
                          <div className="diff-panel__composer-actions">
                            <button
                              type="button"
                              className="diff-panel__btn diff-panel__btn--ghost"
                              onClick={() => setEditingId(null)}
                            >
                              {tr("common.cancel")}
                            </button>
                            <button
                              type="button"
                              className="diff-panel__btn diff-panel__btn--primary"
                              disabled={!editText.trim()}
                              onClick={() => submitEdit(comment)}
                            >
                              {tr("common.save")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="diff-panel__comment-body">{comment.body}</div>
                          {stale && (
                            <div className="diff-panel__comment-stale">
                              {tr("changes.review.staleAnchor")}
                            </div>
                          )}
                          <div className="diff-panel__comment-actions">
                            <button
                              type="button"
                              className="diff-panel__icon-btn"
                              title={tr("changes.review.editComment")}
                              aria-label={tr("changes.review.editComment")}
                              onClick={() => startEdit(comment)}
                            >
                              <IconMessageSquare size={13} />
                            </button>
                            <button
                              type="button"
                              className="diff-panel__icon-btn diff-panel__icon-btn--danger"
                              title={tr("changes.review.deleteComment")}
                              aria-label={tr("changes.review.deleteComment")}
                              onClick={() => onRemoveComment(comment.id)}
                            >
                              <IconClose size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
