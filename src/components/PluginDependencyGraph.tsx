/**
 * Settings → Extensions → Plugins: read-only "component graph".
 *
 * Grok Build's plugin CLI has no `requires` manifest field — plugins are
 * external, CLI-managed packages, not an in-app dependency format. What the
 * CLI *does* expose is per-plugin provenance: which skills / MCP servers /
 * hooks a plugin bundles (`grok inspect` → `provides` counts, plus each
 * skill/server's own file path). This view turns that into a small directed
 * graph — Plugin → Skill / MCP server it provides — computed purely from
 * data the Extensions panel already fetches (no new Tauri command).
 *
 * See `buildPluginComponentGraph` in `@/lib/extensionsUi` for the pure
 * attribution logic (path-containment under each plugin's install dir).
 */

import { useMemo, useState } from "react";
import {
  buildPluginComponentGraph,
  pluginRowKey,
  type GraphComponentNode,
  type GraphPluginNode,
  type McpLike,
  type PluginLike,
  type SkillLike,
} from "@/lib/extensionsUi";
import { createT, type Locale } from "@/i18n";
import {
  IconListTree,
  IconTunnel,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@/components/icons";

export interface PluginDependencyGraphProps {
  locale: Locale;
  plugins: PluginLike[];
  skills: SkillLike[];
  servers: McpLike[];
  /** Clicking a plugin node/row opens its existing Details modal. */
  onOpenPlugin?: (plugin: PluginLike) => void;
}

const NODE_W = 200;
const NODE_H = 40;
const ROW_GAP = 14;
const ROW_STEP = NODE_H + ROW_GAP;
const COL_GAP = 140;
const PADDING = 16;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function PluginDependencyGraph({
  locale,
  plugins,
  skills,
  servers,
  onOpenPlugin,
}: PluginDependencyGraphProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const graph = useMemo(
    () => buildPluginComponentGraph(plugins, skills, servers),
    [plugins, skills, servers],
  );
  const [view, setView] = useState<"graph" | "list">(graph.isLarge ? "list" : "graph");
  const [zoom, setZoom] = useState(1);

  const byId = useMemo(() => {
    const map = new Map<string, GraphPluginNode | GraphComponentNode>();
    for (const p of graph.plugins) map.set(p.id, p);
    for (const c of graph.components) map.set(c.id, c);
    return map;
  }, [graph]);

  const skillNodes = graph.components.filter((c) => c.kind === "skill");
  const mcpNodes = graph.components.filter((c) => c.kind === "mcp");
  const rightNodes: GraphComponentNode[] = [...skillNodes, ...mcpNodes];

  const rowCount = Math.max(graph.plugins.length, rightNodes.length, 1);
  const width = NODE_W * 2 + COL_GAP + PADDING * 2;
  const height = rowCount * ROW_STEP - ROW_GAP + PADDING * 2;
  const leftX = PADDING;
  const rightX = PADDING + NODE_W + COL_GAP;

  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    graph.plugins.forEach((p, i) => {
      pos.set(p.id, { x: leftX, y: PADDING + i * ROW_STEP });
    });
    rightNodes.forEach((c, i) => {
      pos.set(c.id, { x: rightX, y: PADDING + i * ROW_STEP });
    });
    return pos;
  }, [graph.plugins, rightNodes, leftX, rightX]);

  const totalNodes = graph.plugins.length + graph.components.length;
  const hasAnyPlugins = graph.plugins.length > 0;

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));
  const zoomReset = () => setZoom(1);

  if (!hasAnyPlugins) {
    return <p className="ext-empty">{tr("ext.graph.empty")}</p>;
  }

  return (
    <div className="ext-graph" data-testid="plugin-dependency-graph">
      <p className="ext-graph__hint">{tr("ext.graph.hint")}</p>

      <div className="ext-graph__toolbar">
        <div className="ext-graph__legend">
          <span className="ext-graph__legend-item">
            <i className="ext-graph__swatch ext-graph__swatch--plugin" />
            {tr("ext.graph.legendPlugin")}
          </span>
          <span className="ext-graph__legend-item">
            <i className="ext-graph__swatch ext-graph__swatch--skill" />
            {tr("ext.graph.legendSkill")}
          </span>
          <span className="ext-graph__legend-item">
            <i className="ext-graph__swatch ext-graph__swatch--mcp" />
            {tr("ext.graph.legendMcp")}
          </span>
          <span className="ext-graph__legend-item">
            <i className="ext-graph__swatch ext-graph__swatch--conflict" />
            {tr("ext.graph.legendConflict")}
          </span>
        </div>
        <div className="ext-graph__view-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            className={"ext-plugin-filter" + (view === "graph" ? " is-active" : "")}
            onClick={() => setView("graph")}
          >
            <IconTunnel size={13} />
            <span>{tr("ext.graph.viewGraph")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={"ext-plugin-filter" + (view === "list" ? " is-active" : "")}
            onClick={() => setView("list")}
          >
            <IconListTree size={13} />
            <span>{tr("ext.graph.viewList")}</span>
          </button>
        </div>
      </div>

      {graph.isLarge && (
        <p className="ext-alert ext-alert--warn" role="status">
          {tr("ext.graph.large", { count: totalNodes })}
        </p>
      )}

      {view === "graph" && !graph.isLarge ? (
        <div className="ext-graph__canvas-wrap">
          <div className="ext-graph__zoom-controls">
            <button type="button" className="btn btn--ghost btn--sm" onClick={zoomOut} title={tr("ext.graph.zoomOut")}>
              <IconZoomOut size={14} />
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={zoomReset} title={tr("ext.graph.zoomReset")}>
              <IconZoomReset size={14} />
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={zoomIn} title={tr("ext.graph.zoomIn")}>
              <IconZoomIn size={14} />
            </button>
          </div>
          <div className="ext-graph__canvas">
            <svg
              className="ext-graph__svg"
              viewBox={`0 0 ${width} ${height}`}
              width={width * zoom}
              height={height * zoom}
              role="img"
              aria-label={tr("ext.graph.title")}
            >
              <defs>
                <marker
                  id="ext-graph-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" className="ext-graph__arrowhead" />
                </marker>
              </defs>

              {graph.edges.map((edge) => {
                const from = positions.get(edge.from);
                const to = positions.get(edge.to);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                const midX = (x1 + x2) / 2;
                const target = byId.get(edge.to) as GraphComponentNode | undefined;
                return (
                  <path
                    key={`${edge.from}->${edge.to}`}
                    d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                    className={
                      "ext-graph__edge" + (target?.conflict ? " ext-graph__edge--conflict" : "")
                    }
                    markerEnd="url(#ext-graph-arrow)"
                  />
                );
              })}

              {graph.plugins.map((p) => {
                const pos = positions.get(p.id);
                if (!pos) return null;
                return (
                  <g
                    key={p.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="ext-graph__node-group"
                    onClick={() => {
                      const src = plugins.find(
                        (raw) => `plugin:${pluginRowKey(raw)}` === p.id,
                      );
                      if (src) onOpenPlugin?.(src);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      const src = plugins.find(
                        (raw) => `plugin:${pluginRowKey(raw)}` === p.id,
                      );
                      if (src) onOpenPlugin?.(src);
                    }}
                    role={onOpenPlugin ? "button" : undefined}
                    aria-label={onOpenPlugin ? tr("ext.graph.openDetails") : undefined}
                    tabIndex={onOpenPlugin ? 0 : undefined}
                  >
                    <title>
                      {p.name}
                      {p.version ? ` v${p.version}` : ""}
                      {p.providesLine ? ` — ${p.providesLine}` : ""}
                    </title>
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={8}
                      ry={8}
                      className={
                        "ext-graph__node ext-graph__node--plugin" +
                        (p.enabled ? "" : " ext-graph__node--disabled")
                      }
                    />
                    <text x={10} y={16} className="ext-graph__node-title">
                      {truncateLabel(p.name, 22)}
                    </text>
                    <text x={10} y={31} className="ext-graph__node-sub">
                      {p.version ? `v${p.version}` : ""}
                      {p.attributedCount === 0 ? ` · ${tr("ext.graph.noComponents")}` : ""}
                    </text>
                  </g>
                );
              })}

              {rightNodes.map((c) => {
                const pos = positions.get(c.id);
                if (!pos) return null;
                return (
                  <g key={c.id} transform={`translate(${pos.x}, ${pos.y})`}>
                    <title>
                      {c.name} ({c.kind}){c.meta ? ` — ${c.meta}` : ""}
                      {c.conflict ? ` — ${tr("ext.graph.conflictNote")}` : ""}
                    </title>
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={8}
                      ry={8}
                      className={
                        `ext-graph__node ext-graph__node--${c.kind}` +
                        (c.conflict ? " ext-graph__node--conflict" : "")
                      }
                    />
                    <text x={10} y={16} className="ext-graph__node-title">
                      {truncateLabel(c.name, 22)}
                    </text>
                    <text x={10} y={31} className="ext-graph__node-sub">
                      {c.meta ? truncateLabel(c.meta, 30) : c.kind}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <ul className="ext-graph__list">
          {graph.plugins.map((p) => {
            const owned = graph.components.filter((c) => c.ownerPluginId === p.id);
            const src = plugins.find((raw) => `plugin:${pluginRowKey(raw)}` === p.id);
            return (
              <li key={p.id} className="ext-graph__list-item">
                <button
                  type="button"
                  className="ext-graph__list-plugin"
                  disabled={!onOpenPlugin || !src}
                  onClick={() => src && onOpenPlugin?.(src)}
                >
                  {p.name}
                  {p.version ? ` v${p.version}` : ""}
                </button>
                {owned.length === 0 ? (
                  <p className="ext-empty ext-graph__list-empty">{tr("ext.graph.noComponents")}</p>
                ) : (
                  <ul className="ext-graph__list-components">
                    {owned.map((c) => (
                      <li
                        key={c.id}
                        className={c.conflict ? "ext-graph__list-conflict" : undefined}
                      >
                        <span className={`ext-badge ext-badge--${c.kind === "skill" ? "plugin" : "muted"}`}>
                          {c.kind === "skill" ? tr("ext.graph.legendSkill") : tr("ext.graph.legendMcp")}
                        </span>
                        {c.name}
                        {c.conflict ? ` — ${tr("ext.graph.conflictNote")}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(graph.unattributedSkills > 0 || graph.unattributedMcp > 0) && (
        <div className="ext-graph__footnotes">
          {graph.unattributedSkills > 0 && (
            <p className="ext-section-note">
              {tr("ext.graph.unattributedSkills", { count: graph.unattributedSkills })}
            </p>
          )}
          {graph.unattributedMcp > 0 && (
            <p className="ext-section-note">
              {tr("ext.graph.unattributedMcp", { count: graph.unattributedMcp })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function truncateLabel(label: string, max: number): string {
  const s = (label ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
