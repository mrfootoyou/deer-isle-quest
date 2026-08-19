# Project Overview: Deer Isle Endgame Quest

This project maintains a comprehensive loot flow diagram for the **Deer Isle 6.0 Endgame Quest** in
DayZ. It uses **Mermaid.js** for diagramming and **GitHub Actions** for automated generation of
high-resolution images.

## Key Files and Directories

- **`deer-isle-endgame-loot-flow.mmd`**: The primary source file containing the Mermaid diagram
  definition. This is where all structural and content changes to the flow should be made.
  - node classes represent semantic types (quest_loot, optional_loot, endgame_loot, place, action,
    terminal)
  - edge semantics:
    - `-->` : main quest
    - `--x` : item destroyed when used/combined
    - `==>` / `===` : travel/transport
    - `-.->` : optional quest
  - subgraphs represent locations (Northeast Isles, Swamp, Alcatraz, Crater Island, KMUC, Temple
    Island, The Crypt, Aircraft Carrier, KMUC Endgame), or crafting trees.
- **`docs/generated/`**:
  - `deer-isle-endgame-loot-flow.png` and `deer-isle-endgame-loot-flow.svg`: The auto-generated
    high-resolution output images.
  - `mermaid-config.json`: Configuration for Mermaid rendering, specifying the `Recursive` font.
  - `puppeteer-config.json`: Configuration for the Puppeteer instance used by Mermaid CLI.
  - `svgo-config.json`: Configuration for SVGO, used to optimize the generated SVG images.
  - `README.md`: Warning to not edit generated images directly.
- **`.github/workflows/autofix.yml`**: An automated workflow that detects changes to `.mmd` files on
  any pull-request change, generates updated PNG and SVG images, and commits them back to the
  repository using the autofix-ci action. It includes cleanup of orphaned images. It can also be
  triggered manually via `workflow_dispatch`.
- **`build.ps1`**: A task automation script for building diagrams and other common repo tasks.
  - `scripts/*`: Helper scripts for task automation. Taken from
    <https://github.com/mrfootoyou/PSTaskFramework>.
- **`data/loot-flow.json`**: Canonical structured graph data consumed by the interactive tracker.
  Keep it synchronized with the Mermaid source by running `npm run check:integrity` from the repo
  root. Its `requires` metadata records alternative-route nodes that cannot be inferred from edge
  syntax alone. Item nodes may define a `quantity`, and consume/produce edges may define a
  `quantity` for recipes such as Tan Hides consuming two Bear Pelts.
- **`site/`**: Vite + TypeScript GitHub Pages application. Its `src/domain/`, `src/render/`, and
  `src/state/` folders contain the quest calculations, Mermaid adapter, inventory persistence, and
  versioned share-inventory APIs. `src/domain/domain.test.ts` contains the Vitest domain suite.
- **`.github/workflows/test.yml`**: Runs the graph integrity check and site Vitest tests on pull
  requests and relevant pushes.
- **`.github/workflows/deploy-site.yml`**: Builds and deploys `site/dist` to GitHub Pages.
- **`.prettierrc.yml`**: Prettier configuration ensuring consistent formatting across Markdown,
  YAML, and JSON files (`printWidth: 100`, `proseWrap: always`).

## Prerequisites

- **PowerShell 7.4 or later** — required by `build.ps1`. See <https://aka.ms/install-powershell>.
- **Mermaid CLI ≥ 11.12.0** _or_ **Docker** — required to build diagrams locally. Run
  `./build.ps1 bootstrap` to install or verify these tools automatically.

## Working with Diagrams

### Editing

1. Modify `deer-isle-endgame-loot-flow.mmd`.
2. Follow the **Tactical Style** established in the file (high-contrast, semantic shapes, and
   Unicode icons).
3. Ensure the `Recursive` font is installed locally for accurate previews (or use the Docker-based
   Mermaid CLI which includes the font).

### First-Time Setup

Run the bootstrap task to install or verify required tools:

```powershell
./build.ps1 bootstrap
```

Add `-- -UseDocker` to force the Docker-based Mermaid CLI (e.g. on CI or if a local install is
unavailable).

### Generation (Manual)

While images are auto-generated on GitHub, you can generate them locally using the Mermaid CLI:

```powershell
./build.ps1 build -- -UseDocker
```

You may omit the `-- -UseDocker` flag if you have Mermaid CLI ≥ 11.12.0 and the `Recursive` font
installed locally.

## Working with the Interactive Tracker

From the repository root, install dependencies and start the local site:

```powershell
Push-Location site
npm ci
npm run dev
Pop-Location
```

Use `npm run build` in `site/` to create the production bundle. The Vite base path defaults to
`/deer-isle-quest/` for the project GitHub Pages site; use `VITE_BASE=/ npm run build` when hosting
the bundle at a domain root.

The tracker stores an inventory of item counts rather than only boolean ticks. Quantity-bearing
items display their current count, such as `Bear Pelts 1 of 2`. Plain clicks toggle quantity-one
items or increment plural items; Shift/Ctrl-click, right-click, or the corresponding keyboard
shortcut decrements. Crafting action nodes consume the quantities declared on `consume` edges and
create their declared outputs.

Share URLs use a versioned base64url JSON inventory payload with the `#i=` prefix. Invalid or
unknown inventory payloads are ignored safely.

### Site Tests and Integrity

Run the formal Vitest suite from `site/`:

```powershell
npm test -- --run
```

Run the human-readable domain diagnostic when debugging state behavior:

```powershell
npm run verify:domain
```

From the repository root, verify that structured graph data still matches the Mermaid source:

```powershell
npm run check:integrity
```

## Development Conventions

- **Formatting**: Prettier is used for all text files. VS Code is configured to format on save.
- **Pull Requests**: Images are automatically updated and committed by the CI bot when a PR is
  opened or updated.
