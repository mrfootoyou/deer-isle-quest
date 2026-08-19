import type { LootFlowNode } from '../types';
import type { NodeState } from './state';

export interface FrontierEntry {
  id: string;
  label: string;
  current: number;
  target: number;
  distanceToEndgame: number | null;
}

export interface Frontier {
  /** Actionable now, class quest_loot or endgame_loot, ascending by distanceToEndgame (nulls last). */
  required: FrontierEntry[];
  /** Actionable now, class optional_loot; deprioritized vs `required` per design decision. */
  optional: FrontierEntry[];
}

const REQUIRED_CLASSES = new Set(['quest_loot', 'endgame_loot']);

/** Nulls (no known distance) sort last; ties broken by label for a deterministic order. */
function compareFrontierEntries(a: FrontierEntry, b: FrontierEntry): number {
  if (a.distanceToEndgame === null && b.distanceToEndgame === null) return a.label.localeCompare(b.label);
  if (a.distanceToEndgame === null) return 1;
  if (b.distanceToEndgame === null) return -1;
  if (a.distanceToEndgame !== b.distanceToEndgame) return a.distanceToEndgame - b.distanceToEndgame;
  return a.label.localeCompare(b.label);
}

export function computeFrontier(
  nodes: readonly LootFlowNode[],
  state: ReadonlyMap<string, NodeState>,
  distanceToEndgame: ReadonlyMap<string, number>,
  inventory: ReadonlyMap<string, number>,
): Frontier {
  const available = nodes.filter((node) => node.tickable && state.get(node.id) === 'available');

  const toEntry = (node: LootFlowNode): FrontierEntry => ({
    id: node.id,
    label: node.label,
    current: inventory.get(node.id) ?? 0,
    target: node.quantity ?? 1,
    distanceToEndgame: distanceToEndgame.get(node.id) ?? null,
  });

  const required = available
    .filter((node) => REQUIRED_CLASSES.has(node.class))
    .map(toEntry)
    .sort(compareFrontierEntries);
  const optional = available
    .filter((node) => node.class === 'optional_loot')
    .map(toEntry)
    .sort(compareFrontierEntries);

  return { required, optional };
}
