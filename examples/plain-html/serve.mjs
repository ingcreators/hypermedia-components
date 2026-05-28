#!/usr/bin/env node
// Tiny static server for the plain-html example.
//
// Serves files from this directory and aliases /hc.css, /hc.tokens.css,
// /hc.htmx.css, and /hc.behaviors.js to the workspace dist of
// @hypermedia-components/core. No external dependencies.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, resolve, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = here;
const coreDist = resolve(here, '..', '..', 'packages', 'core', 'dist');

const PORT = Number(process.env.PORT) || 4322;

const ASSET_ALIASES = new Map([
  ['/hc.css',          join(coreDist, 'hc.css')],
  ['/hc.tokens.css',   join(coreDist, 'hc.tokens.css')],
  ['/hc.htmx.css',     join(coreDist, 'hc.htmx.css')],
  ['/hc.behaviors.js',  join(coreDist, 'hc.behaviors.js')],
  ['/confirm.js',       join(coreDist, 'confirm.js')],
  ['/toast.js',         join(coreDist, 'toast.js')],
  ['/close-dialog.js',  join(coreDist, 'close-dialog.js')],
  ['/close-popover.js', join(coreDist, 'close-popover.js')],
  ['/remote-dialog.js', join(coreDist, 'remote-dialog.js')],
  // Macros: expose dist/macros/ at /macros/ so relative imports
  // (./confirm-action.js, ./live-search.js) resolve correctly.
  ['/macros/index.js',          join(coreDist, 'macros', 'index.js')],
  ['/macros/confirm-action.js', join(coreDist, 'macros', 'confirm-action.js')],
  ['/macros/live-search.js',    join(coreDist, 'macros', 'live-search.js')],
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
};

function resolveLocal(urlPath) {
  if (ASSET_ALIASES.has(urlPath)) return ASSET_ALIASES.get(urlPath);
  let p = urlPath === '/' ? '/index.html' : urlPath;
  p = normalize(p).replace(/^[\\/]+/, '');
  const full = resolve(root, p);
  if (!full.startsWith(root)) return null; // path traversal guard
  return full;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = resolveLocal(url.pathname);
  if (!file) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  let s;
  try {
    s = statSync(file);
  } catch {
    res.statusCode = 404;
    return res.end('Not found');
  }
  if (s.isDirectory()) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`plain-html example: http://localhost:${PORT}/`);
  console.log(`  serving:   ${root}`);
  console.log(`  hc assets: ${coreDist}`);
  if (!safeExists(join(coreDist, 'hc.css'))) {
    console.warn('  ⚠  hc.css not found — run `pnpm -w run build` first.');
  }
});

function safeExists(p) {
  try { statSync(p); return true; } catch { return false; }
}
