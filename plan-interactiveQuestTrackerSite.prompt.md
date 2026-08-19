# Plan: Interactive Deer Isle Quest Tracker Site

## Decisions locked in (from user)

- Static site, GitHub Pages hosting.
- `data/loot-flow.json` hand-authored in parallel to `.mmd`; CI integrity-check script compares
  node/class/edge sets between the two and fails on drift. `.mmd` remains the only source for
  generated images (unchanged build.ps1 workflow).
- Tooling: Vite + TypeScript in new `site/` folder (first npm usage in repo).
- Deployment: new GitHub Actions workflow, `actions/deploy-pages`, separate from `autofix.yml`.
- No automated tests for the graph algorithms (manual verification only).
- Progress: localStorage + shareable URL-hash encoding. Dark/light theme (dark default). All
  quest_loot/endgame_loot/optional_loot nodes tickable; optional items shown but excluded from
  required-path priority ranking.

## Graph semantics (derived from deer-isle-endgame-loot-flow.mmd)

- Node classes: `quest_loot`, `endgame_loot`, `optional_loot` (tickable); `place`, `action`,
  `terminal` (not tickable, state auto-derived).
- Edge types: `-->` requirement, `--x` consumed-on-use requirement, `==>`/`===` travel/transport
  (also a requirement step), `-.->` optional (excluded from requirement propagation and from
  critical-path/distance calc).
