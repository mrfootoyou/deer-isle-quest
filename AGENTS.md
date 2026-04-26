# Project Overview: Deer Isle Endgame Quest

This project maintains a comprehensive loot flow diagram for the **Deer Isle 6.0 Endgame Quest** in
DayZ. It uses **Mermaid.js** for diagramming and **GitHub Actions** for automated generation of
high-resolution images.

## Key Files and Directories

- **`deer-isle-endgame-loot-flow.mmd`**: The primary source file containing the Mermaid diagram
  definition. This is where all structural and content changes to the flow should be made.
- **`docs/generated/`**:
  - `deer-isle-endgame-loot-flow.png` and `deer-isle-endgame-loot-flow.svg`: The auto-generated
    high-resolution output images.
  - `mermaid-config.json`: Configuration for Mermaid rendering, specifying the `Recursive` font.
  - `puppeteer-config.json`: Configuration for the Puppeteer instance used by Mermaid CLI.
  - `README.md`: Warning to not edit generated images directly.
- **`.github/workflows/generate-diagrams.yml`**: An automated workflow that detects changes to
  `.mmd` files on any push to a non-`main` branch, generates updated PNG and SVG images, and commits
  them back to the repository. It includes parallel processing and cleanup of orphaned images. It
  can also be triggered manually via `workflow_dispatch` with a custom comma-separated list of
  diagram glob patterns.
- **`build.ps1`**: A task automation script for building diagrams and other common repo tasks.
  - `scripts/*`: Helper scripts for task automation. Taken from
    https://github.com/mrfootoyou/PSTaskFramework.
- **`.prettierrc.yml`**: Prettier configuration ensuring consistent formatting across Markdown,
  YAML, and JSON files (`printWidth: 100`, `proseWrap: always`).

## Prerequisites

- **PowerShell 7.4 or later** — required by `build.ps1`. See https://aka.ms/install-powershell.
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

## Development Conventions

- **Formatting**: Prettier is used for all text files. VS Code is configured to format on save.
- **Pull Requests**: Images are automatically updated and committed by the CI bot when a PR is
  opened or updated.
