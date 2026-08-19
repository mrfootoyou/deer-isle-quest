import type { RequirementGraph } from './graph';

export type NodeState = 'done' | 'available' | 'locked';

/**
 * A node is satisfied once its incoming requirement edges are met, combined per its `requires`
 * field: 'any' (at least one predecessor done — alternative routes/acquisition methods) or the
 * default 'all' (every predecessor done). This is explicit authorial metadata in
 * data/loot-flow.json rather than inferred from edge type, since edge type alone can't reliably
 * distinguish "alternative route" from "additional requirement" (it previously deadlocked
 * `swamp_temple_teleport`, whose spawn-route predecessor happened to share an edge type with an
 * unrelated node's genuine AND requirement).
 */
function isSatisfied(graph: RequirementGraph, inventory: ReadonlyMap<string, number>, id: string): boolean {
  const predecessors = graph.requiredBy.get(id) ?? [];
  if (predecessors.length === 0) return true;
  const mode = graph.nodesById.get(id)?.requires ?? 'all';
  const meets = (edge: (typeof predecessors)[number]) =>
    (inventory.get(edge.from) ?? 0) >= (edge.quantity ?? 1);
  return mode === 'any' ? predecessors.some(meets) : predecessors.every(meets);
}

/**
 * Derives each node's state from the user's quantity-based inventory.
 *
 * Non-tickable nodes (place/action/terminal) auto-complete ("done") the moment their
 * requirement-edge predecessors are all done — there's nothing for the player to tick.
 * Tickable nodes become "available" once their predecessors are done, and "done" once their
 * inventory count reaches the node's target quantity. Early collection remains valid.
 *
 * The graph contains a cycle (temple/swamp teleports), so this uses an iterative fixed-point
 * relaxation instead of recursive DFS: `done` only ever grows, so it's guaranteed to converge
 * in at most N passes without needing cycle-detection bookkeeping.
 */
export function resolveState(
  graph: RequirementGraph,
  inventory: ReadonlyMap<string, number>,
): Map<string, NodeState> {
  const satisfiedInventory = new Map(inventory);

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodesById.values()) {
      if (node.tickable || satisfiedInventory.has(node.id)) continue;
      if (isSatisfied(graph, satisfiedInventory, node.id)) {
        satisfiedInventory.set(node.id, node.quantity ?? 1);
        changed = true;
      }
    }
  }

  const state = new Map<string, NodeState>();
  for (const node of graph.nodesById.values()) {
    const count = inventory.get(node.id) ?? 0;
    const target = node.quantity ?? 1;
    if (count >= target) {
      state.set(node.id, 'done');
    } else if (node.tickable && isSatisfied(graph, satisfiedInventory, node.id)) {
      state.set(node.id, 'available');
    } else if (!node.tickable && isSatisfied(graph, satisfiedInventory, node.id)) {
      state.set(node.id, 'done');
    } else {
      state.set(node.id, 'locked');
    }
  }
  return state;
}
