/**
 * Path / code block — Cursor-style soft chrome (label + wrap + copy).
 *
 * Large blocks and git diffs collapse by default so a big patch does not blow
 * out the thread; a summary row (line + ±change counts) expands on click.
 */

import { useMemo, useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown, IconChevronRight, IconCopy } from "@/components/icons";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Any block taller than this folds by default. */
const BLOCK_FOLD_LINES = 40;
/** Diffs fold sooner — they are noisy and usually skimmed, not read. */
const DIFF_FOLD_LINES = 14;

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const p = node as { props?: { children?: ReactNode } };
    return extractText(p.props?.children);
  }
  return "";
}

/** Heuristic: is this block a unified/git diff? */
function looksLikeDiff(lang: string, text: string): boolean {
  if (lang === "diff" || lang === "patch") return true;
  if (/^diff --git /m.test(text)) return true;
  // A hunk header plus at least one +/- line is a strong signal.
  return /^@@ .* @@/m.test(text) && /^[+-]/m.test(text);
}

/** Count added / removed lines in a unified diff (ignores +++/--- headers). */
function diffStats(text: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}

export function CodeBlock({
  language,
  children,
  wrapLabel = "Wrap",
  unwrapLabel = "No wrap",
  copyLabel = "Copy",
  expandLabel = "Expand",
  collapseLabel = "Collapse",
  linesLabel = "lines",
}: {
  language?: string;
  children: ReactNode;
  wrapLabel?: string;
  unwrapLabel?: string;
  copyLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  linesLabel?: string;
}) {
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const lang = (language || "text").replace(/^language-/, "") || "text";
  const text = extractText(children).replace(/\n$/, "");

  const meta = useMemo(() => {
    const lineCount = text ? text.split("\n").length : 0;
    const isDiff = looksLikeDiff(lang, text);
    const foldable =
      (isDiff && lineCount > DIFF_FOLD_LINES) || lineCount > BLOCK_FOLD_LINES;
    const stats = isDiff ? diffStats(text) : null;
    return { lineCount, isDiff, foldable, stats };
  }, [lang, text]);

  // Big blocks / diffs start collapsed.
  const [collapsed, setCollapsed] = useState(meta.foldable);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="chat-code">
      <div className="chat-code__bar">
        {meta.foldable ? (
          <button
            type="button"
            className="chat-code__fold"
            aria-expanded={!collapsed}
            aria-label={collapsed ? expandLabel : collapseLabel}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <IconChevronRight size={13} />
            ) : (
              <IconChevronDown size={13} />
            )}
            <span className="chat-code__lang">{lang}</span>
            {meta.stats ? (
              <span className="chat-code__diffstat" aria-hidden>
                <span className="chat-code__diffstat-add">
                  +{meta.stats.added}
                </span>
                <span className="chat-code__diffstat-del">
                  −{meta.stats.removed}
                </span>
              </span>
            ) : (
              <span className="chat-code__count">
                {meta.lineCount} {linesLabel}
              </span>
            )}
          </button>
        ) : (
          <span className="chat-code__lang">{lang}</span>
        )}
        <div className="chat-code__bar-actions">
          {!collapsed && (
            <Tip label={wrap ? unwrapLabel : wrapLabel}>
              <button
                type="button"
                className={cn("chat-code__btn", wrap && "is-on")}
                aria-label={wrap ? unwrapLabel : wrapLabel}
                aria-pressed={wrap}
                onClick={() => setWrap((v) => !v)}
              >
                <span className="chat-code__wrap-icon" aria-hidden>
                  ↵
                </span>
              </button>
            </Tip>
          )}
          <Tip label={copied ? "OK" : copyLabel}>
            <button
              type="button"
              className={cn("chat-code__btn", copied && "is-copied")}
              aria-label={copyLabel}
              onClick={() => void onCopy()}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
          </Tip>
        </div>
      </div>
      {collapsed ? null : (
        <pre className={cn("chat-code__pre", wrap && "is-wrap")}>
          <code>{children}</code>
        </pre>
      )}
    </div>
  );
}
