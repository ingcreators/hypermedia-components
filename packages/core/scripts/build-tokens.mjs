#!/usr/bin/env node
// CLI wrapper around the pure token transformer (token-transform.mjs).
//
// Reads the DTCG-shaped JSON sources from src/tokens, runs buildTokensCss,
// and writes dist/hc.tokens.css (full bundle), dist/hc.tokens.core.css
// (core axes), and one dist/hc.tokens.<axis>.css per non-default runtime
// axis. The transform itself is node-free so the docs theme builder can
// import it in the browser; this file owns all disk I/O.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  buildTokensCss,
  resolveTokens,
  DEFAULT_SOURCES,
  CORE_NAMESPACES,
  AXIS_NAMESPACES,
  NEUTRAL_RAMPS,
  emitOnly,
} from './token-transform.mjs';

// Re-export so existing importers (tests, tooling) keep working unchanged.
export { buildTokensCss, resolveTokens, DEFAULT_SOURCES, CORE_NAMESPACES, AXIS_NAMESPACES, NEUTRAL_RAMPS, emitOnly };

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

  await mkdir(distDir, { recursive: true });

  // Full bundle (all axes) — the easy, everything path.
  const full = buildTokensCss({ sources: DEFAULT_SOURCES, trees });
  await writeFile(join(distDir, 'hc.tokens.css'), full.css, 'utf8');

  // Core (semantic + base components + dark + default density/colour).
  const core = buildTokensCss({ sources: emitOnly(CORE_NAMESPACES), trees });
  await writeFile(join(distDir, 'hc.tokens.core.css'), core.css, 'utf8');

  // One file per non-default runtime axis: hc.tokens.color-indigo.css etc.
  const axisFiles = [];
  for (const ns of AXIS_NAMESPACES) {
    const out = buildTokensCss({ sources: emitOnly([ns]), trees });
    const file = `hc.tokens.${ns.replace('.', '-')}.css`;
    await writeFile(join(distDir, file), out.css, 'utf8');
    axisFiles.push(file);
  }

  // One file per non-default neutral ramp, carrying its light + dark blocks:
  // hc.tokens.neutral-slate.css etc.
  for (const ramp of NEUTRAL_RAMPS) {
    const out = buildTokensCss({ sources: emitOnly([`neutral.${ramp}`, `neutral.${ramp}.dark`]), trees });
    const file = `hc.tokens.neutral-${ramp}.css`;
    await writeFile(join(distDir, file), out.css, 'utf8');
    axisFiles.push(file);
  }

  console.log(
    `hc.tokens.css written (${full.varCount} vars across ${full.blockCount} blocks)\n` +
    `  + hc.tokens.core.css (${core.varCount} vars) and ${axisFiles.length} axis files: ${axisFiles.join(', ')}`,
  );
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
