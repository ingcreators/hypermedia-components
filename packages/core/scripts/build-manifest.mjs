// build-manifest.mjs — emit dist/manifest.json, the kit's structured
// index (plans/hc-machine-manifest-plan-en.md). Everything is extracted
// from the sources at build time; nothing here is hand-maintained
// except the two explicit maps below, and the build FAILS when a new
// install* export appears that neither auto-maps to a component nor is
// claimed in EXPLICIT_CLAIMS — so new API surface cannot ship without
// the manifest learning about it (mirrored by test/manifest.test.mjs).
//
// Output is deterministic: no timestamps, every array sorted, object
// keys written in a fixed order.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CORE, '..', '..');

/** Components whose behavior does not follow the name-normalization
 * rule (block name with dashes removed == install name lowercased). */
const EXPLICIT_BEHAVIOR = {
  chat: 'installChatScroll',
  toc: 'installSpy',
  'input-group': 'installPasswordToggle', // opt-in reveal; the group itself is CSS
  code: 'installCodeEditor', // the editable field; read-only code is pure CSS
  dialog: 'installCloseDialog', // close-on-success glue; <dialog> itself is native
};

/** install* exports that are not a component's own behavior: recipe
 * engines and platform glue. Keys are export names, values say where
 * the manifest surfaces them (a recipe name or 'platform'). */
const EXPLICIT_CLAIMS = {
  installConfirm: 'confirm-action',
  installRemoteDialog: 'remote-dialog',
  installClosePopover: 'filter-popover',
  installFieldErrors: 'field-errors',
  installUploadProgress: 'file-upload',
  installDatagridActions: 'datagrid-bulk-actions',
  installSseDispatch: 'sse-updates',
  installChart: 'chart',
  installCopy: 'copy',
  installShowWhen: 'conditional-fields',
  installValidation: 'platform', // native-validation wiring (field docs)
  installCsrfHeader: 'platform',
  installThemeToggle: 'platform',
  installNavCurrent: 'platform', // boosted-nav re-marking (shell docs)
};

const uniqueSorted = (arr) => [...new Set(arr)].sort();

async function read(rel) {
  return readFile(join(CORE, rel), 'utf8');
}

