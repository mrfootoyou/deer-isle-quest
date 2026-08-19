#!/usr/bin/env node
// Compares deer-isle-endgame-loot-flow.mmd against data/loot-flow.json and fails on drift.
// Regex-based .mmd parsing (no mermaid parser dependency) tailored to this repo's flowchart style.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mmdPath = path.join(repoRoot, 'deer-isle-endgame-loot-flow.mmd');
const jsonPath = path.join(repoRoot, 'data', 'loot-flow.json');

// Edges that target a subgraph id in the .mmd instead of a node id; remapped to the
// subgraph's practical entry node so they compare equal to data/loot-flow.json.
const SUBGRAPH_EDGE_TARGET_OVERRIDES = {
  swamp_area: 'swamp_temple_teleport',
};

const LEGEND_SUBGRAPH_ID = 'flowchart_key';

const ARROW_TO_TYPE = {
  '-->': 'main',
  '--x': 'consume',
  '==>': 'travel',
  '===': 'travel',
  '-.->': 'optional',
};

function parseMmd(text) {
  const nodes = new Map(); // id -> { shape, subgraphId }
  const nodeClasses = new Map(); // id -> class
  const edges = []; // { from, to, type }
  const subgraphIds = new Set();
  const legendIds = new Set();

  const subgraphStack = [];

  const nodePatterns = [
    { shape: 'double-circle', re: /(\w+)\[\[.*?\]\]/g },
    { shape: 'stadium', re: /(\w+)\(\[.*?\]\)/g },
    { shape: 'subroutine', re: /(\w+)\[\/.*?\/\]/g },
    { shape: 'hexagon', re: /(\w+)\{\{.*?\}\}/g },
    { shape: 'rect', re: /(\w+)\[(?!\[|\/).*?\]/g },
  ];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;

    const subgraphMatch = line.match(/^subgraph\s+(\w+)/);
    if (subgraphMatch) {
      const id = subgraphMatch[1];
      subgraphStack.push(id);
      if (id !== LEGEND_SUBGRAPH_ID) subgraphIds.add(id);
      continue;
    }
    if (line === 'end') {
      subgraphStack.pop();
      continue;
    }

    const currentSubgraphId = subgraphStack.length ? subgraphStack[subgraphStack.length - 1] : null;
    const inLegend = subgraphStack.includes(LEGEND_SUBGRAPH_ID);

    // Node declarations (shape brackets). A single line only ever declares one node here.
    for (const { shape, re } of nodePatterns) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) {
        const id = m[1];
        if (inLegend) {
          legendIds.add(id);
        } else if (!nodes.has(id)) {
          nodes.set(id, { shape, subgraphId: currentSubgraphId });
        }
        break;
      }
    }

    // `class id1,id2,... className` assignments.
    const classMatch = line.match(/^class\s+([\w,\s]+?)\s+(\w+)\s*$/);
    if (classMatch) {
      const ids = classMatch[1].split(',').map((s) => s.trim());
      const className = classMatch[2];
      for (const id of ids) {
        if (!inLegend) nodeClasses.set(id, className);
      }
      continue;
    }

    // Edges: from ARROW [|label|] to. Skip '~~~' ordering-only links.
    if (line.includes('~~~')) continue;
    const edgeMatch = line.match(/^(\w+)\s*(-->|--x|==>|===|-\.->)\s*(?:\|([^|]*)\|)?\s*(\w+)\s*$/);
    if (edgeMatch) {
      const [, from, arrow, , toRaw] = edgeMatch;
      if (inLegend) continue;
      const to = SUBGRAPH_EDGE_TARGET_OVERRIDES[toRaw] ?? toRaw;
      edges.push({ from, to, type: ARROW_TO_TYPE[arrow] });
    }
  }

  // A node may be declared without ever appearing in a `class` line (defaults to mermaid's
  // `default` classDef); that's fine, nodeClasses simply won't have an entry for it.
  return { nodes, nodeClasses, edges, subgraphIds, legendIds };
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function edgeKey(e) {
  return `${e.from}->${e.to}:${e.type}`;
}

function diffSets(labelA, setA, labelB, setB) {
  const onlyInA = [...setA].filter((x) => !setB.has(x)).sort();
  const onlyInB = [...setB].filter((x) => !setA.has(x)).sort();
  const problems = [];
  if (onlyInA.length) problems.push(`  in ${labelA} but not ${labelB}: ${onlyInA.join(', ')}`);
  if (onlyInB.length) problems.push(`  in ${labelB} but not ${labelA}: ${onlyInB.join(', ')}`);
  return problems;
}

function main() {
  const mmdText = readFileSync(mmdPath, 'utf8');
  const json = loadJson(jsonPath);

  const mmd = parseMmd(mmdText);
  const problems = [];

  // 1. Node id sets (excluding the legend, which the JSON also excludes).
  const mmdNodeIds = new Set(mmd.nodes.keys());
  const jsonNodeIds = new Set(json.nodes.map((n) => n.id));
  problems.push(...diffSets('.mmd nodes', mmdNodeIds, 'loot-flow.json nodes', jsonNodeIds));

  // 2. Subgraph id sets.
  const jsonSubgraphIds = new Set(json.subgraphs.map((s) => s.id));
  problems.push(...diffSets('.mmd subgraphs', mmd.subgraphIds, 'loot-flow.json subgraphs', jsonSubgraphIds));

  // 3. Per-node shape / class / subgraphId, for nodes present in both.
  const jsonNodeById = new Map(json.nodes.map((n) => [n.id, n]));
  for (const id of mmdNodeIds) {
    if (!jsonNodeIds.has(id)) continue; // already reported above
    const mmdNode = mmd.nodes.get(id);
    const jsonNode = jsonNodeById.get(id);

    if (mmdNode.shape !== jsonNode.shape) {
      problems.push(`  node '${id}': shape mismatch (.mmd='${mmdNode.shape}' vs json='${jsonNode.shape}')`);
    }
    if (mmdNode.subgraphId !== jsonNode.subgraphId) {
      problems.push(
        `  node '${id}': subgraphId mismatch (.mmd='${mmdNode.subgraphId}' vs json='${jsonNode.subgraphId}')`,
      );
    }
    const mmdClass = mmd.nodeClasses.get(id);
    if (mmdClass && mmdClass !== jsonNode.class) {
      problems.push(`  node '${id}': class mismatch (.mmd='${mmdClass}' vs json='${jsonNode.class}')`);
    }
    const expectedTickable = ['quest_loot', 'endgame_loot', 'optional_loot'].includes(jsonNode.class);
    if (jsonNode.tickable !== expectedTickable) {
      problems.push(`  node '${id}': tickable=${jsonNode.tickable} inconsistent with class='${jsonNode.class}'`);
    }
  }

  // 4. Edge (from, to, type) sets.
  const mmdEdgeKeys = new Set(mmd.edges.map(edgeKey));
  const jsonEdgeKeys = new Set(json.edges.map(edgeKey));
  problems.push(...diffSets('.mmd edges', mmdEdgeKeys, 'loot-flow.json edges', jsonEdgeKeys));

  if (problems.length) {
    console.error('Graph integrity check FAILED. data/loot-flow.json has drifted from deer-isle-endgame-loot-flow.mmd:\n');
    console.error(problems.join('\n'));
    console.error('\nUpdate data/loot-flow.json (or the .mmd, if that was the intended change) so both describe the same graph.');
    process.exitCode = 1;
    return;
  }

  console.log('Graph integrity check passed: data/loot-flow.json matches deer-isle-endgame-loot-flow.mmd.');
}

main();
