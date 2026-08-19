import type { RequirementGraph } from './graph';

export interface CriticalPath {
  /** Ordered node ids from 'spawn' to 'endgame', inclusive of both. Empty array if no path exists. */
  nodeIds: string[];
}

const START_NODE = 'spawn';
const END_NODE = 'endgame';

/** Shortest spawn->endgame path via forward BFS over requirement edges, with predecessor backtracking. */
export function findCriticalPath(graph: RequirementGraph): CriticalPath {
  if (!graph.nodesById.has(START_NODE) || !graph.nodesById.has(END_NODE)) {
    return { nodeIds: [] };
  }

  const queue: string[] = [START_NODE];
  const predecessors = new Map<string, string>();
  const visited = new Set<string>([START_NODE]);
  let pathFound = false;

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (currentNodeId === END_NODE) {
      pathFound = true;
      break;
    }
    for (const edge of graph.requires.get(currentNodeId) ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        predecessors.set(edge.to, currentNodeId);
        queue.push(edge.to);
      }
    }
  }

  if (!pathFound) return { nodeIds: [] };

  const path: string[] = [];
  let current: string | undefined = END_NODE;
  while (current) {
    path.unshift(current);
    if (current === START_NODE) break;
    current = predecessors.get(current);
  }
  return { nodeIds: path };
}
