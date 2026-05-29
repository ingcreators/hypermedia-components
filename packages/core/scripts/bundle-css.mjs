#!/usr/bin/env node
// Concatenate the per-layer CSS sources into dist/hc.css.
//
// Order matches plan §10.1:
//   hc.layers (declaration) -> hc.tokens -> hc.base -> hc.components
//
// Per-file outputs are also copied into dist/ so consumers can opt into
// individual layers via the package "exports" map.

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const srcCssDir = join(pkgRoot, 'src', 'css');
const distDir = join(pkgRoot, 'dist');

const LAYER_DECL = join(srcCssDir, 'hc.layers.css');
const TOKENS_CSS = join(distDir, 'hc.tokens.css');
const BASE_CSS   = join(srcCssDir, 'hc.base.css');
const HTMX_CSS   = join(srcCssDir, 'hc.htmx.css');

const COMPONENTS = [
  'hc-button.css',
  'hc-input.css',
  'hc-select.css',
  'hc-datepicker.css',
  'hc-checkbox.css',
  'hc-radio.css',
  'hc-switch.css',
  'hc-slider.css',
  'hc-combobox.css',
  'hc-multicombobox.css',
  'hc-field.css',
  'hc-spinner.css',
  'hc-progress.css',
  'hc-skeleton.css',
  'hc-dialog.css',
  'hc-drawer.css',
  'hc-popover.css',
  'hc-card.css',
  'hc-table.css',
  'hc-avatar.css',
  'hc-badge.css',
  'hc-alert.css',
  'hc-toast.css',
  'hc-toolbar.css',
  'hc-pagination.css',
  'hc-tabs.css',
  'hc-toggle-group.css',
  'hc-menu.css',
  'hc-tooltip.css',
  'hc-hovercard.css',
  'hc-accordion.css',
  'hc-breadcrumb.css',
];

async function read(file) {
  return readFile(file, 'utf8');
}

async function main() {
  await mkdir(distDir, { recursive: true });

  const parts = [];
  parts.push('/* @hypermedia-components/core — hc.css bundle */');
  parts.push(await read(LAYER_DECL));
  parts.push(await read(TOKENS_CSS));
  parts.push(await read(BASE_CSS));
  for (const c of COMPONENTS) {
    parts.push(await read(join(srcCssDir, c)));
  }
  parts.push(await read(HTMX_CSS));

  const bundle = parts.join('\n') + '\n';
  await writeFile(join(distDir, 'hc.css'), bundle, 'utf8');

  // Also expose hc.base.css, hc.htmx.css, and per-component files at
  // dist root so the package "exports" map can point at them later.
  await copyFile(BASE_CSS, join(distDir, 'hc.base.css'));
  await copyFile(HTMX_CSS, join(distDir, 'hc.htmx.css'));
  for (const c of COMPONENTS) {
    await copyFile(join(srcCssDir, c), join(distDir, c));
  }

  console.log(`hc.css written (${bundle.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
