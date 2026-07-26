import React, { useState, useEffect, useMemo } from "react";
import type { LibraryPrompt } from "../lib/types";
import * as api from "../lib/api";
import { GlassModal } from "./GlassModal";
import { IconSearch, IconPlus, IconTrash } from "./icons";

export const BUILT_IN_PROMPTS: LibraryPrompt[] = [
  {
    id: "code-review",
    name: "Code Reviewer",
    description: "Review code for bugs, performance optimizations, and security best practices.",
    category: "coding",
    content: "You are an expert code reviewer. Analyze the provided code snippet or repository changes for syntax issues, security vulnerabilities, edge cases, and performance bottlenecks. Suggest concise, clean improvements.",
    isBuiltIn: true,
  },
  {
    id: "refactoring-assistant",
    name: "Refactoring Specialist",
    description: "Clean up messy code, enforce modularity, and improve maintainability.",
    category: "coding",
    content: "You are a master software architect specializing in code refactoring. Reorganize and clean the provided code while preserving identical runtime behavior. Explain key design patterns applied.",
    isBuiltIn: true,
  },
  {
    id: "unit-test-writer",
    name: "Unit Test Generator",
    description: "Generate comprehensive unit test suites covering edge cases and boundary conditions.",
    category: "coding",
    content: "You are a test-driven development engineer. Generate robust unit tests for the provided code. Include mock setups, positive test paths, negative error states, and boundary boundary conditions.",
    isBuiltIn: true,
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    description: "Assist with engaging prose, storytelling, and copy editing.",
    category: "writing",
    content: "You are a seasoned creative writer and editor. Help refine tone, narrative flow, vocabulary, and clarity without losing original intent.",
    isBuiltIn: true,
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Analyze datasets, infer insights, and draft executive summaries.",
    category: "analysis",
    content: "You are a senior data analyst. Examine data structures, metrics, or tables, identify patterns, and synthesize clear actionable insights for stakeholders.",
    isBuiltIn: true,
  },
];

export interface PromptLibraryProps {
  open: boolean;
  onClose: () => void;
  onApplyPrompt: (prompt: LibraryPrompt) => void;
  currentSystemPrompt?: string;
}

export const PromptLibrary: React.FC<PromptLibraryProps> = ({
  open,
  onClose,
  onApplyPrompt,
  currentSystemPrompt = "",
}) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [customPrompts, setCustomPrompts] = useState<LibraryPrompt[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState<LibraryPrompt["category"]>("coding");

  const refreshCustom = async () => {
    try {
      const list = await api.loadCustomPrompts();
      setCustomPrompts(list || []);
    } catch {
      setCustomPrompts([]);
    }
  };

  useEffect(() => {
    if (open) {
      void refreshCustom();
    }
  }, [open]);

  const allPrompts = useMemo(() => {
    return [...BUILT_IN_PROMPTS, ...customPrompts];
  }, [customPrompts]);

  const filteredPrompts = useMemo(() => {
    return allPrompts.filter((p) => {
      const matchesCat = category === "all" || p.category === category;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [allPrompts, category, search]);

  const handleSaveCustom = async () => {
    if (!newName.trim() || !currentSystemPrompt.trim()) return;
    const prompt: LibraryPrompt = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim() || "User defined prompt",
      content: currentSystemPrompt.trim(),
      category: newCat,
      isBuiltIn: false,
    };
    try {
      const updated = await api.saveCustomPrompt(prompt);
      setCustomPrompts(updated);
    } catch {
      setCustomPrompts((prev) => [...prev, prompt]);
    }
    setSaveModalOpen(false);
    setNewName("");
    setNewDesc("");
  };

  const handleDeleteCustom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.deleteCustomPrompt(id);
      setCustomPrompts(updated);
    } catch {
      setCustomPrompts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  if (!open) return null;

  return (
    <>
      <GlassModal open={open} onClose={onClose} title="Prompt Library" size="lg">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0", minHeight: "400px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", opacity: 0.5, display: "flex", alignItems: "center" }}>
                <IconSearch size={14} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts..."
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 30px",
                  borderRadius: "6px",
                  background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
                  border: "1px solid var(--c-border)",
                  color: "inherit",
                  fontSize: "13px",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--c-accent, #3794ff)",
                color: "#fff",
                border: "none",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <IconPlus size={14} /> Save Current System Prompt
            </button>
          </div>

          <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--c-border)", paddingBottom: "8px" }}>
            {["all", "coding", "writing", "analysis", "custom"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  background: category === cat ? "var(--c-accent, #3794ff)" : "transparent",
                  color: category === cat ? "#fff" : "inherit",
                  fontSize: "12px",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px", maxHeight: "360px", overflowY: "auto" }}>
            {filteredPrompts.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0", opacity: 0.6 }}>
                No prompts match your criteria
              </div>
            ) : (
              filteredPrompts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))",
                    border: "1px solid var(--c-border)",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</span>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", textTransform: "uppercase" }}>
                        {p.category}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", opacity: 0.75, margin: "6px 0 0 0", lineHeight: "1.3" }}>
                      {p.description}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    {!p.isBuiltIn ? (
                      <button
                        type="button"
                        onClick={(e) => void handleDeleteCustom(p.id, e)}
                        style={{ background: "none", border: "none", color: "var(--c-danger, #ef4444)", cursor: "pointer", padding: "2px" }}
                        title="Delete prompt"
                      >
                        <IconTrash size={14} />
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPrompt(p);
                        onClose();
                      }}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        background: "var(--c-accent, #3794ff)",
                        color: "#fff",
                        border: "none",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Apply Prompt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </GlassModal>

      {/* Save Custom Prompt Modal */}
      <GlassModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save Custom Prompt">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Prompt Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Documentation Assistant"
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short description of this prompt"
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Category</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as any)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit" }}
            >
              <option value="coding">Coding</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
              <option value="general">General</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => setSaveModalOpen(false)} style={{ padding: "6px 14px", borderRadius: "6px", background: "transparent", border: "1px solid var(--c-border)", color: "inherit", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={handleSaveCustom} style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--c-accent, #3794ff)", color: "#fff", border: "none", cursor: "pointer" }}>
              Save Prompt
            </button>
          </div>
        </div>
      </GlassModal>
    </>
  );
};
