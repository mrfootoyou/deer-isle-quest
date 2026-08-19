import type { LootFlowGraph } from '../src/types';
import { buildRequirementGraph } from '../src/domain/graph';
import { resolveState } from '../src/domain/state';
import { distanceToEndgame } from '../src/domain/distance';
import { findCriticalPath } from '../src/domain/critical-path';
import { computeFrontier } from '../src/domain/frontier';
import { adjustInventory, craftAction } from '../src/domain/inventory';
import { readFileSync } from 'node:fs';

const raw: LootFlowGraph = JSON.parse(readFileSync('../data/loot-flow.json', 'utf8'));
const reqGraph = buildRequirementGraph(raw);

const inventory0 = new Map<string, number>();
// 1. Fresh start: empty inventory.
const state0 = resolveState(reqGraph, inventory0);
console.log('--- fresh start ---');
console.log('spawn state (expect done, auto-satisfied, no prerequisites):', state0.get('spawn'));
console.log('dive_suit state (expect locked, needs air_compressor+spawn find):', state0.get('dive_suit'));
console.log('light_source state (expect available, no prerequisites):', state0.get('light_source'));
console.log('burlap/netting (expect available, raw materials):', state0.get('burlap'), state0.get('netting'));
console.log('endgame state (expect locked):', state0.get('endgame'));
console.log(
  'swamp_temple_teleport/temple_main (expect done, reachable directly from spawn):',
  state0.get('swamp_temple_teleport'),
  state0.get('temple_main'),
);

// 2. Tick everything needed to open the first gate.
const inventory1 = new Map([
  ['dive_suit', 1],
  ['nbc_suit', 1],
  ['purple_keycard', 1],
  ['ghillie', 1],
]);
const state1 = resolveState(reqGraph, inventory1);
console.log('\n--- after ticking dive_suit/nbc_suit/purple_keycard/ghillie ---');
console.log('temple_dive_entry (expect done, dive_suit --dive--> it):', state1.get('temple_dive_entry'));
console.log('punch_card (expect available):', state1.get('punch_card'));
console.log('crater_tower (expect done, nbc_suit protects):', state1.get('crater_tower'));
console.log('kmuc_blast_door (expect done, purple_keycard unlocks):', state1.get('kmuc_blast_door'));
console.log('staff (expect available):', state1.get('staff'));

// 3. Distance to endgame sanity checks.
const dist = distanceToEndgame(reqGraph);
console.log('\n--- distances ---');
console.log('endgame distance (expect 0):', dist.get('endgame'));
console.log('eternal_staff distance (expect 1, activates endgame directly):', dist.get('eternal_staff'));
console.log('bear_suit distance (expect 1, survives endgame directly):', dist.get('bear_suit'));
console.log('spawn distance (expect some finite number > 0):', dist.get('spawn'));
console.log('total nodes with a known distance:', dist.size, 'of', raw.nodes.length);

// 4. Critical path spawn -> endgame.
const path = findCriticalPath(reqGraph);
console.log('\n--- critical path ---');
console.log('length:', path.nodeIds.length);
console.log('path:', path.nodeIds.join(' -> '));
console.log('starts with spawn:', path.nodeIds[0] === 'spawn');
console.log('ends with endgame:', path.nodeIds.at(-1) === 'endgame');

// 5. Frontier ranking at fresh start.
const frontier0 = computeFrontier(raw.nodes, state0, dist, inventory0);
console.log('\n--- frontier (fresh start) ---');
console.log(
  'required:',
  frontier0.required.map((e) => `${e.id}(${e.distanceToEndgame})`),
);
console.log(
  'optional:',
  frontier0.optional.map((e) => `${e.id}(${e.distanceToEndgame})`),
);

const partialPelts = resolveState(reqGraph, new Map([['bear_pelts', 1]]));
console.log('\n--- quantity checks ---');
console.log('bear pelts 1 of 2 state (expect done only at target):', partialPelts.get('bear_pelts'));
console.log(
  'tan hides with 1 pelt (expect locked):',
  partialPelts.get('prepare_bear_pelts'),
);

const craftInventory = new Map([
  ['bear_pelts', 2],
  ['leather_kit', 1],
]);
const crafted = craftAction(raw, craftInventory, 'prepare_bear_pelts');
console.log('tan hides craft succeeds with 2 pelts:', crafted);
console.log('pelts after craft (expect absent):', craftInventory.get('bear_pelts') ?? 0);
console.log('tanned pelts after craft (expect 1):', craftInventory.get('tanned_bear_pelts') ?? 0);

const repeatCraftInventory = new Map([
  ['bear_pelts', 2],
  ['leather_kit', 1],
  ['tanned_bear_pelts', 1],
]);
const repeatedCraft = craftAction(raw, repeatCraftInventory, 'prepare_bear_pelts');
console.log('craft preserves existing singular output:', repeatedCraft, repeatCraftInventory.get('tanned_bear_pelts'));

const toggleInventory = new Map<string, number>();
adjustInventory(toggleInventory, raw, 'purple_keycard', 1);
adjustInventory(toggleInventory, raw, 'purple_keycard', 1);
console.log('single item toggle (expect absent):', toggleInventory.has('purple_keycard'));
const pluralInventory = new Map<string, number>();
adjustInventory(pluralInventory, raw, 'bear_pelts', 1);
adjustInventory(pluralInventory, raw, 'bear_pelts', 1);
adjustInventory(pluralInventory, raw, 'bear_pelts', -1);
console.log('plural item decrement (expect 1):', pluralInventory.get('bear_pelts') ?? 0);
