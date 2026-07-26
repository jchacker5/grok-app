import React, { useState, useEffect } from "react";
import type { DepGraph } from "../lib/types";
import * as api from "../lib/api";

export const PluginDependencyGraph: React.FC = () => {
  const [graph, setGraph] = useState<DepGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await api.getPluginDependencyGraph();
      setGraph(res || { nodes: [], edges: [] });
    } catch {
      setGraph({ nodes: [], edges: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGraph();
  }, []);

  return (
    <div className="plugin-dependency-graph" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", background: "var(--c-bg)", borderRadius: "8px", border: "1px solid var(--c-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>Plugin Dependency Topology Graph</h4>
        <button
          type="button"
          onClick={() => void fetchGraph()}
          style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)", color: "inherit", fontSize: "11px", cursor: "pointer" }}
        >
          Refresh Graph
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "32px", opacity: 0.6, fontSize: "12px" }}>Computing dependency topology...</div>
      ) : graph.nodes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", opacity: 0.6, fontSize: "12px" }}>No installed plugin dependencies detected</div>
      ) : (
        <div style={{ position: "relative", width: "100%", height: "260px", border: "1px solid var(--c-border)", borderRadius: "6px", background: "var(--c-bg-tertiary, rgba(0,0,0,0.2))", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="100%" height="100%" viewBox="0 0 600 240">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--c-accent, #3794ff)" />
              </marker>
            </defs>

            {/* Edges */}
            {graph.edges.map((edge, idx) => {
              const fromIdx = graph.nodes.findIndex((n) => n.id === edge.from);
              const toIdx = graph.nodes.findIndex((n) => n.id === edge.to);
              const x1 = 120 + (fromIdx % 3) * 180;
              const y1 = 60 + Math.floor(fromIdx / 3) * 100;
              const x2 = 120 + (toIdx % 3) * 180;
              const y2 = 60 + Math.floor(toIdx / 3) * 100;

              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--c-accent, #3794ff)"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node, idx) => {
              const x = 120 + (idx % 3) * 180;
              const y = 60 + Math.floor(idx / 3) * 100;

              return (
                <g key={node.id} transform={`translate(${x - 60}, ${y - 25})`}>
                  <rect
                    width="120"
                    height="50"
                    rx="8"
                    fill={node.installed ? "rgba(55, 148, 255, 0.2)" : "rgba(239, 68, 68, 0.2)"}
                    stroke={node.installed ? "var(--c-accent, #3794ff)" : "var(--c-danger, #ef4444)"}
                    strokeWidth="1.5"
                  />
                  <text x="60" y="22" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="600">
                    {node.label.slice(0, 14)}
                  </text>
                  <text x="60" y="38" textAnchor="middle" fill="currentColor" fontSize="9" opacity="0.7">
                    v{node.version || "1.0.0"} ({node.installed ? "Installed" : "Missing"})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
