import './styles.css';
import type { LootFlowGraph } from './types';
import { buildRequirementGraph } from './domain/graph';
import { distanceToEndgame } from './domain/distance';
import { computeFrontier, type FrontierEntry } from './domain/frontier';
import { adjustInventory, craftAction } from './domain/inventory';
import { resolveState } from './domain/state';
import { renderDiagram } from './render/diagram';
import { clearProgress, loadProgress, saveProgress, type ThemePreference } from './state/progress';
import { decodeInventoryHash, scheduleInventoryHash } from './state/share';

function setTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme;
}

function actionList(entries: FrontierEntry[], emptyMessage: string): string {
  if (entries.length === 0) return `<p class="empty-state">${emptyMessage}</p>`;
  return entries
    .map(
      (entry) => `
        <button class="frontier-item" data-node-id="${entry.id}" type="button">
          <span class="frontier-label">${entry.label}${entry.target > 1 ? ` ${entry.current} of ${entry.target}` : ''}</span>
          <span class="frontier-distance">${entry.distanceToEndgame === null ? '—' : `${entry.distanceToEndgame} hops`}</span>
        </button>`,
    )
    .join('');
}

function copyShareLink(button: HTMLButtonElement): void {
  const originalLabel = button.textContent;
  const write = navigator.clipboard?.writeText(location.href);
  if (!write) {
    button.textContent = 'Copy unavailable';
    window.setTimeout(() => (button.textContent = originalLabel), 1400);
    return;
  }
  write
    .then(() => {
      button.textContent = 'Link copied';
      window.setTimeout(() => (button.textContent = originalLabel), 1400);
    })
    .catch(() => {
      button.textContent = 'Copy failed';
      window.setTimeout(() => (button.textContent = originalLabel), 1400);
    });
}

