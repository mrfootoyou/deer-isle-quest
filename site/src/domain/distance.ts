import type { RequirementGraph } from './graph';

const ENDGAME_NODE_ID = 'endgame';

/**
 * Shortest number of requirement edges from each node to `endgame`, via a single reverse
 * BFS starting at `endgame` (an edge `A -> B` in `requiredBy` means walking it backward from
 * `B` finds `A`'s forward distance to `B`). Nodes with no path to `endgame` are omitted.
 */
export function distanceToEndgame(graph: RequirementGraph): Map<string, number> {
  const distances = new Map<string, number>();
  if (!graph.nodesById.has(ENDGAME_NODE_ID)) return distances;

  const queue: string[] = [ENDGAME_NODE_ID];
  distances.set(ENDGAME_NODE_ID, 0);

  while (queue.length > 0) {
    const v = queue.shift()!;
    const currentDistance = distances.get(v)!;
    for (const edge of graph.requiredBy.get(v) ?? []) {
      const u = edge.from;
      if (!distances.has(u)) {
        distances.set(u, currentDistance + 1);
        queue.push(u);
      }
    }
  }

  return distances;
}
