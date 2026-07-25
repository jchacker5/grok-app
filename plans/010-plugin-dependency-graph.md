## Summary
Display a visual dependency graph for installed plugins. Each plugin is a node; edges show "depends-on" relationships. Currently the plugin system supports `requires` in manifests but there's no visualization. Users need to see why a plugin can't be uninstalled (dependency conflict) and what depends on a given plugin.

## Current State

**`src/lib/grokPluginLoader.ts`** — `PluginManifest` has:
```tsx
export interface PluginManifest {
  name: string;
  version: string;
  requires?: { plugin?: Record<string, string>; grok?: string };
  // …
}
```

**`src/components/ExtensionsPanel.tsx`** — catalog browser, installed plugins list. No graph view.

**`src-tauri/src/commands.rs`** — `list_installed_plugins` returns `Vec<PluginManifest>` with `requires` field. No graph computation.

**Dependencies**: No graph layout library in frontend.

## Steps

1. **Pick approach**: Use `dagre` (small, ~5KB gzipped) for graph layout, render with SVG. Install via `npm install dagre` (or `@dagrejs/dagre`). No ReactFlow needed — this is a small directed graph (typical node count <20).

2. **`src-tauri/src/commands.rs`**: Add `get_plugin_dependency_graph() -> DepGraph`:
   ```rust
   pub struct DepGraph {
     pub nodes: Vec<DepNode>,  // { id: String, label: String, version: String }
     pub edges: Vec<DepEdge>,  // { from: String, to: String, relation: "requires" | "optional" }
   }
   ```
   Compute by iterating `requires.plugin` in each manifest. Also include reverse dependencies (what depends on this plugin).

3. **`src-tauri/src/lib.rs`**: Register command.

4. **`src/lib/api.ts`**: Add `getPluginDependencyGraph() -> Promise<DepGraph>`.

5. **`src/components/PluginDependencyGraph.tsx`** (new):
   - Use `dagre` to compute node positions from `DepGraph`.
   - Render as SVG inside a `<div className="plugin-graph">`.
   - Nodes: rounded rectangles with plugin name + version.
   - Edges: arrows with direction.
   - Color nodes by status: green = installed, red = missing dependency, gray = optional.
   - Click a node → open that plugin's details panel.
   - Tooltip on hover shows full dependency info.
   - "Zoom to fit" button.
   - Layout: top-to-bottom (dagre `rankdir: 'TB'`).

6. **`src/components/ExtensionsPanel.tsx`**: Add a "Dependency Graph" tab (or button in the header). Shows `<PluginDependencyGraph>` in a `GlassModal` or inline panel.

7. **`src/styles/components/PluginDependencyGraph.css`** (new): Style SVG:
   ```css
   .plugin-graph { width: 100%; height: 400px; overflow: auto; background: var(--c-bg-secondary); border-radius: 8px; }
   .plugin-graph__node { fill: var(--c-bg-tertiary); stroke: var(--c-border); stroke-width: 1.5; rx: 8; ry: 8; }
   .plugin-graph__node--missing { stroke: var(--c-error); }
   .plugin-graph__edge { stroke: var(--c-border); fill: none; marker-end: url(#arrowhead); }
   ```

8. **`src/i18n/messages.ts`**: Add `Extensions.DependencyGraph` keys: `title`, `zoom_fit`, `missing_dependency`, `no_dependencies`.

## Verification Gates

- [ ] Open dependency graph → nodes rendered with plugin names
- [ ] Edges show "depends on" relationships with arrows
- [ ] Missing dependencies shown in red
- [ ] Click node → opens plugin details
- [ ] Tooltip on hover shows version constraints
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** use ReactFlow or cytoscape.js — too heavy. `dagre` + raw SVG is sufficient.
- Do **not** support editing the graph (drag to reorder, add edges) — read-only visualization.
- If graph has >50 nodes, warn "Large graph — rendering may be slow" and render with simplified layout.
- If `dagre` fails to compute layout, fall back to a list view (flat dependency tree as `<ul>`).
- Do **not** include transitive dependencies beyond depth 3 (limit to immediate + one level deep to avoid visual noise).

## Dependencies
- Plan 001 — one-click install should be done first so users have plugins to graph.
