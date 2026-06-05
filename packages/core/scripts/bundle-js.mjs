#!/usr/bin/env node
// Copy ES modules from src/js and src/macros to dist with the names
// listed in the package "exports" map. No bundling, no transpiling —
// the source is already plain ESM that runs in modern browsers and Node.
//
// Also copies the matching .d.ts declarations emitted by `tsc` into
// dist/.types/ (see ../tsconfig.json) to the same flattened locations,
// so each runtime module ships with a sibling type definition.

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distDir = join(pkgRoot, 'dist');
const typesStaging = join(distDir, '.types');

// [source-relative-to-pkgRoot, dist-relative-to-distDir]
const FILES = [
  // Behaviors and main entry.
  ['src/js/index.js',         'index.js'],
  ['src/js/i18n.js',          'i18n.js'],
  ['src/js/anchor-fallback.js', 'anchor-fallback.js'],
  ['src/js/confirm.js',       'confirm.js'],
  ['src/js/toast.js',         'toast.js'],
  ['src/js/close-dialog.js',  'close-dialog.js'],
  ['src/js/close-popover.js', 'close-popover.js'],
  ['src/js/remote-dialog.js', 'remote-dialog.js'],
  ['src/js/tabs.js',          'tabs.js'],
  ['src/js/menu-core.js',     'menu-core.js'],
  ['src/js/menu.js',          'menu.js'],
  ['src/js/context-menu.js',  'context-menu.js'],
  ['src/js/command.js',       'command.js'],
  ['src/js/calendar.js',      'calendar.js'],
  ['src/js/inputotp.js',     'inputotp.js'],
  ['src/js/splitter.js',      'splitter.js'],
  ['src/js/tooltip.js',       'tooltip.js'],
  ['src/js/slider.js',        'slider.js'],
  ['src/js/combobox.js',      'combobox.js'],
  ['src/js/multicombobox.js', 'multicombobox.js'],
  ['src/js/drawer.js',        'drawer.js'],
  ['src/js/hovercard.js',    'hovercard.js'],
  ['src/js/toggle-group.js',  'toggle-group.js'],
  ['src/js/shell.js',         'shell.js'],
  ['src/js/datagrid.js',      'datagrid.js'],
  ['src/js/behaviors.js',     'hc.behaviors.js'],

  // Macros — kept under dist/macros/ so the entry module's relative
  // imports (./confirm-action.js, ./live-search.js) resolve correctly.
  ['src/macros/index.js',          'macros/index.js'],
  ['src/macros/confirm-action.js', 'macros/confirm-action.js'],
  ['src/macros/live-search.js',    'macros/live-search.js'],
];

function srcToTypesPath(srcRel) {
  // src/js/foo.js  → dist/.types/js/foo.d.ts
  // src/macros/bar.js → dist/.types/macros/bar.d.ts
  return join(typesStaging, srcRel.replace(/^src\//, '').replace(/\.js$/, '.d.ts'));
}

function distToTypesPath(distRel) {
  // index.js → index.d.ts; macros/index.js → macros/index.d.ts
  return distRel.replace(/\.js$/, '.d.ts');
}

async function main() {
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, 'macros'), { recursive: true });

  let jsCopied = 0;
  let dtsCopied = 0;
  for (const [from, to] of FILES) {
    await copyFile(join(pkgRoot, from), join(distDir, to));
    jsCopied += 1;

    const fromDts = srcToTypesPath(from);
    if (existsSync(fromDts)) {
      await copyFile(fromDts, join(distDir, distToTypesPath(to)));
      dtsCopied += 1;
    }
  }

  // Tidy up the tsc staging directory once its contents have been
  // flattened into dist/. Leaving it would publish duplicated d.ts
  // files under dist/.types/.
  if (existsSync(typesStaging)) {
    await rm(typesStaging, { recursive: true, force: true });
  }

  if (dtsCopied === 0) {
    console.log(
      `copied ${jsCopied} JS module(s) to dist/ (no .d.ts found — run \`pnpm run build:types\` first)`,
    );
  } else {
    console.log(`copied ${jsCopied} JS module(s) and ${dtsCopied} .d.ts file(s) to dist/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
