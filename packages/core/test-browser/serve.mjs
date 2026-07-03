#!/usr/bin/env node
// Static server for the browser-test fixtures.
//
// Mirrors the alias map used by examples/ — serves files from
// test-browser/fixtures and proxies /hc.* and /macros/* to the
// freshly-built dist of @hypermedia-components/core.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
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
  ['/sse.min.js',      join(repoRoot, 'examples', 'htmx', 'vendor', 'sse.min.js')],
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
  ['/spy.js',           join(coreDist, 'spy.js')],
  ['/nav-current.js',   join(coreDist, 'nav-current.js')],
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

  // Serve any built JS/CSS module from the core dist, so the unbundled
  // hc.behaviors.js entry can resolve its sibling imports (./combobox.js,
  // ./menu.js, …) without enumerating every behavior in ASSET_ALIASES —
  // same fallback as examples/*/serve. A new behavior module missing from
  // the alias map otherwise 404s and takes the whole module graph (and
  // every behavior on every fixture page) down with it.
  if (/^\/(?:macros\/|locales\/)?[\w.-]+\.(?:js|css)$/.test(urlPath)) {
    const candidate = join(coreDist, urlPath.replace(/^\/+/, ''));
    if (candidate.startsWith(coreDist) && existsSync(candidate)) return candidate;
  }

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

// Mock SSE stream for the sse.spec.mjs recipes spec (sse.html): a fixed,
// timed script exercising every documented claim — named fragment events
// (feed prepend + panel replace), an out-of-band fragment inside SSE
// data, a malformed then a valid hc:toast payload for the dispatch
// bridge, a domain event that invalidates a data-region, and a
// deliberate stream end (the fixture's data-sse-close event). The
// region endpoint counts requests so a refetch is observable.
let sseRegionCounter = 0;

function handleSse(req, res, url) {
  if (url.pathname === '/mock/sse' && req.method === 'GET') {
    req.resume();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    const send = (event, data, delay) =>
      setTimeout(() => {
        if (!res.writableEnded) res.write(`event: ${event}\ndata: ${data}\n\n`);
      }, delay);
    send('activity:item', '<li class="hc-item">Deploy #42 started</li>', 100);
    send('status:panel',
      '<p>All systems normal</p><span class="hc-badge" id="alert-badge" hx-swap-oob="true" data-testid="badge">3</span>',
      250);
    send('hc:toast', '{broken json', 400); // dropped by the bridge
    send('hc:toast', '{"message":"Build finished","variant":"success"}', 550);
    send('items:changed', '{}', 700);
    send('stream:done', '', 900); // fixture closes via data-sse-close
    setTimeout(() => {
      if (!res.writableEnded) res.end();
    }, 1100);
    return true;
  }
  if (url.pathname === '/mock/sse/region' && req.method === 'GET') {
    req.resume();
    sseRegionCounter += 1;
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(`<section id="live-region" class="hc-data-region"
      data-hx-get="/mock/sse/region"
      data-hx-trigger="items:changed from:body"
      data-hx-swap="outerHTML" data-testid="region">region v${sseRegionCounter}</section>`);
    return true;
  }
  return false;
}

// Mock bulk handler for the datagrid-bulk-actions spec
// (datagrid-bulk-actions.html): three products, stateless — the response
// is derived from the posted ids/action per the recipe contract (htmx:
// 200 + re-rendered rows + OOB status + HX-Trigger toast; native post
// without HX-Request: 303 post/redirect/get).
const BULK_PRODUCTS = [
  { id: 101, name: 'Anvil' },
  { id: 102, name: 'Rocket skates' },
  { id: 103, name: 'Tornado seeds' },
];

function bulkRow(product, archived) {
  return `
  <tr class="hc-datagrid__row">
    <td class="hc-datagrid__cell">
      <input type="checkbox" class="hc-checkbox" name="ids" value="${product.id}"
             aria-label="Select ${product.name}" data-testid="cb-${product.id}">
    </td>
    <th class="hc-datagrid__cell" scope="row">${product.id}</th>
    <td class="hc-datagrid__cell">${product.name}</td>
    <td class="hc-datagrid__cell">${archived ? 'Archived' : 'Active'}</td>
  </tr>`;
}

function readBody(req) {
  return new Promise((resolveBody) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolveBody(data));
  });
}

