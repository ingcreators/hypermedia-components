#!/usr/bin/env node
// Produce minified, single-file bundles for CDN / importmap / no-bundler
// use, alongside the existing per-file ESM + CSS (which bundler users
// tree-shake). esbuild bundles the behavior modules into one self-
// contained file (no exposed relative-import graph) and minifies CSS.
//
// Runs after build:js. The unminified per-module / per-component files
// stay the primary, tree-shakeable surface; these are the convenience
// artifacts.

import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distDir = join(pkgRoot, 'dist');
const srcJs = join(pkgRoot, 'src', 'js');
const srcMacros = join(pkgRoot, 'src', 'macros');

const gz = (buf) => gzipSync(Buffer.from(buf), { level: 9 }).length;
const rows = [];

async function minifyCss(inFile, outFile) {
  const src = await readFile(join(distDir, inFile));
  const { code } = await transform(src, { loader: 'css', minify: true });
  await writeFile(join(distDir, outFile), code, 'utf8');
  rows.push([outFile, src.length, Buffer.byteLength(code), gz(code)]);
}

async function bundleJs(entry, outFile) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    legalComments: 'none',
  });
  const code = result.outputFiles[0].text;
  await writeFile(join(distDir, outFile), code, 'utf8');
  rows.push([outFile, '—', Buffer.byteLength(code), gz(code)]);
}

async function main() {
  await minifyCss('hc.css', 'hc.min.css');
  await minifyCss('hc.core.css', 'hc.core.min.css');
  await bundleJs(join(srcJs, 'behaviors.js'), 'hc.behaviors.min.js');
  await bundleJs(join(srcJs, 'index.js'), 'hc.min.js');
  await bundleJs(join(srcMacros, 'index.js'), join('macros', 'index.min.js'));

  console.log('minified artifacts (bytes):');
  console.log('  ' + 'file'.padEnd(24) + 'raw'.padStart(9) + 'min'.padStart(9) + 'min+gzip'.padStart(10));
  for (const [f, raw, min, g] of rows) {
    console.log('  ' + f.padEnd(24) + String(raw).padStart(9) + String(min).padStart(9) + String(g).padStart(10));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
