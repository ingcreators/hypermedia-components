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
const repoRoot = resolve(here, '..', '..', '..');

const PORT = Number(process.env.PORT) || 4400;

const ASSET_ALIASES = new Map([
  // Real htmx (the copy vendored for examples/htmx, pinned 2.0.4) so
  // integration fixtures can exercise actual htmx requests offline.
  ['/htmx.min.js',     join(repoRoot, 'examples', 'htmx', 'vendor', 'htmx.min.js')],
  ['/hc.css',          join(coreDist, 'hc.css')],
  ['/hc.tokens.css',   join(coreDist, 'hc.tokens.css')],
  ['/hc.htmx.css',     join(coreDist, 'hc.htmx.css')],
  ['/hc.behaviors.js',  join(coreDist, 'hc.behaviors.js')],
  ['/hc.behaviors.min.js', join(coreDist, 'hc.behaviors.min.js')],
  ['/hc.min.js',        join(coreDist, 'hc.min.js')],
  ['/i18n.js',          join(coreDist, 'i18n.js')],
  ['/anchor-fallback.js', join(coreDist, 'anchor-fallback.js')],
  ['/validation.js',    join(coreDist, 'validation.js')],
  ['/theme-toggle.js',  join(coreDist, 'theme-toggle.js')],
  ['/field-error-core.js', join(coreDist, 'field-error-core.js')],
  ['/field-errors.js',  join(coreDist, 'field-errors.js')],
  ['/csrf-header.js',   join(coreDist, 'csrf-header.js')],
  ['/copy.js',          join(coreDist, 'copy.js')],
  ['/confirm.js',       join(coreDist, 'confirm.js')],
  ['/toast.js',         join(coreDist, 'toast.js')],
  ['/close-dialog.js',  join(coreDist, 'close-dialog.js')],
  ['/close-popover.js', join(coreDist, 'close-popover.js')],
  ['/remote-dialog.js', join(coreDist, 'remote-dialog.js')],
  ['/tabs.js',          join(coreDist, 'tabs.js')],
  ['/menu-core.js',     join(coreDist, 'menu-core.js')],
  ['/submenu.js',       join(coreDist, 'submenu.js')],
  ['/menu.js',          join(coreDist, 'menu.js')],
  ['/menubar.js',       join(coreDist, 'menubar.js')],
  ['/navmenu.js',       join(coreDist, 'navmenu.js')],
  ['/context-menu.js',  join(coreDist, 'context-menu.js')],
  ['/command.js',       join(coreDist, 'command.js')],
  ['/calendar.js',      join(coreDist, 'calendar.js')],
  ['/inputotp.js',     join(coreDist, 'inputotp.js')],
  ['/splitter.js',      join(coreDist, 'splitter.js')],
  ['/tooltip.js',       join(coreDist, 'tooltip.js')],
  ['/popover.js',       join(coreDist, 'popover.js')],
  ['/slider.js',        join(coreDist, 'slider.js')],
  ['/combobox.js',      join(coreDist, 'combobox.js')],
  ['/multicombobox.js', join(coreDist, 'multicombobox.js')],
  ['/drawer.js',        join(coreDist, 'drawer.js')],
  ['/hovercard.js',    join(coreDist, 'hovercard.js')],
  ['/toggle-group.js',  join(coreDist, 'toggle-group.js')],
  ['/carousel.js',      join(coreDist, 'carousel.js')],
  ['/toolbar.js',       join(coreDist, 'toolbar.js')],
  ['/avatar.js',        join(coreDist, 'avatar.js')],
  ['/password-toggle.js', join(coreDist, 'password-toggle.js')],
  ['/shell.js',         join(coreDist, 'shell.js')],
  ['/datagrid.js',      join(coreDist, 'datagrid.js')],
  ['/chart.js',         join(coreDist, 'chart.js')],
  ['/sparkline.js',     join(coreDist, 'sparkline.js')],
  ['/code-editor.js',   join(coreDist, 'code-editor.js')],
  ['/code-syntax.js',   join(coreDist, 'code-syntax.js')],
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

// Dynamic mock endpoints for the mutating-form spec (mutating-form.html):
// a static file server can't set a 422 status or an HX-Redirect header,
// so these few routes stand in for a server's mutation handler. A small
// delay keeps the in-flight (disabled + spinner) window observable.
const FIELD_ERRORS_FRAGMENT = `
  <div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
    <p class="hc-alert__title">Please fix the errors below.</p>
    <ul class="hc-alert__errors">
      <li class="hc-alert__error" data-field="email" data-code="duplicate"
          data-message-key="members.email.duplicate">email: already registered</li>
    </ul>
  </div>`;

function handleMock(req, res, url) {
  if (!url.pathname.startsWith('/mock/form/')) return false;
  // Drain the request body so the socket settles cleanly.
  req.resume();
  const delay = 250;
  if (url.pathname === '/mock/form/invalid' && req.method === 'POST') {
    setTimeout(() => {
      res.statusCode = 422;
      res.setHeader('Content-Type', MIME['.html']);
      res.end(FIELD_ERRORS_FRAGMENT);
    }, delay);
    return true;
  }
  if (url.pathname === '/mock/form/valid' && req.method === 'POST') {
    setTimeout(() => {
      res.statusCode = 204;
      res.setHeader('HX-Redirect', '/mock/form/done');
      res.end();
    }, delay);
    return true;
  }
  if (url.pathname === '/mock/form/done' && req.method === 'GET') {
    // The HX-Redirect destination — a plain page the browser navigates to.
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end('<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Created</title></head><body><h1 data-testid="created-page">Member created</h1>' +
      '</body></html>');
    return true;
  }
  res.statusCode = 404;
  res.end('Not found');
  return true;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (handleMock(req, res, url)) return;
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
