/** Structural types mirroring data/loot-flow.schema.json. */

export type NodeShape = 'rect' | 'stadium' | 'subroutine' | 'hexagon' | 'double-circle';

export type NodeClass = 'quest_loot' | 'endgame_loot' | 'optional_loot' | 'place' | 'action' | 'terminal';

export type EdgeType = 'main' | 'consume' | 'travel' | 'optional';

export interface LootFlowSubgraph {
  id: string;
  title: string;
  direction?: 'LR' | 'TB';
}

export interface LootFlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  class: NodeClass;
  tickable: boolean;
  /** Maximum useful inventory count for this node; defaults to 1. */
  quantity?: number;
  subgraphId?: string | null;
  /** How incoming requirement edges combine: 'all' (default) or 'any' (alternative routes/methods). */
  requires?: 'any' | 'all';
}

export interface LootFlowEdge {
  from: string;
  to: string;
  label?: string;
  type: EdgeType;
  /** Amount consumed or produced by this edge; defaults to 1. */
  quantity?: number;
}

export interface LootFlowGraph {
  subgraphs: LootFlowSubgraph[];
  nodes: LootFlowNode[];
  edges: LootFlowEdge[];
}
