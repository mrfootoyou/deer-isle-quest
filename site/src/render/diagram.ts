import mermaid from 'mermaid';
import type { LootFlowGraph } from '../types';
import { generateMermaid, type NodeState } from './mermaid-generator';

export interface DiagramOptions {
  container: HTMLElement;
  graph: LootFlowGraph;
  state: Map<string, NodeState>;
  inventory?: ReadonlyMap<string, number>;
  criticalPath?: string[];
  zoom?: number;
  pan?: { x: number; y: number };
  onNodeClick?: (nodeId: string, amount?: number) => void;
}

let renderSequence = 0;

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  look: 'classic',
  layout: 'elk',
  securityLevel: 'strict',
  themeVariables: {
    background: 'transparent',
    primaryColor: '#1e293b',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#94a3b8',
    lineColor: '#cbd5e1',
    secondaryColor: '#334155',
    tertiaryColor: '#0f172a',
    fontFamily: 'Recursive Variable, sans-serif',
  },
});

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  place: { fill: '#0f172a', stroke: '#38bdf8', text: '#f8fafc' },
  action: { fill: '#475569', stroke: '#cbd5e1', text: '#f8fafc' },
  quest_loot: { fill: '#22c55e', stroke: '#14532d', text: '#052e16' },
  optional_loot: { fill: '#64748b', stroke: '#cbd5e1', text: '#f8fafc' },
  endgame_loot: { fill: '#9333ea', stroke: '#d8b4fe', text: '#ffffff' },
  terminal: { fill: '#fbbf24', stroke: '#d97706', text: '#000000' },
};

function applyNodeColors(
  container: HTMLElement,
  graph: LootFlowGraph,
  state: ReadonlyMap<string, NodeState>,
): void {
  for (const group of container.querySelectorAll<SVGGElement>('g.node')) {
    const nodeClass = Object.keys(NODE_COLORS).find((className) => group.classList.contains(className));
    if (!nodeClass) continue;
    const colors = NODE_COLORS[nodeClass];
    const node = graph.nodes.find((candidate) => group.id.includes(`-${candidate.id}-`));
    const isTickedLoot = node?.tickable === true && state.get(node.id) === 'done';
    const stroke = isTickedLoot ? '#fbbf24' : colors.stroke;
    const strokeWidth = isTickedLoot ? '4px' : nodeClass === 'terminal' ? '4px' : '2px';
    for (const shape of group.querySelectorAll<SVGElement>('rect, circle, ellipse, polygon, path')) {
      shape.style.setProperty('fill', colors.fill, 'important');
      shape.style.setProperty('stroke', stroke, 'important');
      shape.style.setProperty('stroke-width', strokeWidth, 'important');
    }
    for (const label of group.querySelectorAll<HTMLElement>('.label, .nodeLabel, foreignObject div, text')) {
      label.style.setProperty('color', colors.text, 'important');
      label.style.setProperty('fill', colors.text, 'important');
    }
  }
}

/** Render the current graph state and wire click handling for tickable nodes. */
export async function renderDiagram(options: DiagramOptions): Promise<void> {
  const { container, graph, state, inventory = new Map(), criticalPath = [], zoom = 1, pan = { x: 0, y: 0 }, onNodeClick } = options;
  const diagramId = `loot-flow-${renderSequence++}`;
  const { svg, bindFunctions } = await mermaid.render(
    diagramId,
    generateMermaid(graph, state, inventory, criticalPath),
  );
  container.innerHTML = svg;
  bindFunctions?.(container);
  applyNodeColors(container, graph, state);

  const renderedSvg = container.querySelector<SVGSVGElement>('svg');
  if (renderedSvg) {
    renderedSvg.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    renderedSvg.style.transformOrigin = 'top left';
  }

  if (!onNodeClick) return;
  const clickableIds = new Set(
    graph.nodes.filter((node) => node.tickable || node.class === 'action').map((node) => node.id),
  );
  const nodeGroups = container.querySelectorAll<SVGGElement>('g.node');
  for (const group of nodeGroups) {
    const nodeId = graph.nodes.find(
      (node) => clickableIds.has(node.id) && group.id.includes(`-${node.id}-`),
    )?.id;
    if (!nodeId) continue;
    const node = graph.nodes.find((candidate) => candidate.id === nodeId)!;
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute(
      'aria-label',
      node.class === 'action'
        ? `Craft ${node.label}`
        : `Adjust ${node.label}; click to add or toggle, Shift/Ctrl-click or right-click to remove`,
    );
    const activate = (amount = 1) => onNodeClick(nodeId, amount);
    group.addEventListener('click', (event) => {
      activate(event.shiftKey || event.ctrlKey ? -1 : 1);
    });
    group.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      activate(-1);
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(event.shiftKey || event.ctrlKey ? -1 : 1);
      }
    });
  }
}
