# Project Overview: Deer Isle Endgame Quest

This project maintains a comprehensive loot flow diagram for the **Deer Isle 6.0 Endgame Quest** in
DayZ. It uses **Mermaid.js** for diagramming and **GitHub Actions** for automated generation of
high-resolution images.

An interactive tracker is also provided to help players plan and manage their inventory throughout
the quest.

## Key Files and Directories

- **`deer-isle-endgame-loot-flow.mmd`**: The primary source file containing the Mermaid diagram
  definition. This is where all structural and content changes to the flow should be made.
- **`docs/generated/`**:
  - `deer-isle-endgame-loot-flow.png` and `deer-isle-endgame-loot-flow.svg`: The auto-generated
    high-resolution output images.
- **`data/loot-flow.json`**: Canonical structured graph data consumed by the interactive tracker.
  - Run `./build.ps1 check-data` to check for consistency between the JSON data and the Mermaid
    diagram.
- **`site/`**: Vite + TypeScript GitHub Pages application.
- **`build.ps1`**: A task automation script for building diagrams and other common repo tasks.
  - `scripts/PSTaskFramework/`: Helper scripts for task automation. Taken from
    <https://github.com/mrfootoyou/PSTaskFramework>.

## Prerequisites

- **PowerShell 7.4 or later** — required by `build.ps1`. See <https://aka.ms/install-powershell>.
- **Mermaid CLI ≥ 11.12.0** _or_ **Docker** — required to build diagrams locally. Run
  `./build.ps1 bootstrap` to install or verify these tools automatically.
- **Node.js LTS (via NVS)** — required for building the site locally. Run `./build.ps1 bootstrap` to
  install or verify the required Node.js version automatically.

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
./build.ps1 build-diagram
```

Add `-- -UseDocker` if you bootstrapped using Docker.

## Working with the Interactive Tracker

From the repository root, install dependencies and start the local site:

```powershell
Push-Location site
npm ci
npm run dev
Pop-Location
```

Use `./build.ps1 build-diagram` to create the production bundle. The Vite base path defaults to
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
./build.ps1 test-site
```

Run the human-readable domain diagnostic when debugging state behavior:

```powershell
pushd site
npm run verify:domain
popd
```

Verify that structured graph data still matches the Mermaid source:

```powershell
./build.ps1 check-data
```

## Development Conventions

- **Formatting**: Prettier is used for all text files. VS Code is configured to format on save.
- **Pull Requests**: Images are automatically updated and committed by the CI bot when a PR is
  opened or updated.
