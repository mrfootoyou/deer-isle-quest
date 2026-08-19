import type { LootFlowGraph } from '../types';

export function adjustInventory(
  inventory: Map<string, number>,
  graph: LootFlowGraph,
  nodeId: string,
  amount: number,
): void {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.tickable) return;
  const current = inventory.get(nodeId) ?? 0;
  const maximum = node.quantity ?? 1;
  const next = maximum === 1 && amount > 0
    ? current === 0 ? 1 : 0
    : Math.max(0, Math.min(maximum, current + amount));
  if (next === 0) inventory.delete(nodeId);
  else inventory.set(nodeId, next);
}

function addInventory(
  inventory: Map<string, number>,
  graph: LootFlowGraph,
  nodeId: string,
  amount: number,
): void {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.tickable) return;
  const maximum = node.quantity ?? 1;
  const next = Math.min(maximum, (inventory.get(nodeId) ?? 0) + amount);
  if (next > 0) inventory.set(nodeId, next);
}

export function craftAction(graph: LootFlowGraph, inventory: Map<string, number>, actionId: string): boolean {
  const action = graph.nodes.find((node) => node.id === actionId && node.class === 'action');
  if (!action) return false;
  const consumed = graph.edges.filter((edge) => edge.to === actionId && edge.type === 'consume');
  if (consumed.some((edge) => (inventory.get(edge.from) ?? 0) < (edge.quantity ?? 1))) return false;

  for (const edge of consumed) {
    const next = (inventory.get(edge.from) ?? 0) - (edge.quantity ?? 1);
    if (next > 0) inventory.set(edge.from, next);
    else inventory.delete(edge.from);
  }
  for (const edge of graph.edges.filter((candidate) => candidate.from === actionId && candidate.type === 'main')) {
    addInventory(inventory, graph, edge.to, edge.quantity ?? 1);
  }
  return true;
}
