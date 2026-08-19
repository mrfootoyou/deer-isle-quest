import type { LootFlowEdge, LootFlowGraph, LootFlowNode } from '../types';

/**
 * Edges that gate progression (must be satisfied to reach a node). Optional edges
 * (dashed `-.->` in the .mmd) are informational only and excluded from requirement logic,
 * distance-to-ENDGAME, and critical-path calculations.
 */
const REQUIREMENT_EDGE_TYPES = new Set<LootFlowEdge['type']>(['main', 'consume', 'travel']);

export interface RequirementGraph {
  nodesById: Map<string, LootFlowNode>;
  /** Incoming requirement edges per node id (edge.to === id). */
  requiredBy: Map<string, LootFlowEdge[]>;
  /** Outgoing requirement edges per node id (edge.from === id). */
  requires: Map<string, LootFlowEdge[]>;
}

export function buildRequirementGraph(graph: LootFlowGraph): RequirementGraph {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const requiredBy = new Map<string, LootFlowEdge[]>();
  const requires = new Map<string, LootFlowEdge[]>();
  for (const node of graph.nodes) {
    requiredBy.set(node.id, []);
    requires.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!REQUIREMENT_EDGE_TYPES.has(edge.type)) continue;
    requiredBy.get(edge.to)?.push(edge);
    requires.get(edge.from)?.push(edge);
  }
  return { nodesById, requiredBy, requires };
}
