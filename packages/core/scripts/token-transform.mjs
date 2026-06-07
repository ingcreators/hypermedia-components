// Pure token transformer for @hypermedia-components/core.
//
// No Node.js dependencies — safe to import in a browser bundle (the docs
// theme builder reuses `buildTokensCss` to generate custom themes from the
// real DTCG sources). The CLI wrapper that does disk I/O lives in
// build-tokens.mjs.
//
// Reads DTCG-shaped token trees, resolves `{a.b.c}` references across the
// layers, and returns CSS text with `--hc-*` custom properties wrapped in
// `@layer hc.tokens`.
//
// Output rules
// - Each top-level token file becomes one selector block.
// - Variable names drop the file's namespace and join the remaining JSON
//   path with hyphens, prefixed with `--hc-`. Example:
//     semantic.tokens.json -> color.action.primary.bg
//       -> --hc-color-action-primary-bg
//     component.tokens.json -> button.primary.bg
//       -> --hc-button-primary-bg
// - primitive.tokens.json is loaded for reference resolution only; its
//   values are not emitted.

const REF_RE = /^\{([^}]+)\}$/;

function isTokenLeaf(node) {
  return node && typeof node === 'object' && '$value' in node;
}

/** Walk a token tree; call cb(path, leaf) for every token leaf. */
function walkLeaves(node, path, cb) {
  if (!node || typeof node !== 'object') return;
  if (isTokenLeaf(node)) {
    cb(path, node);
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    walkLeaves(child, path.concat(key), cb);
  }
}

/** Build a flat map: "namespace.dot.path" -> raw $value (string). */
function indexTokens(sources, trees) {
  const map = new Map();
  for (const src of sources) {
    walkLeaves(trees[src.namespace], [], (path, leaf) => {
      const key = [src.namespace, ...path].join('.');
      map.set(key, String(leaf.$value));
    });
  }
  return map;
}

/** Resolve `{ref}` (whole-value) and any inline `{ref}` substrings. */
function resolveValue(raw, table, stack = []) {
  const fullMatch = raw.match(REF_RE);
  if (fullMatch) {
    const ref = fullMatch[1];
    if (stack.includes(ref)) {
      throw new Error(`Circular token reference: ${[...stack, ref].join(' -> ')}`);
    }
    const target = table.get(ref);
    if (target == null) {
      throw new Error(`Unknown token reference: {${ref}}`);
    }
    return resolveValue(target, table, [...stack, ref]);
  }
  // Allow embedded refs like `0 0 0 2px {semantic.color.focus-ring}`.
  return raw.replace(/\{([^}]+)\}/g, (_, ref) => {
    const target = table.get(ref);
    if (target == null) throw new Error(`Unknown token reference: {${ref}}`);
    return resolveValue(target, table, [...stack, ref]);
  });
}

/**
 * Collect every reference key reachable from `raw`, transitively through
 * the table. Used to classify component leaves as theme-independent
 * (no deps on themed semantic keys) vs theme-dependent.
 */
function collectDeps(raw, table, stack = [], deps = new Set()) {
  const fullMatch = raw.match(REF_RE);
  if (fullMatch) {
    const ref = fullMatch[1];
    deps.add(ref);
    if (stack.includes(ref)) return deps;
    const target = table.get(ref);
    if (target != null) collectDeps(target, table, [...stack, ref], deps);
    return deps;
  }
  for (const m of raw.matchAll(/\{([^}]+)\}/g)) {
    const ref = m[1];
    deps.add(ref);
    if (stack.includes(ref)) continue;
    const target = table.get(ref);
    if (target != null) collectDeps(target, table, [...stack, ref], deps);
  }
  return deps;
}

/**
 * For a runtime-themed source like `color.indigo`, build a resolution
 * table that re-routes every `semantic.<path>` key the source overrides
 * to that source's own value. Used to compute the leaf value of a
 * theme-dependent component token *as if that theme were active*.
 */
function tableWithThemeOverlay(baseTable, themeNamespaces, trees) {
  const list = Array.isArray(themeNamespaces) ? themeNamespaces : [themeNamespaces];
  const overlay = new Map(baseTable);
  // Apply each namespace in order; later ones win (e.g. dark then neutral,
  // so a [data-theme="dark"][data-neutral="slate"] block resolves component
  // leaves with slate-dark surfaces on top of the dark baseline).
  for (const ns of list) {
    walkLeaves(trees[ns], [], (path, leaf) => {
      overlay.set(['semantic', ...path].join('.'), String(leaf.$value));
    });
  }
  return overlay;
}

