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
const CORE_TOKENS_CSS = join(distDir, 'hc.tokens.core.css');
const BASE_CSS   = join(srcCssDir, 'hc.base.css');
const HTMX_CSS   = join(srcCssDir, 'hc.htmx.css');
const A11Y_CSS   = join(srcCssDir, 'hc.a11y.css');
const UTILITIES_CSS = join(srcCssDir, 'hc.utilities.css');

const COMPONENTS = [
  'hc-button.css',
  'hc-button-group.css',
  'hc-input.css',
  'hc-select.css',
  'hc-datepicker.css',
  'hc-inputotp.css',
  'hc-checkbox.css',
  'hc-radio.css',
  'hc-switch.css',
  'hc-slider.css',
  'hc-combobox.css',
  'hc-multicombobox.css',
  'hc-input-group.css',
  'hc-field.css',
  'hc-spinner.css',
  'hc-progress.css',
  'hc-skeleton.css',
  'hc-separator.css',
  'hc-splitter.css',
  'hc-scroll-area.css',
  'hc-aspect.css',
  'hc-dialog.css',
  'hc-drawer.css',
  'hc-popover.css',
  'hc-card.css',
  'hc-empty.css',
  'hc-table.css',
  'hc-chart.css',
  'hc-datagrid.css',
  'hc-avatar.css',
  'hc-badge.css',
  'hc-item.css',
  'hc-kbd.css',
  'hc-alert.css',
  'hc-toast.css',
  'hc-toolbar.css',
  'hc-pagination.css',
  'hc-tabs.css',
  'hc-carousel.css',
  'hc-toggle-group.css',
  'hc-menu.css',
  'hc-menubar.css',
  'hc-navmenu.css',
  'hc-command.css',
  'hc-calendar.css',
  'hc-tooltip.css',
  'hc-hovercard.css',
  'hc-anchored.css',
  'hc-accordion.css',
  'hc-collapsible.css',
  'hc-breadcrumb.css',
  'hc-shell.css',
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
  parts.push(await read(A11Y_CSS));
  parts.push(await read(UTILITIES_CSS));
  parts.push(await read(HTMX_CSS));

  const bundle = parts.join('\n') + '\n';
  await writeFile(join(distDir, 'hc.css'), bundle, 'utf8');

  // hc.core.css — the foundation for granular usage: layer declaration
  // + core tokens (semantic + default density/colour + dark) + base.
  // Load this once, then add only the per-component CSS files you use.
  const coreParts = [
    '/* @hypermedia-components/core — hc.core.css (granular foundation) */',
    await read(LAYER_DECL),
    await read(CORE_TOKENS_CSS),
    await read(BASE_CSS),
  ];
  await writeFile(join(distDir, 'hc.core.css'), coreParts.join('\n') + '\n', 'utf8');

  // Also expose hc.base.css, hc.htmx.css, and per-component files at
  // dist root so the package "exports" map can point at them later.
  await copyFile(BASE_CSS, join(distDir, 'hc.base.css'));
  await copyFile(HTMX_CSS, join(distDir, 'hc.htmx.css'));
  await copyFile(A11Y_CSS, join(distDir, 'hc.a11y.css'));
  await copyFile(UTILITIES_CSS, join(distDir, 'hc.utilities.css'));
  for (const c of COMPONENTS) {
    await copyFile(join(srcCssDir, c), join(distDir, c));
  }

  console.log(`hc.css written (${bundle.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
