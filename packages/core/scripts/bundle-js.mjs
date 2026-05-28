#!/usr/bin/env node
// Copy ES modules from src/js and src/macros to dist with the names
// listed in the package "exports" map. No bundling, no transpiling —
// the source is already plain ESM that runs in modern browsers and Node.

import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distDir = join(pkgRoot, 'dist');

// [source-relative-to-pkgRoot, dist-relative-to-distDir]
const FILES = [
  // Behaviors and main entry.
  ['src/js/index.js',         'index.js'],
  ['src/js/confirm.js',       'confirm.js'],
  ['src/js/toast.js',         'toast.js'],
  ['src/js/close-dialog.js',  'close-dialog.js'],
  ['src/js/close-popover.js', 'close-popover.js'],
  ['src/js/remote-dialog.js', 'remote-dialog.js'],
  ['src/js/behaviors.js',     'hc.behaviors.js'],

  // Macros — kept under dist/macros/ so the entry module's relative
  // imports (./confirm-action.js, ./live-search.js) resolve correctly.
  ['src/macros/index.js',          'macros/index.js'],
  ['src/macros/confirm-action.js', 'macros/confirm-action.js'],
  ['src/macros/live-search.js',    'macros/live-search.js'],
];

async function main() {
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, 'macros'), { recursive: true });
  for (const [from, to] of FILES) {
    await copyFile(join(pkgRoot, from), join(distDir, to));
  }
  console.log(`copied ${FILES.length} JS module(s) to dist/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
