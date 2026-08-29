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
  installSortable: 'sortable',
  installDirtyGuard: 'unsaved-changes',
  installSessionExpiry: 'session-expiry',
  installNetworkRetry: 'network-retry',
  installValidation: 'platform', // native-validation wiring (field docs)
  installFormat: 'platform', // numeric display formatting (input docs)
  installNormalize: 'platform', // IME fullwidth/kana normalization (input docs)
  installMask: 'postal-address',
  installMultiValue: 'datagrid-filter', // pasted lists → repeated params
  installRangeValue: 'platform', // range condition wire shaping (datagrid-filter docs)
  installSortList: 'datagrid-sort', // the sort control's ordered keys → one param
  installRowLink: 'row-detail', // Enter follows the row's primary link
  installCsrfHeader: 'platform',
  installThemeToggle: 'platform',
  installNavCurrent: 'platform', // boosted-nav re-marking (shell docs)
  installTime: 'platform', // client-side <time> localization (i18n docs)
};

/** Editor-canvas composition metadata (#447): per block, the parts
 * whose DOM element accepts arbitrary flow children in an editor
 * ('' marks the block root itself). Structured components (datagrid,
 * tabs, menu, …) deliberately list nothing — their internals need
 * component-aware editing. Hand-curated (not derivable from CSS) but
 * validated against the extracted parts below, so a typo cannot ship. */
const CONTAINER_PARTS = {
  card: ['body', 'footer'],
  dialog: ['body', 'footer'],
  drawer: ['body', 'footer'],
  hovercard: ['body'],
  popover: [''],
  collapsible: ['content'],
  shell: ['main'],
};

/** Layout utilities whose root element is an editor container. The
 * remaining utilities (icon, spacer, sr-only, …) are leaves. */
const CONTAINER_UTILITIES = new Set([
  'hc-cluster',
  'hc-container',
  'hc-grid',
  'hc-sidebar',
  'hc-stack',
]);

/** Blocks whose scriptless render does NOT look like the initialized
 * component at rest (#450) — everything else achieves its resting
 * state from markup + CSS alone (native popover/<dialog>/<details>,
 * aria-driven CSS, hidden attributes). The four here: calendar (the
 * grid is JS-built from an empty shell — datepicker's popover shell
 * included), carousel (pagination dots are JS-built; slides render),
 * chart (the table fallback is the DESIGNED scriptless state), and
 * code (the editable field degrades to an unhighlighted textarea).
 * Scriptless consumers (sandboxed canvases, screenshots, print) can
 * badge these as approximate instead of guessing. */
const STATIC_UNSAFE = new Set(['calendar', 'carousel', 'chart', 'code']);

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
      attributeValues: {},
      cssVars: [],
      containers: [],
      staticSafe: true,
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
    // Enumerated attribute values ([data-variant="primary"] → the
    // inspector-facing value set). Only value-carrying selectors
    // contribute; bare presence attributes stay out of the map.
    const valueSets = new Map();
    for (const m of css.matchAll(
      /\[data-([a-z0-9-]+)[~^|$*]?=(?:"([^"]*)"|'([^']*)'|([a-z0-9-]+))/g,
    )) {
      const attr = `data-${m[1]}`;
      if (!valueSets.has(attr)) valueSets.set(attr, new Set());
      valueSets.get(attr).add(m[2] ?? m[3] ?? m[4]);
    }
    const attributeValues = Object.fromEntries(
      [...valueSets.keys()].sort().map((attr) => [attr, [...valueSets.get(attr)].sort()]),
    );
    // The themable surface: every --hc-* custom property the sheet
    // reads. Includes per-instance knobs (vars consumed with a
    // fallback and defined nowhere in the tokens).
    const cssVars = uniqueSorted(
      [...css.matchAll(/var\(\s*(--hc-[a-z0-9-]+)/g)].map((m) => m[1]),
    );
    const containers = [...(CONTAINER_PARTS[block] ?? [])].sort();
    for (const part of containers) {
      if (part !== '' && !parts.includes(part)) {
        throw new Error(
          `manifest: CONTAINER_PARTS lists unknown part "${part}" for hc-${block}.`,
        );
      }
    }
    const behavior =
      EXPLICIT_BEHAVIOR[block] ?? byNormalized.get(block.replaceAll('-', '')) ?? null;
    components.push({
      block: `hc-${block}`,
      parts,
      dataAttributes,
      attributeValues,
      cssVars,
      containers,
      staticSafe: !STATIC_UNSAFE.has(block),
      tokensGroup: tokenGroups.has(block) ? block : null,
      behavior,
      docsPath: `components/${block}`,
    });
  }
  components.push(...VIRTUAL_COMPONENTS);
  components.sort((a, b) => a.block.localeCompare(b.block));

  const knownBlocks = new Set(cssFiles.map((f) => f.slice(3, -4)));
  const unknownContainerBlocks = Object.keys(CONTAINER_PARTS).filter((b) => !knownBlocks.has(b));
  if (unknownContainerBlocks.length > 0) {
    throw new Error(
      `manifest: CONTAINER_PARTS lists unknown block(s): ${unknownContainerBlocks.join(', ')}.`,
    );
  }

  // --- utilities -------------------------------------------------------
  // The layout/helper utility classes (hc.utilities.css) are not blocks,
  // but editors need to know which of them are containers (#447).
  const utilitiesCss = await read('src/css/hc.utilities.css');
  const utilityClasses = uniqueSorted(
    [...utilitiesCss.matchAll(/\.(hc-[a-z0-9-]+)/g)].map((m) => m[1]),
  );
  const unknownUtilities = [...CONTAINER_UTILITIES].filter((u) => !utilityClasses.includes(u));
  if (unknownUtilities.length > 0) {
    throw new Error(
      `manifest: CONTAINER_UTILITIES lists unknown class(es): ${unknownUtilities.join(', ')}.`,
    );
  }
  const utilities = utilityClasses.map((cls) => ({
    class: cls,
    container: CONTAINER_UTILITIES.has(cls),
  }));

  const blockSet = new Set(cssFiles.map((f) => f.slice(3, -4)));
  const unknownStatic = [...STATIC_UNSAFE].filter((b) => !blockSet.has(b));
  if (unknownStatic.length > 0) {
    throw new Error(
      `manifest: STATIC_UNSAFE lists unknown block(s): ${unknownStatic.join(', ')}.`,
    );
  }

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
    utilities,
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