/**
 * Index every `semantic.<path>` that a themed source redefines, so the
 * component layer knows which leaves are theme-dependent.
 *
 *  - Runtime axes (`color.*` / `density.*`) can be applied to a nested
 *    wrapper, so an affected component leaf is lifted out of the static
 *    `:root { component }` block (themedAll) and re-emitted inside each
 *    axis block.
 *  - Override layers (`theme.dark`, `neutral.*`) keep the `:root` default
 *    and override on top via their own selector. Their keys go in
 *    themedBySource (so the block re-emits affected leaves) but NOT in
 *    themedAll (so the default value stays on `:root`). The neutral axis is
 *    an override layer rather than a runtime axis because it redefines the
 *    same surface/text/border keys dark mode does — those must remain on
 *    `:root` for the default (gray) neutral.
 *
 * Returns: { themedAll: Set<key>, themedBySource: Map<namespace, Set<key>> }
 */
function indexThemedKeys(sources, trees) {
  const themedAll = new Set();
  const themedBySource = new Map();
  for (const src of sources) {
    const isRuntimeAxis =
      src.namespace.startsWith('color.') || src.namespace.startsWith('density.');
    const isOverrideLayer =
      src.namespace === 'theme.dark' || src.namespace.startsWith('neutral.');
    if (!isRuntimeAxis && !isOverrideLayer) continue;
    const keys = new Set();
    walkLeaves(trees[src.namespace], [], (path) => {
      const key = ['semantic', ...path].join('.');
      keys.add(key);
      if (isRuntimeAxis) themedAll.add(key);
    });
    themedBySource.set(src.namespace, keys);
  }
  return { themedAll, themedBySource };
}

function depsIntersect(deps, set) {
  for (const d of deps) if (set.has(d)) return true;
  return false;
}

function cssVarName(jsonPath) {
  return '--hc-' + jsonPath.join('-');
}

function emitBlock(selector, lines) {
  return `${selector} {\n${lines.map((l) => '  ' + l).join('\n')}\n}\n`;
}

/**
 * Build the hc.tokens.css text from in-memory token trees.
 *
 * @param {Object} opts
 * @param {Array<{namespace: string, selector?: string, emit?: boolean}>} opts.sources
 *   Ordered list of token layers. Sources with `emit: false` only feed
 *   reference resolution; their values are never written.
 * @param {Record<string, unknown>} opts.trees
 *   Parsed token trees keyed by namespace.
 * @returns {{ css: string, varCount: number, blockCount: number }}
 */
export function buildTokensCss({ sources, trees }) {
  const table = indexTokens(sources, trees);
  const { themedAll, themedBySource } = indexThemedKeys(sources, trees);

  // Pre-classify component leaves: those whose resolution path touches any
  // themed semantic key cannot be baked once on :root — they must be
  // redeclared inside each runtime-themed block with that theme's resolved
  // leaf value. Mirrors how shadcn / Radix Themes emit component-scoped
  // tokens (e.g. --card, --sidebar-primary) as plain leaf values in every
  // theme variant.
  const componentLeaves = []; // [{ path, raw, deps }]
  if (trees.component) {
    walkLeaves(trees.component, [], (path, leaf) => {
      const raw = String(leaf.$value);
      const deps = collectDeps(raw, table);
      componentLeaves.push({ path, raw, deps });
    });
  }

  const blocks = [];
  for (const src of sources) {
    if (src.emit === false) continue;
    const lines = [];

    if (src.namespace === 'component') {
      // Only theme-independent component leaves on the static `:root` block.
      for (const { path, raw, deps } of componentLeaves) {
        const isThemed = depsIntersect(deps, themedAll);
        if (isThemed) continue;
        lines.push(`${cssVarName(path)}: ${resolveValue(raw, table)};`);
      }
    } else if (themedBySource.has(src.namespace)) {
      // Themed sources (color.X / density.X / theme.dark / neutral.X): emit
      // the source's own overrides, then append every component leaf whose
      // resolution depends on the paths this source controls. `src.overlay`
      // lets a compound block resolve through several layers — e.g. the
      // [data-theme="dark"][data-neutral="slate"] block overlays the dark
      // baseline and then the slate-dark surfaces.
      walkLeaves(trees[src.namespace], [], (path, leaf) => {
        lines.push(`${cssVarName(path)}: ${resolveValue(String(leaf.$value), table)};`);
      });
      const ownedKeys = themedBySource.get(src.namespace);
      const themeTable = tableWithThemeOverlay(table, src.overlay ?? [src.namespace], trees);
      for (const { path, raw, deps } of componentLeaves) {
        if (!depsIntersect(deps, ownedKeys)) continue;
        lines.push(`${cssVarName(path)}: ${resolveValue(raw, themeTable)};`);
      }
    } else {
      // Plain non-themed sources (semantic, …).
      walkLeaves(trees[src.namespace], [], (path, leaf) => {
        lines.push(`${cssVarName(path)}: ${resolveValue(String(leaf.$value), table)};`);
      });
    }

    if (lines.length === 0) continue;
    blocks.push(emitBlock(src.selector, lines));
  }

  const banner =
    '/* Generated by packages/core/scripts/build-tokens.mjs. Do not edit by hand. */\n';
  const css =
    banner +
    '@layer hc.tokens {\n' +
    blocks.map((b) => b.replace(/^/gm, '  ').replace(/^ {2}$/gm, '')).join('\n') +
    '}\n';

  // Count declarations only — `--hc-foo:` lines. Skip `--hc-` inside var().
  const varCount = blocks.reduce((n, b) => n + (b.match(/--hc-[a-z0-9-]+:/g)?.length ?? 0), 0);
  return { css, varCount, blockCount: blocks.length };
}