function handleBulk(req, res, url) {
  if (url.pathname === '/mock/bulk' && req.method === 'POST') {
    readBody(req).then((body) => {
      const params = new URLSearchParams(body);
      const ids = params.getAll('ids');
      const action = params.get('action');
      if (!req.headers['hx-request']) {
        // Native (no-JS) post → classic post/redirect/get.
        res.statusCode = 303;
        res.setHeader('Location', '/mock/bulk/done');
        return res.end();
      }
      setTimeout(() => {
        const remaining = action === 'delete'
          ? BULK_PRODUCTS.filter((p) => !ids.includes(String(p.id)))
          : BULK_PRODUCTS;
        const rows = remaining
          .map((p) => bulkRow(p, action === 'archive' && ids.includes(String(p.id))))
          .join('');
        const status = `<p id="rows-status" hx-swap-oob="true" aria-live="polite" data-testid="status">${remaining.length} products</p>`;
        const verb = action === 'delete' ? 'deleted' : 'archived';
        const toast = ids.length === 0
          ? { message: 'Nothing selected', variant: 'info' }
          : { message: `${ids.length} ${verb}`, variant: 'success' };
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME['.html']);
        res.setHeader('HX-Trigger', hxTrigger({ 'hc:toast': toast }));
        res.end(rows + status);
      }, 250);
    });
    return true;
  }
  if (url.pathname === '/mock/bulk/done' && req.method === 'GET') {
    // The 303 destination for the native path.
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end('<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Done</title></head><body><h1 data-testid="bulk-done-page">Bulk action done</h1>' +
      '</body></html>');
    return true;
  }
  res.statusCode = 404;
  res.end('Not found');
  return true;
}

// Mock soft-delete handler for the undo-delete spec (undo-delete.html):
// three items, per-server-run state. DELETE returns the tombstone (the
// row's slot, hidden, carrying the restore wiring) + the undo toast;
// POST …/restore returns the original row + the success toast — unless
// the item is flagged expired, in which case the 200-with-truth shape
// returns the tombstone again + an error toast (recipe contract).
const UNDO_ITEMS = new Map([
  [1, { name: 'Anvil' }],
  [2, { name: 'Rocket skates' }],
  [3, { name: 'Tornado seeds', expired: true }], // grace already over
]);

function undoRow(id, item) {
  return `<tr id="undo-item-${id}" data-testid="row-${id}">
    <td>${item.name}</td>
    <td><button class="hc-button" data-size="sm"
          data-hx-delete="/mock/items/${id}"
          data-hx-target="closest tr"
          data-hx-swap="outerHTML"
          data-hx-disabled-elt="this"
          data-testid="delete-${id}">Delete</button></td>
  </tr>`;
}

function undoTombstone(id) {
  return `<tr id="undo-item-${id}" hidden
    data-hx-post="/mock/items/${id}/restore"
    data-hx-trigger="item-${id}:restore from:body"
    data-hx-swap="outerHTML"></tr>`;
}

