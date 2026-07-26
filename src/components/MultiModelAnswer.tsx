import React from "react";
import { MarkdownBody } from "./MarkdownBody";

export interface ModelAnswer {
  modelId: string;
  content: string;
  error?: string | null;
  loading?: boolean;
}

export interface MultiModelAnswerProps {
  answers: ModelAnswer[];
}

export const MultiModelAnswer: React.FC<MultiModelAnswerProps> = ({ answers }) => {
  if (!answers || answers.length === 0) return null;

  return (
    <div
      className="multi-model-answers"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(answers.length, 3)}, 1fr)`,
        gap: "12px",
        margin: "12px 0",
        width: "100%",
      }}
    >
      {answers.map((ans) => (
        <div
          key={ans.modelId}
          className="multi-model-answer"
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--c-border)",
            borderRadius: "8px",
            padding: "12px",
            background: "var(--c-bg-tertiary, rgba(0,0,0,0.15))",
            minWidth: "240px",
          }}
        >
          <div
            className="answer-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 600,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
              paddingBottom: "4px",
              borderBottom: "1px solid var(--c-border)",
              color: "var(--c-accent, #3794ff)",
            }}
          >
            <span>{ans.modelId}</span>
            {ans.loading && <span style={{ fontSize: "10px", opacity: 0.7 }}>Streaming...</span>}
          </div>

          <div className="answer-body" style={{ flex: 1, fontSize: "13px", lineHeight: "1.5" }}>
            {ans.error ? (
              <div style={{ color: "var(--c-danger, #ef4444)", fontSize: "12px" }}>
                Error: {ans.error}
              </div>
            ) : ans.content ? (
              <MarkdownBody>{ans.content}</MarkdownBody>
            ) : (
              <div style={{ opacity: 0.5, fontStyle: "italic" }}>Waiting for response...</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
