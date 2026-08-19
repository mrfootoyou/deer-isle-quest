#!/usr/bin/env node
// Copies the canonical repo-root data/loot-flow.json into site/public so it's bundled by Vite.
// Keeps data/loot-flow.json as the single hand-edited source of truth (see AGENTS.md).

import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteDir, '..');

const src = path.join(repoRoot, 'data', 'loot-flow.json');
const destDir = path.join(siteDir, 'public', 'data');
const dest = path.join(destDir, 'loot-flow.json');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`Copied ${path.relative(repoRoot, src)} -> ${path.relative(repoRoot, dest)}`);
