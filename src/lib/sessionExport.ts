/** Build a markdown export for a whole chat session. */

export type ExportableMessage = {
  role: "user" | "assistant" | "tool" | string;
  content: string;
  thought?: string;
  createdAt?: string;
};

export type SessionExportInput = {
  title: string;
  projectName?: string | null;
  projectPath?: string | null;
  sessionId?: string | null;
  exportedAt?: string;
  messages: ExportableMessage[];
};

function roleHeading(role: string): string {
  if (role === "user") return "User";
  if (role === "assistant") return "Assistant";
  if (role === "tool") return "Tool";
  return role;
}

/**
 * Render a session as GitHub-flavored markdown.
 * Skips empty tool shells; keeps assistant thought in a collapsed details block.
 */
export function sessionToMarkdown(input: SessionExportInput): string {
  const lines: string[] = [];
  const title = (input.title || "Untitled").trim() || "Untitled";
  lines.push(`# ${title}`);
  lines.push("");

  const meta: string[] = [];
  if (input.projectName) meta.push(`Project: ${input.projectName}`);
  if (input.projectPath) meta.push(`Path: ${input.projectPath}`);
  if (input.sessionId) meta.push(`Session: ${input.sessionId}`);
  meta.push(`Exported: ${input.exportedAt || new Date().toISOString()}`);
  lines.push(meta.map((m) => `- ${m}`).join("\n"));
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const m of input.messages) {
    const body = (m.content || "").trim();
    const thought = (m.thought || "").trim();
    if (!body && !thought) continue;
    if (m.role === "tool" && !body) continue;

    lines.push(`## ${roleHeading(m.role)}`);
    if (m.createdAt) {
      lines.push(`*${m.createdAt}*`);
      lines.push("");
    }
    if (thought) {
      lines.push("<details>");
      lines.push("<summary>Thinking</summary>");
      lines.push("");
      lines.push(thought);
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
    if (body) {
      lines.push(body);
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/**
 * Render a session as pretty-printed JSON for data portability.
 * Only user-facing content \u2014 no system prompts or internal store fields.
 * Applies the same skip rules as {@link sessionToMarkdown} (drops empty
 * messages and empty tool shells).
 */
export function sessionToJson(input: SessionExportInput): string {
  const messages = input.messages
    .filter((m) => {
      const body = (m.content || "").trim();
      const thought = (m.thought || "").trim();
      if (!body && !thought) return false;
      if (m.role === "tool" && !body) return false;
      return true;
    })
    .map((m) => {
      const out: Record<string, string> = {
        role: m.role,
        content: (m.content || "").trim(),
      };
      const thought = (m.thought || "").trim();
      if (thought) out.thought = thought;
      if (m.createdAt) out.timestamp = m.createdAt;
      return out;
    });

  const doc: Record<string, unknown> = {
    title: (input.title || "Untitled").trim() || "Untitled",
  };
  if (input.projectName) doc.projectName = input.projectName;
  if (input.projectPath) doc.projectPath = input.projectPath;
  if (input.sessionId) doc.sessionId = input.sessionId;
  doc.exportedAt = input.exportedAt || new Date().toISOString();
  doc.messageCount = messages.length;
  doc.messages = messages;

  return JSON.stringify(doc, null, 2) + "\n";
}

/** Safe download filename from a session title. */
export function sessionExportFilename(
  title: string,
  sessionId?: string | null,
  ext: "md" | "json" = "md",
): string {
  const base = (title || "session")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const id = (sessionId || "").slice(0, 8);
  const name = base || "session";
  return id ? `grok-${name}-${id}.${ext}` : `grok-${name}.${ext}`;
}