- Known data-authoring nuance: two edges target subgraph IDs directly
  (`temple_swamp_teleport ==> swamp_area`, and `swamp_temple_teleport ==> temple_main` targets a
  real node so that's fine) — when authoring JSON, map subgraph-targeted edges to the subgraph's
  representative entry node (e.g. `swamp_area` → `swamp_temple_teleport`). Flagged to user as an
  assumption.
- Graph has at least one cycle (temple ⇄ swamp teleports). Derived-state resolution must use an
  iterative fixed-point (relax repeatedly until stable) rather than plain recursive DFS, so cycles
  don't cause stack blowups or false negatives.

## Phases

### Phase 0 — Canonical data + integrity check

1. Design JSON schema for `data/loot-flow.json`: `nodes[]` (id, label, icon/text, shape, class,
   subgraphId), `subgraphs[]` (id, title, direction), `edges[]` (from, to, label?, type: main |
   consume | travel | optional).
2. Hand-transcribe the full existing graph (~35 nodes / ~40 edges) from
   deer-isle-endgame-loot-flow.mmd into `data/loot-flow.json`.
3. Write `scripts/check-graph-integrity.mjs` (Node, no deps or minimal): regex-parses the `.mmd` for
   node ids + `classDef`/`class` assignments + edge tuples, loads `data/loot-flow.json`, and diffs
   node-id sets, class assignments, and edge (from,to,type) sets. Non-zero exit + printed diff on
   mismatch.
4. Add `npm run check:integrity` in `site/package.json` (or a root script) and a CI step (new
   workflow `graph-integrity.yml`, triggered on PR touching `*.mmd` or `data/**`).

### Phase 1 — Site scaffold _(depends on Phase 0 JSON shape being stable)_

1. `site/` — Vite + TS scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
   `src/main.ts`, `src/styles.css`.
2. Copy `data/loot-flow.json` into `site/public/data/loot-flow.json` via a small prebuild script
   (keep root file canonical; don't duplicate by hand).
3. Self-host `Recursive` font via `@fontsource-variable/recursive` (avoids third-party CDN requests)
   instead of a Google Fonts `<link>`.

### Phase 2 — Domain logic (pure TS, `site/src/domain/`)

1. `graph.ts` — build adjacency from JSON; `resolveState(ticked: Set<id>)` → Map<id, 'done' |
   'available' | 'locked'> via iterative fixed-point over requirement edges (main/consume/travel;
   optional edges excluded).
2. `distance.ts` — BFS from `endgame` over the **reversed** requirement-edge graph to get
   distance-to-ENDGAME per node (used for frontier ranking).
3. `critical-path.ts` — BFS/shortest path from `spawn` to `endgame` over requirement edges only;
   returns ordered node/edge id list for highlighting.
4. `frontier.ts` — given resolved state + distances: tickable, not-done, state==='available' nodes
   sorted ascending by distance; partitions optional_loot into a separate lower-priority group per
   the "excluded from required-path priority" decision.

### Phase 3 — Rendering (`site/src/render/`)

1. `mermaid-generator.ts` — serializes the JSON graph back into Mermaid flowchart text (subgraphs,
   classDefs matching the `.mmd` palette, edge arrows per type), plus per-render dynamic
   `_done`/`_available`/`_locked` class suffixes and `linkStyle` overrides for critical-path edges.
2. `diagram.ts` — uses the `mermaid` npm package (`elk` layout, `neo` look, `forest` theme, reusing
   config values from docs/generated/mermaid-config.json) to render into a container `<div>`; after
   render, attach click listeners on tickable node `<g>` elements (matched by id) to toggle progress
   and re-render.

### Phase 4 — State, persistence, sharing (`site/src/state/`)

1. `progress.ts` — localStorage key `deer-isle-progress` (ticked node-id array + theme pref).
2. `share.ts` — encode ticked set as a base64url bitset (bit order = sorted node-id array from the
   JSON) into `location.hash` (e.g. `#p=...`); decode on load with strict validation (ignore/clip
   malformed or out-of-range hashes rather than throwing); debounce hash updates on toggle.

### Phase 5 — UI

1. Sidebar panel: "Next Actions" (frontier list, ranked, with distance-to-ENDGAME shown), optional
   items shown separately/deprioritized, "Critical Path" highlight toggle, reset-progress button,
   theme toggle, "Copy share link" button.
2. Legend reusing the `.mmd` classDef colors (endgame/quest/optional/place/action/terminal).
3. Dark/light CSS variable themes; dark is default (matches `forest` theme), toggle persisted.

### Phase 6 — Deployment

1. New workflow `.github/workflows/deploy-site.yml`: triggers on push to `main` (paths `site/**`,
   `data/**`) + `workflow_dispatch`; permissions `pages: write`, `id-token: write`; steps: checkout
   → setup-node → `npm ci` in `site/` → prebuild copy script → `npm run build` →
   `actions/upload-pages-artifact` (`site/dist`) → `actions/deploy-pages`.
2. Note for user: one-time manual step — set repo Settings → Pages → Source = "GitHub Actions"
   (cannot be automated from code).
3. Optionally add a `site` task to `build.ps1` for local dev convenience (`npm run dev` wrapper) —
   nice-to-have, not required.

### Phase 7 — Docs

1. Update AGENTS.md and README.md to describe `data/loot-flow.json`, `site/`, and the integrity
   check, consistent with existing doc style.

## Relevant files

- `deer-isle-endgame-loot-flow.mmd` — read-only reference for transcription; unchanged.
- `data/loot-flow.json` — NEW canonical structured graph data.
- `scripts/check-graph-integrity.mjs` — NEW drift-check script.
- `.github/workflows/graph-integrity.yml` — NEW CI check.
- `.github/workflows/deploy-site.yml` — NEW Pages deploy workflow.
- `site/**` — NEW Vite+TS site (scaffold, domain logic, rendering, state, UI, styles).
- `docs/generated/mermaid-config.json` — reused as reference for renderer config values.
- `AGENTS.md`, `README.md` — doc updates.

## Verification

1. `node scripts/check-graph-integrity.mjs` passes after JSON authored from current `.mmd`.
2. Manually corrupt one edge/class in JSON, confirm the integrity script fails with a clear diff.
3. `cd site && npm run build` succeeds; `npm run preview` shows the diagram, ticking a node moves it
   to done, unlocks dependents, updates frontier list ordering by distance-to-ENDGAME.
4. Manually verify critical-path highlight matches the intuitive shortest path spawn→ENDGAME.
5. Reload page → progress persists (localStorage). Copy share link, open in new/incognito window →
   progress matches.
6. Toggle theme, reload → persists.
7. After deploy workflow runs (post-merge), confirm Pages URL serves the site.

## Open assumption to confirm with user

- Subgraph-targeted edge (`temple_swamp_teleport ==> swamp_area`) will be modeled in JSON as
  targeting `swamp_temple_teleport` (the subgraph's practical entry node). Purely a data-modeling
  choice, doesn't change visuals.
