import { describe, expect, it } from 'vitest';
import type { LootFlowGraph } from '../types';
import graphData from '../../../data/loot-flow.json';
import { buildRequirementGraph } from './graph';
import { resolveState } from './state';
import { distanceToEndgame } from './distance';
import { computeFrontier } from './frontier';
import { adjustInventory, craftAction } from './inventory';

const graph = graphData as LootFlowGraph;
const requirementGraph = buildRequirementGraph(graph);

describe('quest domain', () => {
  it('resolves the initial route and quantity-aware item states', () => {
    const state = resolveState(requirementGraph, new Map([['bear_pelts', 1]]));

    expect(state.get('spawn')).toBe('done');
    expect(state.get('bear_pelts')).toBe('available');
    expect(state.get('prepare_bear_pelts')).toBe('locked');
    expect(state.get('endgame')).toBe('locked');
  });

  it('opens expected progression gates after collecting key items', () => {
    const state = resolveState(
      requirementGraph,
      new Map([
        ['dive_suit', 1],
        ['nbc_suit', 1],
        ['purple_keycard', 1],
        ['ghillie', 1],
      ]),
    );

    expect(state.get('temple_dive_entry')).toBe('done');
    expect(state.get('punch_card')).toBe('available');
    expect(state.get('crater_tower')).toBe('done');
    expect(state.get('kmuc_blast_door')).toBe('done');
    expect(state.get('staff')).toBe('available');
  });

  it('calculates distances and ranks the fresh frontier', () => {
    const inventory = new Map<string, number>();
    const state = resolveState(requirementGraph, inventory);
    const distances = distanceToEndgame(requirementGraph);
    const frontier = computeFrontier(graph.nodes, state, distances, inventory);

    expect(distances.get('endgame')).toBe(0);
    expect(distances.get('spawn')).toBe(4);
    expect(frontier.required.map((entry) => entry.id)).toContain('purple_keycard');
    expect(frontier.optional.map((entry) => entry.id)).toContain('burlap');
  });

  it('consumes exact recipe quantities and preserves an existing output', () => {
    const inventory = new Map([
      ['bear_pelts', 4],
      ['leather_kit', 1],
      ['tanned_bear_pelts', 1],
    ]);

    expect(craftAction(graph, inventory, 'prepare_bear_pelts')).toBe(true);
    expect(inventory.has('bear_pelts')).toBe(false);
    expect(inventory.get('tanned_bear_pelts')).toBe(1);
  });

  it('rejects incomplete recipes and handles singular/plural adjustments', () => {
    const incomplete = new Map([['bear_pelts', 1], ['leather_kit', 1]]);
    expect(craftAction(graph, incomplete, 'prepare_bear_pelts')).toBe(false);
    expect(incomplete.get('bear_pelts')).toBe(1);

    const singular = new Map<string, number>();
    adjustInventory(singular, graph, 'purple_keycard', 1);
    adjustInventory(singular, graph, 'purple_keycard', 1);
    expect(singular.has('purple_keycard')).toBe(false);

    const plural = new Map<string, number>();
    adjustInventory(plural, graph, 'bear_pelts', 1);
    adjustInventory(plural, graph, 'bear_pelts', 1);
    adjustInventory(plural, graph, 'bear_pelts', -1);
    expect(plural.get('bear_pelts')).toBe(1);
  });
});
