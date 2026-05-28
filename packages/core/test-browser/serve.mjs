#!/usr/bin/env node
// Static server for the browser-test fixtures.
//
// Mirrors the alias map used by examples/ — serves files from
// test-browser/fixtures and proxies /hc.* and /macros/* to the
// freshly-built dist of @hypermedia-components/core.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, resolve, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'fixtures');
const coreDist = resolve(here, '..', 'dist');

const PORT = Number(process.env.PORT) || 4400;

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
  ['/tabs.js',          join(coreDist, 'tabs.js')],
  ['/macros/index.js',          join(coreDist, 'macros', 'index.js')],
  ['/macros/confirm-action.js', join(coreDist, 'macros', 'confirm-action.js')],
  ['/macros/live-search.js',    join(coreDist, 'macros', 'live-search.js')],
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
};

function resolveLocal(urlPath) {
  if (ASSET_ALIASES.has(urlPath)) return ASSET_ALIASES.get(urlPath);
  let p = urlPath === '/' ? '/index.html' : urlPath;
  p = normalize(p).replace(/^[\\/]+/, '');
  const full = resolve(root, p);
  if (!full.startsWith(root)) return null;
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
  try { s = statSync(file); } catch { res.statusCode = 404; return res.end('Not found'); }
  if (s.isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`test-browser fixtures: http://localhost:${PORT}/`);
});
