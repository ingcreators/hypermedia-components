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
  ['src/js/locales/ja.js',    'locales/ja.js'],
  ['src/js/anchor-fallback.js', 'anchor-fallback.js'],
  ['src/js/validation.js',    'validation.js'],
  ['src/js/theme-toggle.js',  'theme-toggle.js'],
  ['src/js/field-error-core.js', 'field-error-core.js'],
  ['src/js/field-errors.js',  'field-errors.js'],
  ['src/js/csrf-header.js',   'csrf-header.js'],
  ['src/js/sse-dispatch.js',  'sse-dispatch.js'],
  ['src/js/upload-progress.js', 'upload-progress.js'],
  ['src/js/dropzone.js',      'dropzone.js'],
  ['src/js/chat-scroll.js',   'chat-scroll.js'],
  ['src/js/tree.js',          'tree.js'],
  ['src/js/copy.js',          'copy.js'],
  ['src/js/spy.js',           'spy.js'],
  ['src/js/nav-current.js',   'nav-current.js'],
  ['src/js/confirm.js',       'confirm.js'],
  ['src/js/toast.js',         'toast.js'],
  ['src/js/close-dialog.js',  'close-dialog.js'],
  ['src/js/close-popover.js', 'close-popover.js'],
  ['src/js/remote-dialog.js', 'remote-dialog.js'],
  ['src/js/tabs.js',          'tabs.js'],
  ['src/js/menu-core.js',     'menu-core.js'],
  ['src/js/submenu.js',       'submenu.js'],
  ['src/js/menu.js',          'menu.js'],
  ['src/js/menubar.js',       'menubar.js'],
  ['src/js/navmenu.js',       'navmenu.js'],
  ['src/js/context-menu.js',  'context-menu.js'],
  ['src/js/command.js',       'command.js'],
  ['src/js/calendar.js',      'calendar.js'],
  ['src/js/inputotp.js',     'inputotp.js'],
  ['src/js/splitter.js',      'splitter.js'],
  ['src/js/tooltip.js',       'tooltip.js'],
  ['src/js/popover.js',       'popover.js'],
  ['src/js/slider.js',        'slider.js'],
  ['src/js/range.js',         'range.js'],
  ['src/js/combobox.js',      'combobox.js'],
  ['src/js/multicombobox.js', 'multicombobox.js'],
  ['src/js/drawer.js',        'drawer.js'],
  ['src/js/hovercard.js',    'hovercard.js'],
  ['src/js/toggle-group.js',  'toggle-group.js'],
  ['src/js/carousel.js',      'carousel.js'],
  ['src/js/toolbar.js',       'toolbar.js'],
  ['src/js/avatar.js',        'avatar.js'],
  ['src/js/password-toggle.js', 'password-toggle.js'],
  ['src/js/shell.js',         'shell.js'],
  ['src/js/datagrid.js',      'datagrid.js'],
  ['src/js/datagrid-actions.js', 'datagrid-actions.js'],
  ['src/js/chart.js',         'chart.js'],
  ['src/js/sparkline.js',     'sparkline.js'],
  ['src/js/code-editor.js',   'code-editor.js'],
  ['src/js/code-syntax.js',   'code-syntax.js'],
  ['src/js/show-when.js',     'show-when.js'],
  ['src/js/sortable.js',      'sortable.js'],
  ['src/js/format.js',        'format.js'],
  ['src/js/mask.js',          'mask.js'],
  ['src/js/dirty-guard.js',   'dirty-guard.js'],
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
  await mkdir(join(distDir, 'locales'), { recursive: true });

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
