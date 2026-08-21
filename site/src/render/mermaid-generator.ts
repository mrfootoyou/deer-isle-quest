import type { LootFlowGraph, LootFlowNode } from '../types';

export type NodeState = 'done' | 'available' | 'locked';

const CLASS_STYLES: Record<string, string> = {
  default: 'fill:#1e293b,color:#f8fafc,stroke:#475569,stroke-width:1px',
  action: 'fill:#475569,color:#ffffff,stroke:#1e293b,stroke-width:1px',
  place: 'fill:#0f172a,color:#38bdf8,stroke:#0ea5e9,stroke-width:2px',
  endgame_loot: 'fill:#9333ea,color:#ffffff,stroke:#d8b4fe,stroke-width:3px',
  quest_loot: 'fill:#22c55e,color:#052e16,stroke:#14532d,stroke-width:2px',
  optional_loot: 'fill:#64748b,color:#f1f5f9,stroke:#475569,stroke-width:2px,stroke-dasharray:5\\,5',
  terminal: 'fill:#fbbf24,color:#000000,stroke:#d97706,stroke-width:4px',
};

const EDGE_SYNTAX: Record<string, string> = {
  main: '-->',
  consume: '--x',
  travel: '==>',
  optional: '-.->',
};

function escapeLabel(label: string): string {
  return label.replace(/(["`\\])/g, '\\$1').replace(/\r?\n/g, '<br/>');
}

function nodeDefinition(node: LootFlowNode, inventory: ReadonlyMap<string, number>): string {
  const target = node.quantity ?? 1;
  const countLabel = node.tickable && target > 1 ? ` ${inventory.get(node.id) ?? 0} of ${target}` : '';
  const label = escapeLabel(`${node.label}${countLabel}`);
  switch (node.shape) {
    case 'stadium':
      return `${node.id}(["${label}"])`;
    case 'subroutine':
      return `${node.id}[["${label}"]]`;
    case 'hexagon':
      return `${node.id}{{"${label}"}}`;
    default:
      return `${node.id}["${label}"]`;
  }
}

function classDefinition(className: string, style: string): string {
  return `classDef ${className} ${style}`;
}

/** Serialize the canonical graph into Mermaid source for the current UI state. */
export function generateMermaid(
  graph: LootFlowGraph,
  state: Map<string, NodeState> = new Map(),
  inventory: ReadonlyMap<string, number> = new Map(),
  criticalPath: string[] = [],
): string {
  const lines = ['flowchart TD'];
  lines.push(...Object.entries(CLASS_STYLES).map(([name, style]) => classDefinition(name, style)));

  for (const node of graph.nodes) {
    const nodeState = state.get(node.id) ?? 'locked';
    const className = `${node.class}_${nodeState}`;
    const style = CLASS_STYLES[node.class] ?? CLASS_STYLES.default;
    const stateStyle = nodeState === 'done' && node.tickable
      ? ',stroke:#fbbf24,stroke-width:4px'
      : nodeState === 'locked' && !node.tickable
        ? ',opacity:0.62'
        : '';
    lines.push(classDefinition(className, `${style}${stateStyle}`));
  }

  const nodesBySubgraph = new Map<string | null, LootFlowNode[]>();
  for (const node of graph.nodes) {
    const nodes = nodesBySubgraph.get(node.subgraphId ?? null) ?? [];
    nodes.push(node);
    nodesBySubgraph.set(node.subgraphId ?? null, nodes);
  }

  const rootNodes = nodesBySubgraph.get(null) ?? [];
  for (const node of rootNodes) lines.push(nodeDefinition(node, inventory));

  for (const subgraph of graph.subgraphs) {
    lines.push(`subgraph ${subgraph.id}["${escapeLabel(subgraph.title)}"]`);
    if (subgraph.direction) lines.push(`direction ${subgraph.direction}`);
    for (const node of nodesBySubgraph.get(subgraph.id) ?? []) lines.push(nodeDefinition(node, inventory));
    lines.push('end');
  }

  const criticalEdges = new Set(
    criticalPath.slice(0, -1).map((from, index) => `${from}->${criticalPath[index + 1]}`),
  );
  const criticalLinkIndexes: number[] = [];
  graph.edges.forEach((edge, index) => {
    const syntax = EDGE_SYNTAX[edge.type];
    const label = edge.label ? `|${escapeLabel(edge.label)}|` : '';
    lines.push(`${edge.from} ${syntax}${label} ${edge.to}`);
    if (criticalEdges.has(`${edge.from}->${edge.to}`)) criticalLinkIndexes.push(index);
  });

  for (const node of graph.nodes) {
    const nodeState = state.get(node.id) ?? 'locked';
    lines.push(`class ${node.id} ${node.class}_${nodeState}`);
  }
  lines.push('linkStyle default stroke:#94a3b8,stroke-width:1.5px');
  if (criticalLinkIndexes.length > 0) {
    lines.push(`linkStyle ${criticalLinkIndexes.join(',')} stroke:#fbbf24,stroke-width:4px`);
  }

  return lines.join('\n');
}