export async function buildManifest() {
  const pkg = JSON.parse(await read('package.json'));

  // --- behaviors -------------------------------------------------------
  const indexSrc = await read('src/js/index.js');
  const installs = uniqueSorted(
    [...indexSrc.matchAll(/\b(install[A-Z][A-Za-z]+)\b/g)].map((m) => m[1]),
  );
  const rosterSrc = await read('src/js/behaviors.js');
  const roster = new Set(
    [...rosterSrc.matchAll(/\b(install[A-Z][A-Za-z]+)\b/g)].map((m) => m[1]),
  );
  const behaviors = installs.map((name) => ({ name, autoInit: roster.has(name) }));

  /** Documented components with no stylesheet of their own (they reuse
   * another block's CSS); the css-file scan below cannot see them. */
  const VIRTUAL_COMPONENTS = [
    {
      block: 'hc-context-menu',
      parts: [],
      dataAttributes: ['data-hc-context-menu'],
      tokensGroup: null,
      behavior: 'installContextMenu',
      docsPath: 'components/context-menu',
    },
  ];

  // --- components ------------------------------------------------------
  const cssDir = join(CORE, 'src/css');
  const cssFiles = (await readdir(cssDir)).filter((f) => f.startsWith('hc-') && f.endsWith('.css'));
  const tokens = JSON.parse(await read('src/tokens/component.tokens.json'));
  const tokenGroups = new Set(Object.keys(tokens).filter((k) => !k.startsWith('$')));
  const byNormalized = new Map(installs.map((n) => [n.slice('install'.length).toLowerCase(), n]));

  const components = [];
  for (const file of cssFiles.sort()) {
    const block = file.slice(3, -4);
    const css = await readFile(join(cssDir, file), 'utf8');
    const parts = uniqueSorted(
      [...css.matchAll(new RegExp(`\\.hc-${block}__([a-z0-9-]+)`, 'g'))].map((m) => m[1]),
    );
    const dataAttributes = uniqueSorted(
      [...css.matchAll(/\[data-([a-z0-9-]+)/g)].map((m) => `data-${m[1]}`),
    );
    const behavior =
      EXPLICIT_BEHAVIOR[block] ?? byNormalized.get(block.replaceAll('-', '')) ?? null;
    components.push({
      block: `hc-${block}`,
      parts,
      dataAttributes,
      tokensGroup: tokenGroups.has(block) ? block : null,
      behavior,
      docsPath: `components/${block}`,
    });
  }
  components.push(...VIRTUAL_COMPONENTS);
  components.sort((a, b) => a.block.localeCompare(b.block));

  // --- events ----------------------------------------------------------
  const jsDir = join(CORE, 'src/js');
  const eventsByName = new Map();
  for (const file of (await readdir(jsDir)).filter((f) => f.endsWith('.js')).sort()) {
    const src = await readFile(join(jsDir, file), 'utf8');
    for (const m of src.matchAll(/'(hc:[a-z]+)'/g)) {
      if (!eventsByName.has(m[1])) eventsByName.set(m[1], new Set());
      eventsByName.get(m[1]).add(file.replace(/\.js$/, ''));
    }
  }
  const events = [...eventsByName.keys()].sort().map((name) => ({
    name,
    modules: [...eventsByName.get(name)].sort(),
  }));

  // --- recipes -----------------------------------------------------------
  const recipesRoot = join(REPO, 'recipes');
  const recipeDirs = (await readdir(recipesRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && existsSync(join(recipesRoot, e.name, 'recipe.html')))
    .map((e) => e.name)
    .sort();
  const recipes = [];
  for (const name of recipeDirs) {
    const contract = await readFile(join(recipesRoot, name, 'contract.md'), 'utf8').catch(() => '');
    const purpose = contract.match(/^Purpose:\s*(.+)$/m)?.[1]?.trim() ?? '';
    const checks = JSON.parse(
      await readFile(join(recipesRoot, name, 'checks.json'), 'utf8').catch(() => '{}'),
    );
    // Behavior glue is derivable when the machine contract detects via a
    // data-hc-* attribute whose camelized name matches an install export.
    let needsBehavior = null;
    const glue = String(checks.detect ?? '').match(/data-hc-([a-z-]+)/);
    if (glue) {
      const candidate = byNormalized.get(glue[1].replaceAll('-', ''));
      if (candidate) needsBehavior = candidate;
    }
    // Explicit claims (recipe engines whose detect is not their glue attr).
    for (const [exp, claim] of Object.entries(EXPLICIT_CLAIMS)) {
      if (claim === name) needsBehavior = needsBehavior ?? exp;
    }
    const files = ['recipe.html', 'expanded.html', 'contract.md', 'checks.json'].filter((f) =>
      existsSync(join(recipesRoot, name, f)),
    );
    recipes.push({
      name,
      purpose,
      needsBehavior,
      files,
      docsPath: `recipes/${name}`,
      contractPath: `recipes/${name}/contract.md`,
    });
  }

  // --- macros ------------------------------------------------------------
  const macros = [];
  for (const [tag, file] of [
    ['hc-confirm-action', 'src/macros/confirm-action.js'],
    ['hc-live-search', 'src/macros/live-search.js'],
  ]) {
    const src = await read(file);
    const attributes = uniqueSorted(
      [...src.matchAll(/getAttribute\('([a-z-]+)'\)/g)].map((m) => m[1]),
    );
    macros.push({ tag, attributes });
  }

  // --- i18n --------------------------------------------------------------
  const { DEFAULT_MESSAGES } = await import(join(CORE, 'src/js/i18n.js'));
  const i18nKeys = Object.keys(DEFAULT_MESSAGES).sort();

  // --- completeness: every install export must be claimed -----------------
  const claimed = new Set([
    ...components.map((c) => c.behavior).filter(Boolean),
    ...Object.keys(EXPLICIT_CLAIMS),
  ]);
  const unclaimed = installs.filter((n) => !claimed.has(n));
  if (unclaimed.length > 0) {
    throw new Error(
      `manifest: unclaimed behavior export(s): ${unclaimed.join(', ')} — map them to a component (EXPLICIT_BEHAVIOR), a recipe, or 'platform' (EXPLICIT_CLAIMS) in scripts/build-manifest.mjs.`,
    );
  }
  const stale = Object.keys(EXPLICIT_CLAIMS).filter((n) => !installs.includes(n));
  if (stale.length > 0) {
    throw new Error(`manifest: EXPLICIT_CLAIMS lists unknown export(s): ${stale.join(', ')}.`);
  }

  return {
    $schema: 'https://ingcreators.com/hypermedia-components/api/manifest-schema-v1',
    name: pkg.name,
    version: pkg.version,
    docsBase: 'https://ingcreators.com/hypermedia-components/',
    components,
    behaviors,
    events,
    recipes,
    macros,
    i18nKeys,
    exports: Object.keys(pkg.exports).sort(),
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const manifest = await buildManifest();
  await mkdir(join(CORE, 'dist'), { recursive: true });
  const out = join(CORE, 'dist/manifest.json');
  await writeFile(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `manifest.json written (${manifest.components.length} components, ${manifest.behaviors.length} behaviors, ${manifest.recipes.length} recipes, ${manifest.events.length} events)`,
  );
}