// HTTP header values are latin-1 — a toast message with an em dash (or
// any localized text) crashes res.setHeader. JSON's \uXXXX escapes keep
// the HX-Trigger header pure ASCII and htmx parses them natively; the
// recipe contracts bless this encoding for every HX-Trigger payload.
function hxTrigger(payload) {
  return JSON.stringify(payload).replace(
    /[\u007f-\uffff]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

// Mock multipart upload handler for the file-upload spec
// (file-upload.html). Consumes the multipart body (filename extracted
// from the Content-Disposition line), then answers after a short delay
// so the in-flight window (indicator visible, bar at 100) is
// observable. A filename starting with "fail" takes the 422 path:
// HX-Retarget + HX-Reswap steer the field-errors fragment into the
// in-form container (the recipe contract's exceptional path).
function handleUpload(req, res, url) {
  if (url.pathname !== '/mock/upload' || req.method !== 'POST') return false;
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('latin1');
    const filename = body.match(/filename="([^"]*)"/)?.[1] ?? 'upload.bin';
    const size = chunks.reduce((n, c) => n + c.length, 0);
    const variant = body.match(/name="variant"\r\n\r\n(\w+)/)?.[1] ?? 'input';
    setTimeout(() => {
      res.setHeader('Content-Type', MIME['.html']);
      if (filename.startsWith('fail')) {
        res.statusCode = 422;
        res.setHeader('HX-Retarget', '#upload-errors');
        res.setHeader('HX-Reswap', 'innerHTML');
        res.end(`<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
          <p class="hc-alert__title">The file was not accepted.</p>
          <ul class="hc-alert__errors">
            <li class="hc-alert__error" data-field="doc" data-code="type">doc: this file type is not allowed</li>
          </ul>
        </div>`);
        return;
      }
      res.statusCode = 200;
      res.setHeader('HX-Trigger', hxTrigger({
        'hc:toast': { message: `"${filename}" uploaded`, variant: 'success' },
      }));
      const field = variant === 'dz'
        ? `<label class="hc-dropzone">
            <input class="hc-dropzone__input" id="doc-dz" name="doc" type="file" required
                   data-testid="file-dz">
            <span class="hc-dropzone__body">
              <span class="hc-dropzone__hint">Drop a file here, or click to browse</span>
              <span class="hc-dropzone__files" data-testid="names-dz"></span>
            </span>
          </label>
          <input type="hidden" name="variant" value="dz">`
        : `<div class="hc-field" id="doc-field">
            <label class="hc-field__label" for="doc">Document</label>
            <input class="hc-input" id="doc" name="doc" type="file" required
                   data-testid="file">
          </div>`;
      const formId = variant === 'dz' ? 'upload-form-dz' : 'upload-form';
      const tid = variant === 'dz' ? '-dz' : '';
      res.end(`<li class="hc-item">${filename} — ${Math.round(size / 1024)} KB</li>
        <form id="${formId}" method="post" action="/mock/upload"
              enctype="multipart/form-data"
              data-hx-post="/mock/upload"
              data-hx-encoding="multipart/form-data"
              data-hx-target="#files" data-hx-swap="afterbegin"
              data-hx-indicator="find progress"
              data-hx-disabled-elt="find button[type=submit]"
              data-testid="form${tid}" hx-swap-oob="true">
          <div id="upload-errors${tid}" data-testid="errors${tid}"></div>
          ${field}
          <progress class="hc-progress htmx-indicator" data-hc-upload-progress
                    value="0" max="100" aria-label="Upload progress"
                    data-testid="bar${tid}"></progress>
          <button class="hc-button" data-variant="primary" type="submit"
                  data-testid="submit${tid}">Upload</button>
        </form>`);
    }, 400);
  });
  return true;
}

function handleUndo(req, res, url) {
  const del = url.pathname.match(/^\/mock\/items\/(\d+)$/);
  if (del && req.method === 'DELETE') {
    req.resume();
    const id = Number(del[1]);
    const item = UNDO_ITEMS.get(id);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.setHeader('HX-Trigger', hxTrigger({
      'hc:toast': {
        id: `undo-item-${id}`,
        message: `"${item.name}" deleted`,
        variant: 'info',
        duration: 10000,
        action: { label: 'Undo', event: `item-${id}:restore` },
      },
    }));
    res.end(undoTombstone(id));
    return true;
  }
  const restore = url.pathname.match(/^\/mock\/items\/(\d+)\/restore$/);
  if (restore && req.method === 'POST') {
    req.resume();
    const id = Number(restore[1]);
    const item = UNDO_ITEMS.get(id);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    if (item.expired) {
      res.setHeader('HX-Trigger', hxTrigger({
        'hc:toast': {
          id: `undo-item-${id}`,
          message: `Too late — "${item.name}" was permanently deleted`,
          variant: 'error',
        },
      }));
      res.end(undoTombstone(id));
    } else {
      res.setHeader('HX-Trigger', hxTrigger({
        'hc:toast': {
          id: `undo-item-${id}`,
          message: `"${item.name}" restored`,
          variant: 'success',
          duration: 3000,
        },
      }));
      res.end(undoRow(id, item));
    }
    return true;
  }
  return false;
}

function handleMock(req, res, url) {
  if (!url.pathname.startsWith('/mock/')) return false;
  if (handleSse(req, res, url)) return true;
  if (handleUndo(req, res, url)) return true;
  if (handleUpload(req, res, url)) return true;
  if (!url.pathname.startsWith('/mock/form/')) return handleBulk(req, res, url);
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
