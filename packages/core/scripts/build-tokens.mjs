#!/usr/bin/env node
// Token transformer for @hypermedia-components/core.
//
// Reads DTCG-shaped JSON sources from src/tokens, resolves `{a.b.c}`
// references across the four token layers, and emits dist/hc.tokens.css
// with `--hc-*` custom properties wrapped in `@layer hc.tokens`.
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
//
// The transformation is exported as buildTokensCss({ sources, trees })
// for testing; the CLI block at the bottom wires it up to disk I/O.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

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
  // Allow embedded refs like `0 0 0 2px {semantic.color.focus-ring}` later.
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
 *
 * Implementation: copy the base table, then for every leaf in the
 * theme tree, set table[`semantic.<leaf-path>`] = leaf's `$value`.
 */
function tableWithThemeOverlay(baseTable, themeNamespace, trees) {
  const overlay = new Map(baseTable);
  walkLeaves(trees[themeNamespace], [], (path, leaf) => {
    overlay.set(['semantic', ...path].join('.'), String(leaf.$value));
  });
  return overlay;
}

/**
 * Index every `semantic.<path>` that any runtime-themed source (a
 * `color.*` or `density.*` namespace) redefines. Component-layer
 * leaves whose resolution depends on any of these keys cannot be
 * baked into the static `:root { component }` block — their value
 * changes when a runtime theme is applied to a nested wrapper, so we
 * emit them inside each themed block instead.
 *
 * Returns: { themedAll: Set<key>, themedBySource: Map<namespace, Set<key>> }
 *  - themedAll: union across all themed sources, used when classifying
 *    component leaves for the `:root { component }` block.
 *  - themedBySource: per-namespace set so each themed block knows
 *    which component leaves it must additionally emit.
 */
function indexThemedKeys(sources, trees) {
  const themedAll = new Set();
  const themedBySource = new Map();
  for (const src of sources) {
    if (!src.namespace.startsWith('color.') && !src.namespace.startsWith('density.')) continue;
    const keys = new Set();
    walkLeaves(trees[src.namespace], [], (path) => {
      const key = ['semantic', ...path].join('.');
      keys.add(key);
      themedAll.add(key);
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

  // Pre-classify component leaves: those whose resolution path touches
  // any themed semantic key cannot be baked once on :root — they must
  // be redeclared inside each runtime-themed block with that theme's
  // resolved leaf value. Mirrors how shadcn/Radix Themes emit
  // component-scoped tokens (e.g. --card, --sidebar-primary) as plain
  // leaf values in every theme variant.
  const componentLeaves = []; // [{ path, value, deps }]
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
      // Only theme-independent component leaves on the static `:root`
      // block. Theme-dependent ones are re-emitted per themed block
      // below.
      for (const { path, raw, deps } of componentLeaves) {
        const isThemed = depsIntersect(deps, themedAll);
        if (isThemed) continue;
        lines.push(`${cssVarName(path)}: ${resolveValue(raw, table)};`);
      }
    } else if (themedBySource.has(src.namespace)) {
      // Themed sources (color.X / density.X). First emit the source's
      // own overrides, then append every component leaf whose
      // resolution depends on the *paths this source controls*. That
      // way `color.indigo` redeclares --hc-button-primary-bg etc., but
      // does not touch density-scoped component vars and vice-versa.
      walkLeaves(trees[src.namespace], [], (path, leaf) => {
        lines.push(`${cssVarName(path)}: ${resolveValue(String(leaf.$value), table)};`);
      });
      const ownedKeys = themedBySource.get(src.namespace);
      const themeTable = tableWithThemeOverlay(table, src.namespace, trees);
      for (const { path, raw, deps } of componentLeaves) {
        if (!depsIntersect(deps, ownedKeys)) continue;
        lines.push(`${cssVarName(path)}: ${resolveValue(raw, themeTable)};`);
      }
    } else {
      // Plain non-themed sources (semantic, theme.dark, …) — unchanged.
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

  // Count declarations only — `--hc-foo:` lines. Skip occurrences of
  // `--hc-` inside `var()` references on the right-hand side.
  const varCount = blocks.reduce((n, b) => n + (b.match(/--hc-[a-z0-9-]+:/g)?.length ?? 0), 0);
  return { css, varCount, blockCount: blocks.length };
}

// CLI default. Files and their output selectors. `emit: false` means
// values are loaded into the resolution table but never written to CSS.
export const DEFAULT_SOURCES = [
  { namespace: 'primitive', file: 'primitive.tokens.json', emit: false },
  { namespace: 'semantic',  file: 'semantic.tokens.json',  selector: ':root, [data-theme="light"]' },
  { namespace: 'component', file: 'component.tokens.json', selector: ':root' },
  { namespace: 'theme.dark', file: 'theme.dark.tokens.json', selector: '[data-theme="dark"]' },
  // Density layers override --hc-control-* at runtime via the
  // data-density attribute. Components that should respond to density
  // (button, input) reference --hc-control-* through a `var()`
  // indirection in their own tokens — see component.tokens.json.
  { namespace: 'density.comfortable', file: 'density.comfortable.tokens.json', selector: ':root, [data-density="comfortable"]' },
  { namespace: 'density.compact',     file: 'density.compact.tokens.json',     selector: '[data-density="compact"]' },
  { namespace: 'density.dense',       file: 'density.dense.tokens.json',       selector: '[data-density="dense"]' },
  // Colour themes override the accent palette (focus ring + action.primary).
  // The default theme is emitted under both :root and [data-color="default"]
  // so an explicit attribute behaves the same as the unset state. Each
  // theme's accent shade is chosen for WCAG-AA contrast on both light
  // and dark surfaces — no per-mode variants needed.
  { namespace: 'color.default', file: 'color.default.tokens.json', selector: ':root, [data-color="default"]' },
  { namespace: 'color.indigo',  file: 'color.indigo.tokens.json',  selector: '[data-color="indigo"]' },
  { namespace: 'color.emerald', file: 'color.emerald.tokens.json', selector: '[data-color="emerald"]' },
  { namespace: 'color.rose',    file: 'color.rose.tokens.json',    selector: '[data-color="rose"]' },
  { namespace: 'color.amber',   file: 'color.amber.tokens.json',   selector: '[data-color="amber"]' },
];

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, '..');
  const tokensDir = join(pkgRoot, 'src', 'tokens');
  const distDir = join(pkgRoot, 'dist');

  const trees = {};
  for (const src of DEFAULT_SOURCES) {
    const text = await readFile(join(tokensDir, src.file), 'utf8');
    trees[src.namespace] = JSON.parse(text);
  }

  const { css, varCount, blockCount } = buildTokensCss({
    sources: DEFAULT_SOURCES,
    trees,
  });

  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, 'hc.tokens.css'), css, 'utf8');

  console.log(`hc.tokens.css written (${varCount} vars across ${blockCount} blocks)`);
}

// Run main only when invoked as a script (not when imported by tests).
const invokedAsScript =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedAsScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
