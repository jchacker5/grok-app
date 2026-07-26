/**
 * Resource-pane code preview — highlight.js (same stack as Grok Desktop)
 * with light/dark themes bound to `data-theme` on documentElement.
 */

import { useEffect, useMemo, useState } from "react";
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
import diff from "highlight.js/lib/languages/diff";
import graphql from "highlight.js/lib/languages/graphql";
import lua from "highlight.js/lib/languages/lua";
import r from "highlight.js/lib/languages/r";
import plaintext from "highlight.js/lib/languages/plaintext";

import { languageFromFileName } from "@/lib/codeLang";
import { cn } from "@/lib/utils";

// Themes: Atom One Dark / One Light (scoped in code-preview.css)
import "@/styles/code-preview.css";

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
    ["diff", diff],
    ["graphql", graphql],
    ["lua", lua],
    ["r", r],
    ["plaintext", plaintext],
  ];
  for (const [name, def] of langs) {
    if (!hljs.getLanguage(name)) hljs.registerLanguage(name, def);
  }
}

/**
 * Per-line git-blame annotation (ResourceViewer file-preview gutter).
 * Kept decoupled from `@/lib/api`'s `BlameLine` shape (same fields) so this
 * component has no Tauri-command import.
 */
export interface CodePreviewBlameLine {
  lineNumber: number;
  author: string;
  date: string;
  commitShort: string;
  summary?: string | null;
}

export interface CodePreviewProps {
  code: string;
  /** File name for language detection (preferred). */
  fileName?: string;
  /** Explicit highlight.js language id. */
  language?: string;
  className?: string;
  /** Optional footer note (e.g. truncated). */
  footer?: string | null;
  /**
   * Optional per-line blame annotations. When present (non-empty), switches
   * to a lightweight per-line rendering mode (real DOM rows, one hljs
   * highlight pass per line — same technique as DiffPanel.tsx) so each row
   * can carry its own gutter annotation. The normal single-blob render path
   * below is completely unchanged for every other caller.
   */
  blame?: CodePreviewBlameLine[] | null;
}

/** Compact author initials for the blame gutter chip (full name via title). */
export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readDocTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" ? "light" : "dark";
}

export function CodePreview({
  code,
  fileName,
  language,
  className,
  footer,
  blame,
}: CodePreviewProps) {
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

  const lang = useMemo(() => {
    if (language && language !== "auto") return language;
    if (fileName) return languageFromFileName(fileName);
    return "plaintext";
  }, [language, fileName]);

  const html = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true })
          .value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      // Escape minimal HTML if highlight fails
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [code, lang]);

  const lines = useMemo(() => {
    // Keep trailing newline as empty last line for gutter count
    const parts = code.split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    return Math.max(parts.length, 1);
  }, [code]);

  const hasBlame = !!blame && blame.length > 0;

  // Blame lookup + per-line source, only computed when the blame gutter is
  // active. Each line is highlighted independently (same approach as
  // DiffPanel.tsx) rather than splitting the full-file hljs output, which
  // would risk breaking open <span> tags across per-line DOM nodes.
  const blameByLine = useMemo(() => {
    if (!hasBlame) return null;
    const map = new Map<number, CodePreviewBlameLine>();
    for (const b of blame!) map.set(b.lineNumber, b);
    return map;
  }, [blame, hasBlame]);

  const codeLines = useMemo(() => {
    if (!hasBlame) return null;
    const parts = code.split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    return parts.length > 0 ? parts : [""];
  }, [code, hasBlame]);

  if (hasBlame && codeLines && blameByLine) {
    return (
      <div
        className={cn(
          "rp-code",
          "rp-code--blame",
          theme === "light" ? "rp-code--light" : "rp-code--dark",
          className,
        )}
        data-language={lang}
      >
        <div className="rp-code__blame-scroll">
          {codeLines.map((lineText, i) => {
            const lineNumber = i + 1;
            const info = blameByLine.get(lineNumber);
            let lineHtml = "";
            try {
              lineHtml =
                lang && hljs.getLanguage(lang)
                  ? hljs.highlight(lineText, { language: lang, ignoreIllegals: true }).value
                  : hljs.highlightAuto(lineText).value;
            } catch {
              lineHtml = lineText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            }
            const title = info
              ? `${info.author} · ${info.date} · ${info.commitShort}${
                  info.summary ? `\n${info.summary}` : ""
                }`
              : undefined;
            return (
              <div className="rp-code__blame-row" key={lineNumber}>
                <div className="rp-code__blame-gutter" title={title} aria-hidden={!info}>
                  <span className="rp-code__blame-chip">
                    {info ? authorInitials(info.author) : ""}
                  </span>
                  <span className="rp-code__blame-date">{info?.date ?? ""}</span>
                  <span className="rp-code__ln rp-code__blame-ln">{lineNumber}</span>
                </div>
                <pre className="rp-code__blame-pre">
                  <code
                    className={`hljs language-${lang}`}
                    dangerouslySetInnerHTML={{ __html: lineHtml || "&nbsp;" }}
                  />
                </pre>
              </div>
            );
          })}
        </div>
        {footer ? <div className="rp-code__footer">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rp-code",
        theme === "light" ? "rp-code--light" : "rp-code--dark",
        className,
      )}
      data-language={lang}
    >
      <div className="rp-code__scroll">
        <div className="rp-code__gutter" aria-hidden>
          {Array.from({ length: lines }, (_, i) => (
            <span key={i} className="rp-code__ln">
              {i + 1}
            </span>
          ))}
        </div>
        <pre className="rp-code__pre">
          <code
            className={`hljs language-${lang}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      </div>
      {footer ? <div className="rp-code__footer">{footer}</div> : null}
    </div>
  );
}