// File list and output selectors. `emit: false` means values are loaded
// into the resolution table but never written to CSS.
export const DEFAULT_SOURCES = [
  { namespace: 'primitive', file: 'primitive.tokens.json', emit: false },
  { namespace: 'semantic',  file: 'semantic.tokens.json',  selector: ':root, [data-theme="light"]' },
  { namespace: 'component', file: 'component.tokens.json', selector: ':root' },
  { namespace: 'theme.dark', file: 'theme.dark.tokens.json', selector: '[data-theme="dark"]' },
  { namespace: 'density.comfortable', file: 'density.comfortable.tokens.json', selector: ':root, [data-density="comfortable"]' },
  { namespace: 'density.compact',     file: 'density.compact.tokens.json',     selector: '[data-density="compact"]' },
  { namespace: 'density.dense',       file: 'density.dense.tokens.json',       selector: '[data-density="dense"]' },
  { namespace: 'color.default', file: 'color.default.tokens.json', selector: ':root, [data-color="default"]' },
  { namespace: 'color.indigo',  file: 'color.indigo.tokens.json',  selector: '[data-color="indigo"]' },
  { namespace: 'color.emerald', file: 'color.emerald.tokens.json', selector: '[data-color="emerald"]' },
  { namespace: 'color.rose',    file: 'color.rose.tokens.json',    selector: '[data-color="rose"]' },
  { namespace: 'color.amber',   file: 'color.amber.tokens.json',   selector: '[data-color="amber"]' },
  // Neutral axis: swaps the surface / text / border / secondary ramp.
  // Unlike colour, neutrals differ by light/dark, so each non-default ramp
  // ships a light block and a compound dark block. `overlay` lets the dark
  // block resolve component leaves through the dark baseline then the
  // slate-dark surfaces. gray is the default (the :root / theme.dark base),
  // so it needs no block.
  { namespace: 'neutral.slate',        file: 'neutral.slate.tokens.json',        selector: '[data-neutral="slate"]' },
  { namespace: 'neutral.slate.dark',   file: 'neutral.slate.dark.tokens.json',   selector: '[data-theme="dark"][data-neutral="slate"]',   overlay: ['theme.dark', 'neutral.slate.dark'] },
  { namespace: 'neutral.zinc',         file: 'neutral.zinc.tokens.json',         selector: '[data-neutral="zinc"]' },
  { namespace: 'neutral.zinc.dark',    file: 'neutral.zinc.dark.tokens.json',    selector: '[data-theme="dark"][data-neutral="zinc"]',    overlay: ['theme.dark', 'neutral.zinc.dark'] },
  { namespace: 'neutral.neutral',      file: 'neutral.neutral.tokens.json',      selector: '[data-neutral="neutral"]' },
  { namespace: 'neutral.neutral.dark', file: 'neutral.neutral.dark.tokens.json', selector: '[data-theme="dark"][data-neutral="neutral"]', overlay: ['theme.dark', 'neutral.neutral.dark'] },
  { namespace: 'neutral.stone',        file: 'neutral.stone.tokens.json',        selector: '[data-neutral="stone"]' },
  { namespace: 'neutral.stone.dark',   file: 'neutral.stone.dark.tokens.json',   selector: '[data-theme="dark"][data-neutral="stone"]',   overlay: ['theme.dark', 'neutral.stone.dark'] },
];

// The "core" axes every consumer needs: the semantic base, the
// theme-independent component leaves, dark mode, and the default density /
// color blocks. The remaining axes ship as their own files.
export const CORE_NAMESPACES = ['semantic', 'component', 'theme.dark', 'density.comfortable', 'color.default'];
export const AXIS_NAMESPACES = ['density.compact', 'density.dense', 'color.indigo', 'color.emerald', 'color.rose', 'color.amber'];

// Non-default neutral ramps. Each ships as one axis file carrying both its
// light and compound-dark blocks.
export const NEUTRAL_RAMPS = ['slate', 'zinc', 'neutral', 'stone'];

/**
 * Re-flag DEFAULT_SOURCES so only `names` are emitted; the rest stay in the
 * list (for `{ref}` resolution + consistent themed-leaf classification) but
 * are skipped on output. primitive is never emitted.
 */
export function emitOnly(names) {
  const set = new Set(names);
  return DEFAULT_SOURCES.map((s) => ({ ...s, emit: s.emit === false ? false : set.has(s.namespace) }));
}