async function main() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  const response = await fetch(`${import.meta.env.BASE_URL}data/loot-flow.json`);
  if (!response.ok) throw new Error(`Unable to load quest data (${response.status})`);
  const graph: LootFlowGraph = await response.json();
  const requirementGraph = buildRequirementGraph(graph);
  const distances = distanceToEndgame(requirementGraph);
  const validCounts = new Map(
    graph.nodes.filter((node) => node.tickable).map((node) => [node.id, node.quantity ?? 1]),
  );
  const saved = loadProgress(validCounts);
  const shared = decodeInventoryHash(location.hash, validCounts);
  let inventory = shared ?? saved.inventory;
  let theme = saved.theme;
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  setTheme(theme);
  app.innerHTML = `
    <header class="app-header">
      <div>
        <p class="eyebrow">DEER ISLE 6.0 / ENDGAME QUEST</p>
        <h1>Loot flow tracker</h1>
        <p class="lede">Mark what you have secured. The map will surface the next useful move.</p>
      </div>
      <div class="header-actions">
        <button class="button button-quiet header-control" id="theme-toggle" type="button"></button>
        <button class="button button-quiet header-control" id="share-button" type="button" aria-label="Copy share link" title="Copy share link">↗ <span>Share</span></button>
      </div>
    </header>
    <main class="tracker-layout">
      <aside class="sidebar" aria-label="Quest controls and next actions">
        <section class="panel progress-panel">
          <div class="panel-heading"><span>Progress</span><strong id="progress-count"></strong></div>
          <div class="progress-track"><span id="progress-bar"></span></div>
          <button class="button button-danger" id="reset-button" type="button">Reset progress</button>
        </section>
        <section class="panel actions-panel">
          <div class="panel-heading"><span>Next actions</span><span class="panel-kicker">NEAREST TO ENDGAME</span></div>
          <div id="required-actions"></div>
          <div class="subsection-heading">Optional finds</div>
          <div id="optional-actions"></div>
        </section>
        <section class="legend" aria-label="Map legend">
          <div class="legend-title">Map legend</div>
          <span><i class="swatch swatch-quest"></i>Quest loot</span>
          <span><i class="swatch swatch-endgame"></i>Endgame loot</span>
          <span><i class="swatch swatch-optional"></i>Optional</span>
          <span><i class="swatch swatch-place"></i>Location / gate</span>
        </section>
      </aside>
      <section class="diagram-panel" aria-label="Interactive loot flow diagram">
        <div class="diagram-toolbar">
          <span>Quest map</span>
          <div class="diagram-tools">
            <button class="zoom-button" id="zoom-out" type="button" aria-label="Zoom out">−</button>
            <span id="zoom-level">100%</span>
            <button class="zoom-button" id="zoom-in" type="button" aria-label="Zoom in">+</button>
            <button class="zoom-button zoom-reset" id="zoom-reset" type="button">Reset</button>
            <span id="diagram-status">Loading map…</span>
          </div>
        </div>
        <div class="diagram-container" id="diagram"></div>
      </section>
    </main>
  `;

  const diagram = document.querySelector<HTMLDivElement>('#diagram')!;
  const requiredActions = document.querySelector<HTMLDivElement>('#required-actions')!;
  const optionalActions = document.querySelector<HTMLDivElement>('#optional-actions')!;
  const progressCount = document.querySelector<HTMLElement>('#progress-count')!;
  const progressBar = document.querySelector<HTMLSpanElement>('#progress-bar')!;
  const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
  const shareButton = document.querySelector<HTMLButtonElement>('#share-button')!;
  const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!;
  const zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!;
  const zoomReset = document.querySelector<HTMLButtonElement>('#zoom-reset')!;
  const zoomLevel = document.querySelector<HTMLElement>('#zoom-level')!;
  const diagramStatus = document.querySelector<HTMLElement>('#diagram-status')!;

  const render = async () => {
    const state = resolveState(requirementGraph, inventory);
    const frontier = computeFrontier(graph.nodes, state, distances, inventory);
    const totalCount = [...inventory.values()].reduce((sum, count) => sum + count, 0);
    const totalTarget = [...validCounts.values()].reduce((sum, count) => sum + count, 0);
    progressCount.textContent = `${totalCount} / ${totalTarget}`;
    progressBar.style.width = `${(totalCount / totalTarget) * 100}%`;
    requiredActions.innerHTML = actionList(frontier.required, 'No required items are ready.');
    optionalActions.innerHTML = actionList(frontier.optional, 'No optional items are ready.');
    diagramStatus.textContent = `${totalCount} collected · ${frontier.required.length} required next`;
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= 0.5;
    zoomIn.disabled = zoom >= 5;
    await renderDiagram({
      container: diagram,
      graph,
      state,
      inventory,
      zoom,
      pan: { x: panX, y: panY },
      onNodeClick: (nodeId, amount = 1) => {
        const node = graph.nodes.find((candidate) => candidate.id === nodeId);
        if (node?.class === 'action') {
          craftAction(graph, inventory, nodeId);
        } else {
          adjustInventory(inventory, graph, nodeId, amount);
        }
        saveProgress({ inventory, theme });
        scheduleInventoryHash(inventory);
        void render();
      },
    });
  };

  const tickFromFrontier = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-node-id]');
    const nodeId = button?.dataset.nodeId;
    if (!nodeId) return;
    adjustInventory(inventory, graph, nodeId, 1);
    saveProgress({ inventory, theme });
    scheduleInventoryHash(inventory);
    void render();
  };
  requiredActions.addEventListener('click', tickFromFrontier);
  optionalActions.addEventListener('click', tickFromFrontier);
  document.querySelector<HTMLButtonElement>('#reset-button')!.addEventListener('click', () => {
    inventory = new Map();
    clearProgress();
    scheduleInventoryHash(inventory);
    void render();
  });
  themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    saveProgress({ inventory, theme });
    updateThemeButton();
  });
  shareButton.addEventListener('click', () => copyShareLink(shareButton));
  const adjustZoom = (amount: number) => {
    zoom = Math.min(5, Math.max(0.5, zoom + amount));
    void render();
  };
  const zoomAtPointer = (amount: number, event: WheelEvent) => {
    const nextZoom = Math.min(5, Math.max(0.5, zoom + amount));
    if (nextZoom === zoom) return;
    const renderedSvg = diagram.querySelector<SVGSVGElement>('svg');
    if (renderedSvg) {
      const bounds = renderedSvg.getBoundingClientRect();
      const ratio = nextZoom / zoom;
      panX += (1 - ratio) * (event.clientX - bounds.left);
      panY += (1 - ratio) * (event.clientY - bounds.top);
    }
    zoom = nextZoom;
    void render();
  };
  zoomOut.addEventListener('click', () => {
    adjustZoom(-0.25);
  });
  zoomIn.addEventListener('click', () => {
    adjustZoom(0.25);
  });
  zoomReset.addEventListener('click', () => {
    zoom = 1;
    panX = 0;
    panY = 0;
    void render();
  });
  diagram.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomAtPointer(event.deltaY < 0 ? 0.25 : -0.25, event);
    },
    { passive: false },
  );
  let isPanning = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  diagram.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || (event.target as Element).closest('g.node')) return;
    isPanning = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX;
    panStartY = panY;
    diagram.setPointerCapture(event.pointerId);
    diagram.classList.add('is-panning');
  });
  diagram.addEventListener('pointermove', (event) => {
    if (!isPanning) return;
    panX = panStartX + event.clientX - dragStartX;
    panY = panStartY + event.clientY - dragStartY;
    const renderedSvg = diagram.querySelector<SVGSVGElement>('svg');
    if (renderedSvg) renderedSvg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  });
  const stopPanning = (event: PointerEvent) => {
    if (!isPanning) return;
    isPanning = false;
    if (diagram.hasPointerCapture(event.pointerId)) diagram.releasePointerCapture(event.pointerId);
    diagram.classList.remove('is-panning');
  };
  diagram.addEventListener('pointerup', stopPanning);
  diagram.addEventListener('pointercancel', stopPanning);

  function updateThemeButton(): void {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    themeToggle.innerHTML = theme === 'dark' ? '☼ <span>Light</span>' : '☾ <span>Dark</span>';
    themeToggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
    themeToggle.title = `Switch to ${nextTheme} mode`;
  }

  updateThemeButton();
  await render();
}

main().catch((error: unknown) => {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (app) {
    app.innerHTML = `<div class="error-state"><h1>Quest map unavailable</h1><p>${error instanceof Error ? error.message : 'Unknown loading error'}</p></div>`;
  }
});
