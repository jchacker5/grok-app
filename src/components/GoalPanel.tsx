import React, { useState, useEffect } from "react";
import type { GoalConfig } from "../lib/types";
import { GlassModal } from "./GlassModal";
import { IconPlus, IconTrash, IconCheckSquare, IconCircleDashed } from "./icons";

export interface GoalPanelProps {
  open: boolean;
  goalConfig: GoalConfig | null;
  onSave: (config: GoalConfig) => void;
  onClose: () => void;
}

export const GoalPanel: React.FC<GoalPanelProps> = ({
  open,
  goalConfig,
  onSave,
  onClose,
}) => {
  const [goal, setGoal] = useState("");
  const [subgoals, setSubgoals] = useState<string[]>([]);
  const [completedSubgoals, setCompletedSubgoals] = useState<number[]>([]);
  const [context, setContext] = useState("");
  const [newSubgoalText, setNewSubgoalText] = useState("");

  useEffect(() => {
    if (goalConfig) {
      setGoal(goalConfig.goal || "");
      setSubgoals(goalConfig.subgoals || []);
      setCompletedSubgoals(goalConfig.completedSubgoals || []);
      setContext(goalConfig.context || "");
    } else {
      setGoal("");
      setSubgoals([]);
      setCompletedSubgoals([]);
      setContext("");
    }
  }, [goalConfig, open]);

  if (!open) return null;

  const toggleSubgoal = (index: number) => {
    if (completedSubgoals.includes(index)) {
      setCompletedSubgoals(completedSubgoals.filter((i) => i !== index));
    } else {
      setCompletedSubgoals([...completedSubgoals, index]);
    }
  };

  const addSubgoal = () => {
    if (!newSubgoalText.trim()) return;
    setSubgoals([...subgoals, newSubgoalText.trim()]);
    setNewSubgoalText("");
  };

  const removeSubgoal = (index: number) => {
    const nextSubgoals = subgoals.filter((_, i) => i !== index);
    const nextCompleted = completedSubgoals
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));
    setSubgoals(nextSubgoals);
    setCompletedSubgoals(nextCompleted);
  };

  const handleSave = () => {
    onSave({
      goal: goal.trim(),
      subgoals,
      completedSubgoals,
      context: context.trim(),
    });
    onClose();
  };

  return (
    <GlassModal open={open} onClose={onClose} title="Goal Mode Configuration">
      <div className="goal-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
        <div className="goal-field">
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Primary Goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What is your main objective?"
            rows={2}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
              border: "1px solid var(--c-border)",
              color: "inherit",
              fontFamily: "inherit",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
        </div>

        <div className="subgoals-section">
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Sub-goals</label>
          <div className="subgoals-list" style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
            {subgoals.map((sub, idx) => {
              const isChecked = completedSubgoals.includes(idx);
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSubgoal(idx)}
                    style={{ background: "none", border: "none", color: isChecked ? "var(--c-success, #22c55e)" : "inherit", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {isChecked ? <IconCheckSquare size={16} /> : <IconCircleDashed size={16} />}
                  </button>
                  <span style={{ flex: 1, fontSize: "13px", textDecoration: isChecked ? "line-through" : "none", opacity: isChecked ? 0.7 : 1 }}>
                    {sub}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubgoal(idx)}
                    style={{ background: "none", border: "none", color: "var(--c-danger, #ef4444)", cursor: "pointer", display: "flex", alignItems: "center", opacity: 0.6 }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={newSubgoalText}
              onChange={(e) => setNewSubgoalText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubgoal())}
              placeholder="Add a sub-goal step..."
              style={{
                flex: 1,
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
                border: "1px solid var(--c-border)",
                color: "inherit",
                fontSize: "13px",
              }}
            />
            <button
              type="button"
              onClick={addSubgoal}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--c-accent, #3794ff)",
                color: "#fff",
                border: "none",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconPlus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="context-field">
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Additional Context / Constraints</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any background information or guidelines..."
            rows={2}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))",
              border: "1px solid var(--c-border)",
              color: "inherit",
              fontFamily: "inherit",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              background: "transparent",
              border: "1px solid var(--c-border)",
              color: "inherit",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              background: "var(--c-accent, #3794ff)",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Save Goal
          </button>
        </div>
      </div>
    </GlassModal>
  );
};
