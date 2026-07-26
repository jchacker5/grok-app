import React from "react";
import type { GoalConfig } from "../lib/types";
import { IconTarget, IconClose, IconCheck } from "./icons";
import "../styles/components/GoalIndicator.css";

export interface GoalIndicatorProps {
  goalConfig: GoalConfig | null;
  onOpen: () => void;
  onCancel: () => void;
}

export const GoalIndicator: React.FC<GoalIndicatorProps> = ({
  goalConfig,
  onOpen,
  onCancel,
}) => {
  if (!goalConfig || !goalConfig.goal) {
    return null;
  }

  const completed = goalConfig.completedSubgoals?.length || 0;
  const total = goalConfig.subgoals?.length || 0;
  const isComplete = total > 0 && completed >= total;

  const truncatedGoal =
    goalConfig.goal.length > 40
      ? `${goalConfig.goal.slice(0, 40)}…`
      : goalConfig.goal;

  return (
    <div
      className={`goal-indicator ${isComplete ? "goal-indicator--complete" : ""}`}
      onClick={onOpen}
      title={goalConfig.goal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="goal-indicator__icon">
        {isComplete ? <IconCheck size={14} /> : <IconTarget size={14} />}
      </span>

      <span className="goal-indicator__label">
        <span className="goal-indicator__title">{truncatedGoal}</span>
        {total > 0 && (
          <span className="goal-indicator__progress">
            [{completed}/{total}]
          </span>
        )}
      </span>

      <button
        type="button"
        className="goal-indicator__cancel"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        title="Cancel Goal Mode"
        aria-label="Cancel Goal Mode"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
};
