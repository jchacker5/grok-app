/**
 * Prompt Library — curated built-in prompts + user-created custom prompts.
 * Built-ins ship hardcoded here (frontend-only); custom prompts are CRUD'd
 * through the host (`custom_prompt_*` commands) with a localStorage fallback
 * for web/browser builds, mirroring `automations.ts` / `spaces.ts`.
 *
 * "Apply" inserts the prompt's content into the composer draft — this app has
 * no separate "system prompt" concept, so the prompt text becomes the message
 * the agent receives (closest faithful equivalent to the original intent).
 */

export type PromptCategory =
  | "general"
  | "coding"
  | "writing"
  | "analysis"
  | "custom";

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "general",
  "coding",
  "writing",
  "analysis",
  "custom",
];

export interface LibraryPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: PromptCategory;
  isBuiltIn: boolean;
}

export interface CustomPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: PromptCategory | string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomPromptInput {
  name: string;
  description?: string;
  content: string;
  category?: string;
}

/** Soft cap — UI shows a warning past this many custom prompts (not enforced). */
export const CUSTOM_PROMPTS_WARN_LIMIT = 100;

/** Built-in prompts — always available, never editable/deletable. */
export const BUILT_IN_PROMPTS: LibraryPrompt[] = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Review code for bugs, style, and security issues",
    content:
      "You are an expert code reviewer. Analyze the following code for correctness, edge cases, security vulnerabilities, performance issues, and adherence to best practices. Point out specific lines and suggest concrete fixes.",
    category: "coding",
    isBuiltIn: true,
  },
  {
    id: "debug-helper",
    name: "Debugging Assistant",
    description: "Diagnose and fix a bug methodically",
    content:
      "You are a meticulous debugging assistant. Given an error, stack trace, or unexpected behavior, form a hypothesis, verify it by reading the relevant code, and propose the smallest correct fix. Explain the root cause before suggesting a patch.",
    category: "coding",
    isBuiltIn: true,
  },
  {
    id: "refactor-guide",
    name: "Refactoring Guide",
    description: "Improve code structure without changing behavior",
    content:
      "You are a refactoring specialist. Improve the structure, readability, and maintainability of the following code without changing its external behavior. Explain each change and why it helps.",
    category: "coding",
    isBuiltIn: true,
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    description: "Creative writing partner for fiction and prose",
    content:
      "You are a creative writing partner. Help me develop vivid characters, engaging plots, and polished prose. Ask clarifying questions about tone and audience when helpful, and offer specific, actionable suggestions rather than generic praise.",
    category: "writing",
    isBuiltIn: true,
  },
  {
    id: "editor",
    name: "Copy Editor",
    description: "Tighten and polish written text",
    content:
      "You are a precise copy editor. Improve clarity, grammar, and flow while preserving the author's voice and meaning. Flag any factual claims that seem unsupported.",
    category: "writing",
    isBuiltIn: true,
  },
  {
    id: "email-drafter",
    name: "Email Drafter",
    description: "Draft clear, concise professional emails",
    content:
      "You are an assistant that drafts clear, concise, professional emails. Match the requested tone, keep it brief, and lead with the ask or key point.",
    category: "writing",
    isBuiltIn: true,
  },
  {
    id: "data-analysis",
    name: "Data Analyst",
    description: "Analyze data and generate insights",
    content:
      "You are a data analyst. Help me understand the following data: identify trends, anomalies, and correlations, and summarize the most actionable insights in plain language before diving into details.",
    category: "analysis",
    isBuiltIn: true,
  },
  {
    id: "research-summarizer",
    name: "Research Summarizer",
    description: "Summarize research or documents into key takeaways",
    content:
      "You are a research summarizer. Read the given material and produce a structured summary: key claims, supporting evidence, caveats/limitations, and open questions. Prefer bullet points over prose.",
    category: "analysis",
    isBuiltIn: true,
  },
  {
    id: "decision-helper",
    name: "Decision Helper",
    description: "Weigh tradeoffs for a decision systematically",
    content:
      "You are a decision-analysis assistant. Lay out the options, their tradeoffs, risks, and reversibility, then give a clear recommendation with your reasoning stated explicitly.",
    category: "analysis",
    isBuiltIn: true,
  },
  {
    id: "general-assistant",
    name: "General Assistant",
    description: "Balanced, helpful default assistant",
    content:
      "You are a helpful, direct assistant. Answer concisely, show your reasoning when it matters, and ask for clarification only when truly necessary.",
    category: "general",
    isBuiltIn: true,
  },
  {
    id: "explainer",
    name: "Explain Like I'm New",
    description: "Explain a concept simply, building up complexity",
    content:
      "You are a patient teacher. Explain the topic starting from first principles, using concrete examples and analogies, then build up to the nuanced parts. Check understanding with a short recap at the end.",
    category: "general",
    isBuiltIn: true,
  },
];

const CATEGORY_ALIASES: Record<string, PromptCategory> = {
  general: "general",
  coding: "coding",
  code: "coding",
  writing: "writing",
  analysis: "analysis",
  custom: "custom",
};

/** Coerce a possibly-freeform stored category string into a known category. */
export function normalizePromptCategory(raw: string): PromptCategory {
  return CATEGORY_ALIASES[raw.trim().toLowerCase()] ?? "custom";
}

export function toLibraryPrompt(p: CustomPrompt): LibraryPrompt {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    content: p.content,
    category: normalizePromptCategory(String(p.category)),
    isBuiltIn: false,
  };
}

/** Case-insensitive name/description match — used by the search box. */
export function promptMatchesQuery(prompt: LibraryPrompt, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    prompt.name.toLowerCase().includes(q) ||
    prompt.description.toLowerCase().includes(q)
  );
}

export function filterPrompts(
  prompts: LibraryPrompt[],
  opts: { category: PromptCategory | "all"; query: string },
): LibraryPrompt[] {
  return prompts.filter(
    (p) =>
      (opts.category === "all" || p.category === opts.category) &&
      promptMatchesQuery(p, opts.query),
  );
}

const LS_KEY = "grok-app.customPrompts";

/** Browser / fallback store when Tauri is unavailable. */
export function loadCustomPromptsLocal(): CustomPrompt[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as CustomPrompt[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomPromptsLocal(list: CustomPrompt[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
