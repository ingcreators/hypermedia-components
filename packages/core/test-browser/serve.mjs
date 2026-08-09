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
  ['/tree.js',          join(coreDist, 'tree.js')],
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

// Mock 3-step wizard for the multi-step-form spec
// (multi-step-form.html). The draft lives server-side (module state;
// GET /mock/wizard/reset isolates specs). nav=next validates the
// current step (step 1 requires an @example.com address — passes the
// browser's native type=email check, so the 422 path is reachable);
// nav=back merges the body into the draft WITHOUT validating. Every
// response is the whole #wizard fragment; the final next completes via
// HX-Redirect / 303.
let wizardDraft = {};

function wizardStepper(step) {
  const names = ['Account', 'Profile', 'Review'];
  const items = names.map((label, i) => {
    const n = i + 1;
    if (n < step) {
      return `<li class="hc-stepper__step" data-state="complete">
        <span class="hc-stepper__marker" aria-hidden="true">✓</span>
        <span class="hc-stepper__label">${label} <span class="hc-sr-only">(completed)</span></span></li>`;
    }
    const current = n === step ? ' aria-current="step"' : '';
    return `<li class="hc-stepper__step"${current}>
      <span class="hc-stepper__marker" aria-hidden="true">${n}</span>
      <span class="hc-stepper__label">${label}</span></li>`;
  });
  return `<ol class="hc-stepper">${items.join('')}</ol>`;
}

function wizardStep(step) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const formOpen = `<form method="post" action="/mock/wizard/${step}"
        data-hx-post="/mock/wizard/${step}"
        data-hx-target="#wizard" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
      <div id="wizard-errors"></div>`;
  const back = `<button class="hc-button" type="submit" name="nav" value="back"
        formnovalidate data-testid="back">Back</button>`;
  const next = (label) => `<button class="hc-button" data-variant="primary" type="submit"
        name="nav" value="next" data-testid="next">${label}</button>`;
  let body;
  if (step === 1) {
    body = `${formOpen}
      <h2 data-testid="step-title">Account</h2>
      <div class="hc-field" id="email-field">
        <label class="hc-field__label" for="email">Email</label>
        <input class="hc-input" id="email" name="email" type="email" required
               value="${esc(wizardDraft.email)}" data-testid="email">
      </div>
      ${next('Next')}
    </form>`;
  } else if (step === 2) {
    body = `${formOpen}
      <h2 data-testid="step-title">Profile</h2>
      <div class="hc-field" id="name-field">
        <label class="hc-field__label" for="display-name">Display name</label>
        <input class="hc-input" id="display-name" name="display_name" required
               value="${esc(wizardDraft.display_name)}" data-testid="name">
      </div>
      ${back} ${next('Next')}
    </form>`;
  } else {
    body = `${formOpen}
      <h2 data-testid="step-title">Review</h2>
      <dl data-testid="review">
        <dt>Email</dt><dd>${esc(wizardDraft.email)}</dd>
        <dt>Display name</dt><dd>${esc(wizardDraft.display_name)}</dd>
      </dl>
      ${back} ${next('Finish')}
    </form>`;
  }
  return `<section id="wizard" data-testid="wizard">${wizardStepper(step)}${body}</section>`;
}

function handleWizard(req, res, url) {
  if (url.pathname === '/mock/wizard/reset' && req.method === 'GET') {
    req.resume();
    wizardDraft = {};
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (url.pathname === '/mock/wizard/done' && req.method === 'GET') {
    req.resume();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end('<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Welcome</title></head><body><h1 data-testid="done-page">Account created</h1></body></html>');
    return true;
  }
  const match = url.pathname.match(/^\/mock\/wizard\/([123])$/);
  if (match && req.method === 'POST') {
    const step = Number(match[1]);
    readBody(req).then((raw) => {
      const params = new URLSearchParams(raw);
      // Drafts merge on BOTH directions; only next validates.
      for (const key of ['email', 'display_name']) {
        if (params.has(key)) wizardDraft[key] = params.get(key);
      }
      const nav = params.get('nav');
      res.setHeader('Content-Type', MIME['.html']);
      if (nav === 'back') {
        res.statusCode = 200;
        res.end(wizardStep(Math.max(1, step - 1)));
        return;
      }
      if (step === 1 && !String(wizardDraft.email ?? '').endsWith('@example.com')) {
        res.statusCode = 422;
        res.setHeader('HX-Retarget', '#wizard-errors');
        res.setHeader('HX-Reswap', 'innerHTML');
        res.end(`<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
          <p class="hc-alert__title">Please fix the errors below.</p>
          <ul class="hc-alert__errors">
            <li class="hc-alert__error" data-field="email" data-code="domain">email: use your @example.com address</li>
          </ul>
        </div>`);
        return;
      }
      if (step === 3) {
        if (!req.headers['hx-request']) {
          res.statusCode = 303;
          res.setHeader('Location', '/mock/wizard/done');
          return res.end();
        }
        res.statusCode = 204;
        res.setHeader('HX-Redirect', '/mock/wizard/done');
        return res.end();
      }
      res.statusCode = 200;
      res.end(wizardStep(step + 1));
    });
    return true;
  }
  return false;
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

// Lazy-tree recipe mock (lazy-tree.html): GET /mock/tree/:id/children
// returns the group's innerHTML — <li class="hc-tree__item"> fragments
// — after a short delay so the aria-busy window is observable. Node 1
// contains a nested lazy branch (node 2) so the spec pins recursion.
function handleTree(req, res, url) {
  const m = url.pathname.match(/^\/mock\/tree\/(\d+)\/children$/);
  if (!m || req.method !== 'GET') return false;
  req.resume();
  const lazyBranch = (nodeId, label, testid) => `
    <li class="hc-tree__item" aria-expanded="false" data-testid="${testid}"
        data-hx-get="/mock/tree/${nodeId}/children"
        data-hx-target="find .hc-tree__group"
        data-hx-swap="innerHTML"
        data-hx-trigger="hc:treeexpand once">
      <span class="hc-tree__row">
        <span class="hc-tree__toggle" aria-hidden="true" data-testid="${testid}-toggle"></span>
        <span class="hc-tree__label">${label}</span>
      </span>
      <ul class="hc-tree__group" data-testid="${testid}-group"></ul>
    </li>`;
  const leaf = (label, testid) => `
    <li class="hc-tree__item" data-testid="${testid}">
      <span class="hc-tree__row"><span class="hc-tree__label">${label}</span></span>
    </li>`;
  const body = m[1] === '1'
    ? lazyBranch(2, 'Q1', 'q1') + leaf('summary.pdf', 'summary')
    : leaf('january.pdf', 'january');
  setTimeout(() => {
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(body);
  }, 150);
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

// Mock membership store for the transfer recipe spec (transfer.html):
// every move POST re-renders the whole form from this state; the reset
// endpoint isolates specs.
const TRANSFER_PEOPLE = { 7: 'Ada Lovelace', 9: 'Grace Hopper', 4: 'Alan Turing' };
const transferInitial = () => ({ available: ['7', '9'], assigned: ['4'] });
let transferState = transferInitial();

function transferPane(title, name, ids) {
  const items = ids
    .map((id) => `<label class="hc-item">
        <input class="hc-checkbox" type="checkbox" name="${name}" value="${id}">
        <span class="hc-item__title">${TRANSFER_PEOPLE[id]}</span>
      </label>`)
    .join('');
  return `<fieldset class="hc-transfer__pane">
    <legend class="hc-transfer__title">${title}
      <span class="hc-transfer__count" data-testid="count-${name}">(${ids.length})</span></legend>
    <div class="hc-transfer__list">${items}</div>
  </fieldset>`;
}

function transferForm(alert = '') {
  return `<form class="hc-transfer" id="members" method="post" action="/mock/transfer"
      data-hx-post="/mock/transfer" data-hx-target="this" data-hx-swap="outerHTML"
      aria-label="Role members" data-testid="transfer">
    ${alert}
    ${transferPane('Available', 'available', transferState.available)}
    <div class="hc-transfer__controls">
      <button class="hc-button" type="submit" name="action" value="add"
              data-hx-disabled-elt="this" aria-label="Add selected" data-testid="add">
        <span class="hc-transfer__arrow" aria-hidden="true">→</span>
      </button>
      <button class="hc-button" type="submit" name="action" value="remove"
              data-hx-disabled-elt="this" aria-label="Remove selected" data-testid="remove">
        <span class="hc-transfer__arrow" aria-hidden="true">←</span>
      </button>
    </div>
    ${transferPane('Assigned', 'assigned', transferState.assigned)}
  </form>`;
}

function handleTransfer(req, res, url) {
  if (url.pathname === '/mock/transfer/reset' && req.method === 'GET') {
    transferState = transferInitial();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(transferForm());
    return true;
  }
  if (url.pathname === '/mock/transfer' && req.method === 'POST') {
    readBody(req).then((body) => {
      const params = new URLSearchParams(body);
      const action = params.get('action');
      const moved = action === 'add' ? params.getAll('available') : params.getAll('assigned');
      if (!req.headers['hx-request']) {
        res.statusCode = 303;
        res.setHeader('Location', '/mock/bulk/done');
        return res.end();
      }
      res.setHeader('Content-Type', MIME['.html']);
      if (moved.length === 0) {
        res.statusCode = 422;
        return res.end(transferForm(
          '<div class="hc-alert" data-variant="error" role="alert" style="flex-basis:100%;" data-testid="transfer-alert">'
          + '<p class="hc-alert__title">Select at least one member to move.</p></div>',
        ));
      }
      const [from, to] = action === 'add'
        ? [transferState.available, transferState.assigned]
        : [transferState.assigned, transferState.available];
      for (const id of moved) {
        const i = from.indexOf(id);
        if (i !== -1) { from.splice(i, 1); to.push(id); } // idempotent per id
      }
      res.statusCode = 200;
      res.end(transferForm());
    });
    return true;
  }
  return false;
}

// Stateless area data for the cascading-select recipe spec
// (cascading-select.html): each GET returns the child <select> fragment
// plus an OOB reset of the deeper level, per the recipe contract.
const CASCADE_CITIES = {
  13: [['13101', 'Chiyoda'], ['13102', 'Chuo'], ['13103', 'Minato']],
  27: [['27102', 'Kita'], ['27104', 'Chuo (Osaka)']],
};
const CASCADE_WARDS = {
  13101: [['A', 'Kanda'], ['B', 'Marunouchi']],
};

function cascadeSelect(id, name, opts, { wired = false, disabled = false, placeholder = 'Select…', oob = false } = {}) {
  const wiring = wired
    ? ' data-hx-get="/mock/areas/wards" data-hx-include="this" data-hx-target="#ward" data-hx-swap="outerHTML"'
    : '';
  const options = [`<option value="">${placeholder}</option>`]
    .concat(opts.map(([v, label]) => `<option value="${v}">${label}</option>`))
    .join('');
  return `<select class="hc-select" id="${id}" name="${name}"`
    + `${disabled ? ' disabled' : ''}${oob ? ' data-hx-swap-oob="true"' : ''}${wiring}>${options}</select>`;
}

function handleCascade(req, res, url) {
  if (req.method !== 'GET') return false;
  if (url.pathname === '/mock/areas/cities') {
    const pref = url.searchParams.get('prefecture');
    const cities = CASCADE_CITIES[pref] ?? [];
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    const city = cities.length
      ? cascadeSelect('city', 'city', cities, { wired: true })
      : cascadeSelect('city', 'city', [], { disabled: true, placeholder: 'Select a prefecture first' });
    const wardReset = cascadeSelect('ward', 'ward', [], {
      disabled: true, placeholder: 'Select a city first', oob: true,
    });
    res.end(city + wardReset);
    return true;
  }
  if (url.pathname === '/mock/areas/wards') {
    const city = url.searchParams.get('city');
    const wards = CASCADE_WARDS[city] ?? [];
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(wards.length
      ? cascadeSelect('ward', 'ward', wards)
      : cascadeSelect('ward', 'ward', [], { disabled: true, placeholder: 'Select a city first' }));
    return true;
  }
  return false;
}


// Mock chat backend for the chat-messages recipe spec (chat-messages.html):
// POST appends the user message + the assistant placeholder (aria-busy,
// data-state="streaming") and resets the composer out of band; an empty
// prompt is a 422 whose only content is the OOB composer re-render, so
// nothing lands in the transcript. The reset endpoint isolates specs.
let chatNextId = 1;

function chatComposer(error = '', stream = false) {
  const post = stream ? '/mock/chat/messages?stream=1' : '/mock/chat/messages';
  const invalid = error ? ' data-invalid="true"' : '';
  const aria = error
    ? ' aria-invalid="true" aria-describedby="prompt-error"'
    : '';
  const message = error
    ? `<p id="prompt-error" class="hc-field__message" data-testid="prompt-error">${error}</p>`
    : '';
  return `<form class="hc-field" id="composer" method="post" action="${post}"
      data-hx-post="${post}"
      data-hx-target="#chat-list" data-hx-swap="beforeend"
      data-hx-swap-oob="outerHTML"${invalid} data-testid="composer">
    <label class="hc-field__label" for="prompt">Message</label>
    <textarea class="hc-input" id="prompt" name="prompt" rows="2"${aria} data-testid="prompt"></textarea>
    ${message}
    <button class="hc-button" data-variant="primary" type="submit" data-testid="send">Send</button>
  </form>`;
}

// Streamed placeholder for the streaming-response recipe spec: the
// placeholder itself owns the SSE connection (data-sse-swap="done,error"
// outerHTML-swaps it away, which also closes the EventSource via htmx's
// beforeCleanupElement), the body is the chunk sink, and the stop button
// POSTs the cancel — the response replaces the whole <li>, closing the
// stream in the same round trip.
function chatStreamingReply(id, scenario) {
  return `<li class="hc-chat__message" data-role="assistant" data-state="streaming"
      aria-busy="true" id="reply-${id}" data-testid="reply-${id}"
      data-hx-ext="sse" data-sse-connect="/mock/chat/stream/${id}?scenario=${scenario}"
      data-sse-swap="done,error" data-hx-swap="outerHTML">
    <div class="hc-chat__body" data-sse-swap="chunk" data-hx-swap="beforeend"></div>
    <button class="hc-button" data-size="sm" type="button"
        data-hx-post="/mock/chat/stream/${id}/stop"
        data-hx-target="closest li" data-hx-swap="outerHTML"
        data-testid="stop-${id}">Stop</button>
  </li>`;
}

function handleChat(req, res, url) {
  const streamed = url.searchParams.get('stream') === '1';
  if (url.pathname === '/mock/chat/reset' && req.method === 'GET') {
    chatNextId = 1;
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(chatComposer('', streamed).replace(' data-hx-swap-oob="outerHTML"', ''));
    return true;
  }
  if (url.pathname === '/mock/chat/messages' && req.method === 'POST') {
    readBody(req).then((body) => {
      const prompt = (new URLSearchParams(body).get('prompt') ?? '').trim();
      if (!req.headers['hx-request']) {
        res.statusCode = 303;
        res.setHeader('Location', '/chat-messages.html');
        return res.end();
      }
      res.setHeader('Content-Type', MIME['.html']);
      if (!prompt) {
        // 422: no transcript content — only the OOB composer re-render.
        res.statusCode = 422;
        return res.end(chatComposer('Type a message first.', streamed));
      }
      const id = chatNextId++;
      // Streamed variant: the prompt picks the SSE scenario so the spec
      // can drive the happy path, the error event and the stop ride.
      const scenario =
        prompt === 'fail' ? 'error' : prompt === 'slow' ? 'slow' : 'ok';
      const placeholder = streamed
        ? chatStreamingReply(id, scenario)
        : `<li class="hc-chat__message" data-role="assistant" data-state="streaming"
            aria-busy="true" id="reply-${id}" data-testid="reply-${id}">
          <div class="hc-chat__body"></div>
        </li>`;
      res.statusCode = 200;
      res.end(`<li class="hc-chat__message" data-role="user" data-testid="user-${id}">
          <div class="hc-chat__body">${prompt.replace(/</g, '&lt;')}</div>
        </li>
        ${placeholder}
        ${chatComposer('', streamed)}`);
    });
    return true;
  }
  // SSE reply stream for the streaming-response recipe: named events
  // whose data is a finished fragment — `chunk` (HTML text appended
  // into the placeholder body), `done` (the complete final <li>,
  // outerHTML-swapped over the placeholder, no aria-busy), `error`
  // (a final <li data-state="error"> with a retry affordance). Data is
  // single-line by construction (SSE frames one line per data:).
  const stream = url.pathname.match(/^\/mock\/chat\/stream\/(\d+)$/);
  if (stream && req.method === 'GET') {
    const id = stream[1];
    const scenario = url.searchParams.get('scenario') ?? 'ok';
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
    if (scenario === 'error') {
      send('chunk', 'Thinking', 100);
      send('error', `<li class="hc-chat__message" data-role="assistant" data-state="error" id="reply-${id}" data-testid="error-${id}"><div class="hc-chat__body">The reply stream failed. <button class="hc-button" data-size="sm" type="button" data-hx-post="/mock/chat/messages?stream=1" data-hx-vals='{"prompt":"retry"}' data-hx-target="#chat-list" data-hx-swap="beforeend" data-testid="retry-${id}">Retry</button></div></li>`, 300);
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 500);
    } else if (scenario === 'slow') {
      // Keeps chunking so the spec can click Stop mid-stream.
      for (let i = 1; i <= 40; i += 1) send('chunk', `tok${i} `, i * 150);
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 6500);
    } else {
      send('chunk', 'Here', 100);
      send('chunk', ' is the', 220);
      send('chunk', ' answer.', 340);
      send('done', `<li class="hc-chat__message" data-role="assistant" id="reply-${id}" data-testid="done-${id}"><div class="hc-chat__body">Here is the answer.</div></li>`, 500);
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 700);
    }
    return true;
  }
  const stop = url.pathname.match(/^\/mock\/chat\/stream\/(\d+)\/stop$/);
  if (stop && req.method === 'POST') {
    const id = stop[1];
    req.resume();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(`<li class="hc-chat__message" data-role="assistant" id="reply-${id}" data-testid="stopped-${id}">
        <div class="hc-chat__body">Generation stopped.</div>
      </li>`);
    return true;
  }
  return false;
}

// Mock postal lookup for the postal-address recipe spec
// (postal-address.html): GET /mock/postal/lookup?postal=###-####
// [&choice=<n>] per the recipe contract — single hit fills the address
// inputs out of band, a shared code lists candidate buttons, unknown
// codes hint, malformed codes 422.
const POSTAL_BOOK = {
  '123-4567': [{ pref: 'Tokyo', city: 'Chiyoda-ku', addr1: 'Chiyoda 1-1' }],
  '600-8216': [
    { pref: 'Kyoto', city: 'Shimogyo-ku', addr1: 'Higashishiokoji-cho' },
    { pref: 'Kyoto', city: 'Shimogyo-ku', addr1: 'Nishishiokoji-cho' },
  ],
};
const POSTAL_AUTOCOMPLETE = {
  pref: 'address-level1', city: 'address-level2', addr1: 'address-line1',
};

function postalOob(field, value) {
  return `<input class="hc-input" id="${field}" name="${field}" value="${value}" autocomplete="${POSTAL_AUTOCOMPLETE[field]}" data-testid="${field}" data-hx-swap-oob="outerHTML">`;
}

function handlePostal(req, res, url) {
  if (req.method !== 'GET' || url.pathname !== '/mock/postal/lookup') return false;
  const postal = url.searchParams.get('postal') ?? '';
  res.setHeader('Content-Type', MIME['.html']);
  if (!/^\d{3}-\d{4}$/.test(postal)) {
    res.statusCode = 422;
    res.end('<span>Enter a postal code as 123-4567.</span>');
    return true;
  }
  const hits = POSTAL_BOOK[postal];
  res.statusCode = 200;
  if (!hits) {
    res.end(`<span>No address for ${postal} — enter it manually.</span>`);
    return true;
  }
  const choice = Number.parseInt(url.searchParams.get('choice') ?? '', 10);
  const hit = hits.length === 1
    ? hits[0]
    : Number.isInteger(choice) && hits[choice] ? hits[choice] : null;
  if (hit) {
    res.end([
      `<span>Address filled from ${postal}.</span>`,
      postalOob('pref', hit.pref),
      postalOob('city', hit.city),
      postalOob('addr1', hit.addr1),
    ].join('\n'));
    return true;
  }
  const buttons = hits
    .map((h, i) => `<button type="button" class="hc-button" data-size="sm" data-hx-get="/mock/postal/lookup?postal=${postal}&amp;choice=${i}" data-hx-target="#postal-result">${h.pref}, ${h.city}, ${h.addr1}</button>`)
    .join('\n');
  res.end(`<span>${hits.length} addresses share ${postal} — pick one:</span>\n${buttons}`);
  return true;
}

// Mock no-redirect save for the unsaved-changes / autosave recipe specs
// (unsaved-changes.html, autosave.html): the guard's clean-on-save keys
// on htmx:afterRequest for the form's own request, so the mock answers
// 200 in place (no HX-Redirect — the page must survive the save).
function handleDirty(req, res, url) {
  if (req.method !== 'POST') return false;
  if (url.pathname === '/mock/dirty/save') {
    req.resume();
    setTimeout(() => {
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME['.html']);
      res.end('<span>Saved.</span>');
    }, 100);
    return true;
  }
  if (url.pathname === '/mock/autosave/draft') {
    req.resume();
    setTimeout(() => {
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME['.html']);
      res.end('<span>Draft saved.</span>');
    }, 50);
    return true;
  }
  return false;
}

// Mock cookie-session for the session-expiry recipe spec
// (session-expiry.html): approve 401s with the retargeted login dialog
// until the login sets the session cookie; hc:sessionrenewed rides the
// HX-Trigger header and installSessionExpiry replays the approval.
function sessionLoginDialog(error) {
  const err = error
    ? `<p class="hc-field__error" id="relogin-error">${error}</p>`
    : '';
  const aria = error
    ? ' aria-invalid="true" aria-describedby="relogin-error"'
    : '';
  return `<dialog class="hc-dialog" aria-labelledby="relogin-title">
  <form class="hc-stack" data-hx-post="/mock/session/login" data-hx-target="this" data-hx-swap="none">
    <h2 class="hc-dialog__title" id="relogin-title">Session expired</h2>
    <div class="hc-field"${error ? ' data-invalid="true"' : ''}>
      <label class="hc-field__label" for="relogin-password">Password</label>
      <input class="hc-input" id="relogin-password" name="password" type="password" autocomplete="current-password" required${aria}>
      ${err}
    </div>
    <button class="hc-button" data-variant="primary" type="submit">Sign in</button>
  </form>
  <form method="dialog"><button class="hc-button" data-variant="ghost">Cancel</button></form>
</dialog>`;
}

function handleSession(req, res, url) {
  if (req.method !== 'POST') return false;
  if (url.pathname === '/mock/session/approve') {
    req.resume();
    const hasSession = (req.headers.cookie ?? '').includes('hc_session=1');
    res.setHeader('Content-Type', MIME['.html']);
    if (hasSession) {
      res.statusCode = 200;
      res.end('<span>Approved.</span>');
      return true;
    }
    res.statusCode = 401;
    res.setHeader('HX-Retarget', '#error-dialog');
    res.setHeader('HX-Reswap', 'innerHTML');
    res.end(sessionLoginDialog());
    return true;
  }
  if (url.pathname === '/mock/session/login') {
    readBody(req).then((body) => {
      const params = new URLSearchParams(body);
      res.setHeader('Content-Type', MIME['.html']);
      if (params.get('password') === 'wrong') {
        res.statusCode = 422;
        res.setHeader('HX-Retarget', '#error-dialog');
        res.setHeader('HX-Reswap', 'innerHTML');
        res.end(sessionLoginDialog('That password is not right.'));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Set-Cookie', 'hc_session=1; Path=/; Max-Age=300; SameSite=Lax');
      res.setHeader('HX-Trigger', hxTrigger({ 'hc:sessionrenewed': {} }));
      res.end('');
    });
    return true;
  }
  return false;
}

// Mock optimistic locking for the edit-conflict recipe spec
// (edit-conflict.html): record pinned at v13; stale saves 409 with the
// retargeted conflict dialog; force wins only with the fresh version.
const CONFLICT_CURRENT = { version: '13', title: 'Restock the beans (theirs)' };

function conflictDialogMock(yourTitle) {
  return `<dialog class="hc-dialog" aria-labelledby="conflict-title">
  <div class="hc-stack">
    <h2 class="hc-dialog__title" id="conflict-title">Someone saved first</h2>
    <table class="hc-table">
      <thead><tr><th scope="col"></th><th scope="col">Theirs (v13)</th><th scope="col">Yours</th></tr></thead>
      <tbody><tr><th scope="row">Title</th><td>${CONFLICT_CURRENT.title}</td><td>${yourTitle}</td></tr></tbody>
    </table>
    <form class="hc-cluster">
      <input type="hidden" name="version" value="13">
      <button class="hc-button" data-variant="error" type="button" data-hc-close-dialog-on-success
              data-hx-put="/mock/conflict/tickets/7?force=1"
              data-hx-include="#ticket-form [name='title'], closest form"
              data-hx-target="#status" data-hx-swap="innerHTML">Overwrite with mine</button>
      <button class="hc-button" type="button" data-hc-close-dialog-on-success
              data-hx-get="/mock/conflict/tickets/7/edit"
              data-hx-target="#ticket-form" data-hx-swap="outerHTML">Reload theirs</button>
    </form>
    <form method="dialog"><button class="hc-button" data-variant="ghost">Keep editing</button></form>
  </div>
</dialog>`;
}

function conflictForm() {
  return `<form id="ticket-form" class="hc-stack" data-testid="form"
      data-hx-put="/mock/conflict/tickets/7"
      data-hx-target="#status" data-hx-swap="innerHTML">
  <input type="hidden" name="version" value="13" data-testid="version">
  <div class="hc-field">
    <label class="hc-field__label" for="title">Title</label>
    <input class="hc-input" id="title" name="title" value="${CONFLICT_CURRENT.title}" data-testid="title">
  </div>
  <p class="hc-field__hint" id="status" aria-live="polite" data-testid="status"></p>
  <button class="hc-button" data-variant="primary" type="submit" data-testid="save">Save</button>
</form>`;
}

function handleConflict(req, res, url) {
  if (url.pathname === '/mock/conflict/tickets/7' && req.method === 'PUT') {
    readBody(req).then((body) => {
      const params = new URLSearchParams(body);
      const force = url.searchParams.get('force') === '1';
      res.setHeader('Content-Type', MIME['.html']);
      if (params.get('version') === CONFLICT_CURRENT.version) {
        res.statusCode = 200;
        res.end(`<span>Saved as v14${force ? ' (overwrote v13)' : ''}.</span>`);
        return;
      }
      res.statusCode = 409;
      res.setHeader('HX-Retarget', '#error-dialog');
      res.setHeader('HX-Reswap', 'innerHTML');
      res.end(conflictDialogMock(params.get('title') ?? ''));
    });
    return true;
  }
  if (url.pathname === '/mock/conflict/tickets/7/edit' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(conflictForm());
    return true;
  }
  return false;
}

// Mock column chooser for the datagrid-columns recipe spec
// (datagrid-columns.html): stateless — GET /mock/datagrid-columns/items
// answers the grid fragment (the wrapper's innerHTML: scroll + table)
// with exactly the requested cols= columns in the server's canonical
// order, plus the chooser form re-rendered out of band with matching
// checked states (recipe contract). Absent or unknown-only cols fall
// back to the default set (all four).
const DGC_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'updated', label: 'Updated' },
];
const DGC_ITEMS = [
  { name: 'Ingest pipeline', status: 'Active', owner: 'Ada', updated: '2026-08-01' },
  { name: 'Nightly backup', status: 'Active', owner: 'Grace', updated: '2026-08-03' },
  { name: 'Billing export', status: 'Pending', owner: 'Alan', updated: '2026-08-05' },
  { name: 'Legacy sync', status: 'Failed', owner: 'Mary', updated: '2026-07-28' },
];

// OOB unit = the fieldset, never the form (the form carries
// data-hc-close-popover-on-success; replacing it would detach the
// carrier before afterRequest and the popover would never close).
function dgcChooser(selected) {
  const shown = new Set(selected.map((col) => col.key));
  // Chosen columns first, in their chosen order (datagrid-prefs upgrade).
  const ordered = [...selected, ...DGC_COLUMNS.filter((col) => !shown.has(col.key))];
  const boxes = ordered.map((col) => `
    <label class="hc-checkbox-label">
      <button type="button" class="hc-button" data-variant="ghost" data-hc-sortable-handle data-testid="handle-${col.key}">⠿</button>
      <input class="hc-checkbox" type="checkbox" name="cols" value="${col.key}"${shown.has(col.key) ? ' checked' : ''} data-testid="cb-${col.key}">
      ${col.label}
    </label>`).join('');
  return `<fieldset class="hc-popover__body" id="cols-fields" data-testid="chooser-fields" data-hc-sortable data-hx-swap-oob="outerHTML">${boxes}
  </fieldset>`;
}

function handleDatagridColumns(req, res, url) {
  if (url.pathname !== '/mock/datagrid-columns/items' || req.method !== 'GET') return false;
  req.resume();
  // Submitted order wins (the datagrid-prefs upgrade); absent or
  // unknown-only requests fall back to the default set.
  const byKey = new Map(DGC_COLUMNS.map((col) => [col.key, col]));
  let selected = [...new Set(url.searchParams.getAll('cols'))]
    .map((key) => byKey.get(key))
    .filter(Boolean);
  if (selected.length === 0) selected = DGC_COLUMNS;
  const head = selected
    .map((col) => `<th class="hc-datagrid__headcell" scope="col">${col.label}</th>`)
    .join('');
  const rows = DGC_ITEMS
    .map((item) => `<tr class="hc-datagrid__row">${selected
      .map((col) => `<td class="hc-datagrid__cell">${item[col.key]}</td>`)
      .join('')}</tr>`)
    .join('\n      ');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME['.html']);
  res.end(`<div class="hc-datagrid__scroll">
    <table class="hc-datagrid__table">
      <thead class="hc-datagrid__head"><tr>${head}</tr></thead>
      <tbody class="hc-datagrid__body">
      ${rows}
      </tbody>
    </table>
  </div>
  ${dgcChooser(selected)}`);
  return true;
}

// Mock per-column filter for the datagrid-filter recipe spec
// (datagrid-filter.html): stateless — GET /mock/datagrid-filter/items
// answers the grid fragment (the wrapper's innerHTML: scroll + table)
// with only the rows matching the f-status= params; the Status
// header's trigger button rides inside it (data-filtered + an
// aria-label naming the active values when filtering), plus the filter
// form's fieldset re-rendered out of band with matching checked
// states (recipe contract). Absent or unknown-only values fall back
// to the unfiltered list.
const DGF_STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
];
const DGF_ITEMS = [
  { name: 'Ingest pipeline', status: 'active', owner: 'Ada' },
  { name: 'Nightly backup', status: 'active', owner: 'Grace' },
  { name: 'Billing export', status: 'pending', owner: 'Alan' },
  { name: 'Legacy sync', status: 'failed', owner: 'Mary' },
];

function dgfTrigger(selected) {
  const labels = DGF_STATUSES.filter((s) => selected.includes(s.key)).map((s) => s.label);
  const filtered = labels.length > 0;
  const aria = filtered ? `Filter Status — active: ${labels.join(', ')}` : 'Filter Status';
  return `<button class="hc-button" data-variant="${filtered ? 'primary' : 'ghost'}" data-size="sm" type="button" id="filter-status-trigger" popovertarget="filter-status-popover"${filtered ? ' data-filtered' : ''} aria-label="${aria}" data-testid="trigger">Filter</button>`;
}

// OOB unit = the fieldset, never the form (the form carries
// data-hc-close-popover-on-success — replacing it would detach the
// carrier before afterRequest and the popover would never close).
function dgfFields(selected) {
  const checked = new Set(selected);
  const boxes = DGF_STATUSES.map((s) => `
    <label class="hc-checkbox-label">
      <input class="hc-checkbox" type="checkbox" name="f-status" value="${s.key}"${checked.has(s.key) ? ' checked' : ''} data-testid="cb-${s.key}">
      ${s.label}
    </label>`).join('');
  return `<fieldset class="hc-popover__body" id="filter-status-fields" data-testid="filter-fields" data-hx-swap-oob="outerHTML">${boxes}
  </fieldset>`;
}

function handleDatagridFilter(req, res, url) {
  if (url.pathname !== '/mock/datagrid-filter/items' || req.method !== 'GET') return false;
  req.resume();
  const known = new Set(DGF_STATUSES.map((s) => s.key));
  const selected = [...new Set(url.searchParams.getAll('f-status'))].filter((k) => known.has(k));
  const label = new Map(DGF_STATUSES.map((s) => [s.key, s.label]));
  const rows = DGF_ITEMS
    .filter((item) => selected.length === 0 || selected.includes(item.status))
    .map((item) => `<tr class="hc-datagrid__row"><td class="hc-datagrid__cell">${item.name}</td><td class="hc-datagrid__cell">${label.get(item.status)}</td><td class="hc-datagrid__cell">${item.owner}</td></tr>`)
    .join('\n      ');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME['.html']);
  res.end(`<div class="hc-datagrid__scroll">
    <table class="hc-datagrid__table">
      <thead class="hc-datagrid__head"><tr>
        <th class="hc-datagrid__headcell" scope="col">Name</th>
        <th class="hc-datagrid__headcell" scope="col">Status ${dgfTrigger(selected)}</th>
        <th class="hc-datagrid__headcell" scope="col">Owner</th>
      </tr></thead>
      <tbody class="hc-datagrid__body">
      ${rows}
      </tbody>
    </table>
  </div>
  ${dgfFields(selected)}`);
  return true;
}

// Mock prefs endpoint for the datagrid-prefs recipe spec
// (datagrid-prefs.html): POST /mock/datagrid-prefs/columns echoes the
// w-<col> pairs as the status fragment a real server would answer
// after persisting per user.
function handleDatagridPrefs(req, res, url) {
  if (url.pathname !== '/mock/datagrid-prefs/columns' || req.method !== 'POST') return false;
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const params = new URLSearchParams(raw);
    const saved = [];
    for (const [key, value] of params.entries()) {
      const w = Number.parseInt(value, 10);
      if (key.startsWith('w-') && Number.isFinite(w) && w > 0) {
        saved.push(`${key.slice(2)} ${w}px`);
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(`<span data-testid="saved">${saved.length ? `Saved — ${saved.join(', ')}` : 'Nothing to save yet'}</span>`);
  });
  return true;
}

// Mock children endpoint for the datagrid-tree recipe spec
// (datagrid-tree.html): stateless — GET /mock/datagrid-tree/items/:id/children
// answers the child <tr> batch one level deeper (dirs carry their own
// toggle + lazy wiring; leaves carry aria-level only); an empty dir
// answers the contract's single empty-state row.
const DGT_CHILDREN = {
  docs: [
    { id: 'docs-guide', name: 'guide', dir: true, level: 2 },
    { id: 'docs-api', name: 'api.md', size: '12 KB', level: 2 },
  ],
  'docs-guide': [
    { id: 'docs-guide-intro', name: 'intro.md', size: '6 KB', level: 3 },
  ],
  src: [],
};

function handleDatagridTree(req, res, url) {
  const m = url.pathname.match(/^\/mock\/datagrid-tree\/items\/([a-z-]+)\/children$/);
  if (!m || req.method !== 'GET') return false;
  req.resume();
  const kids = DGT_CHILDREN[m[1]];
  res.statusCode = kids === undefined ? 404 : 200;
  res.setHeader('Content-Type', MIME['.html']);
  if (kids === undefined) {
    res.end('Not found');
    return true;
  }
  if (kids.length === 0) {
    res.end('<tr class="hc-datagrid__row" aria-level="2" data-testid="empty-row"><td class="hc-datagrid__cell" colspan="2">No entries</td></tr>');
    return true;
  }
  res.end(kids.map((node) => {
    const lead = node.dir
      ? `<button class="hc-datagrid__toggle" type="button" data-hc-datagrid-tree aria-hidden="true" tabindex="-1"></button> ${node.name}`
      : node.name;
    const treeAttrs = node.dir
      ? ` aria-expanded="false" data-lazy data-hx-get="/mock/datagrid-tree/items/${node.id}/children" data-hx-trigger="hc:datagridtreeload" data-hx-swap="afterend"`
      : '';
    return `<tr class="hc-datagrid__row" data-testid="node-${node.id}" aria-level="${node.level}"${treeAttrs}><td class="hc-datagrid__cell">${lead}</td><td class="hc-datagrid__cell" data-numeric>${node.dir ? '—' : node.size}</td></tr>`;
  }).join('\n'));
  return true;
}

// Mock persistence for the datagrid-edit-errors recipe spec
// (datagrid-edit-errors.html): PATCH /mock/datagrid-edit-errors/items/:id
// answers the record tbody — 200 with the accepted value formatted, or
// 422 with the server value restored + data-invalid + the __error-row
// naming the rejected input. A short delay keeps the data-pending
// state observable. Stateless: the "server value" is the fixture's.
const DGE_ITEMS = { 1: { name: 'Chai', price: 18 }, 2: { name: 'Chang', price: 19 } };

function dgeRecord(id, price, invalid) {
  const item = DGE_ITEMS[id];
  const errorId = `item-${id}-error`;
  const invalidAttrs = invalid
    ? ` data-invalid aria-invalid="true" aria-describedby="${errorId}"`
    : '';
  const errorRow = invalid
    ? `\n  <tr class="hc-datagrid__error-row" data-testid="error-row"><td class="hc-datagrid__error" colspan="2"><span role="alert" id="${errorId}" data-testid="error-msg">${invalid}</span></td></tr>`
    : '';
  return `<tbody class="hc-datagrid__record" id="item-${id}" data-testid="record-${id}"
  data-hx-patch="/mock/datagrid-edit-errors/items/${id}"
  data-hx-trigger="hc:datagridedit"
  data-hx-vals="js:{ col: event.detail.col, value: event.detail.value }"
  data-hx-swap="outerHTML">
  <tr class="hc-datagrid__row">
    <td class="hc-datagrid__cell">${item.name}</td>
    <td class="hc-datagrid__cell" data-numeric data-editable data-col="price" data-value="${price}" data-testid="price-${id}"${invalidAttrs}>${price.toFixed(2)}</td>
  </tr>${errorRow}
</tbody>`;
}

function handleDatagridEditErrors(req, res, url) {
  const m = url.pathname.match(/^\/mock\/datagrid-edit-errors\/items\/(\d+)$/);
  if (!m || req.method !== 'PATCH') return false;
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    setTimeout(() => {
      const id = Number(m[1]);
      const value = String(new URLSearchParams(raw).get('value') ?? '').trim();
      const n = Number(value);
      res.setHeader('Content-Type', MIME['.html']);
      if (!Number.isFinite(n) || n <= 0) {
        res.statusCode = 422;
        res.end(dgeRecord(id, DGE_ITEMS[id].price, `"${value}" is not a valid price — enter a number greater than 0.`));
      } else {
        res.statusCode = 200;
        res.end(dgeRecord(id, n, null));
      }
    }, 150); // keep data-pending observable
  });
  return true;
}

// Mock optimistic-locking backend for the datagrid-edit-conflict spec
// (datagrid-edit-conflict.html): the record starts at version 3, but
// "another user" has already saved 20.00 as version 4 — a PATCH with
// version < 4 answers the 409 conflict presentation (theirs in the
// cell, fresh version, alert + overwrite/discard); version >= 4
// succeeds (200, version + 1). GET answers the record plain.
const DGC2_THEIRS = { price: 20, version: 4 };

function dgc2Record({ price, version, conflict = null }) {
  const conflictRow = conflict
    ? `
  <tr class="hc-datagrid__error-row" data-testid="conflict-row">
    <td class="hc-datagrid__error" colspan="2">
      <span role="alert" id="item-1-conflict" data-testid="conflict-msg">Edit conflict: another user saved ${DGC2_THEIRS.price.toFixed(2)} while you were editing. Your value: ${conflict.yours}.</span>
      <button class="hc-button" data-size="sm" data-variant="primary" type="button" data-testid="overwrite"
              data-hx-patch="/mock/datagrid-edit-conflict/items/1"
              data-hx-vals='{"col":"price","value":"${conflict.yours}","version":"${version}"}'
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Overwrite with ${conflict.yours}</button>
      <button class="hc-button" data-size="sm" type="button" data-testid="discard"
              data-hx-get="/mock/datagrid-edit-conflict/items/1"
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Discard mine</button>
    </td>
  </tr>`
    : '';
  return `<tbody class="hc-datagrid__record" id="item-1" data-testid="record-1" data-version="${version}"
  data-hx-patch="/mock/datagrid-edit-conflict/items/1"
  data-hx-trigger="hc:datagridedit"
  data-hx-vals="js:{ col: event.detail.col, value: event.detail.value, version: event.target.closest('tbody').dataset.version }"
  data-hx-swap="outerHTML">
  <tr class="hc-datagrid__row"${conflict ? ' data-attention="error"' : ''} data-testid="row-1">
    <td class="hc-datagrid__cell">Chai</td>
    <td class="hc-datagrid__cell" data-numeric data-editable data-col="price" data-value="${price}" data-testid="price-cell">${price.toFixed(2)}</td>
  </tr>${conflictRow}
</tbody>`;
}

function handleDatagridEditConflict(req, res, url) {
  if (url.pathname !== '/mock/datagrid-edit-conflict/items/1') return false;
  if (req.method === 'GET') {
    req.resume();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(dgc2Record({ price: DGC2_THEIRS.price, version: DGC2_THEIRS.version }));
    return true;
  }
  if (req.method !== 'PATCH') return false;
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const params = new URLSearchParams(raw);
    const version = Number(params.get('version'));
    const value = String(params.get('value') ?? '').trim();
    res.setHeader('Content-Type', MIME['.html']);
    if (!(version >= DGC2_THEIRS.version)) {
      res.statusCode = 409;
      res.end(dgc2Record({
        price: DGC2_THEIRS.price,
        version: DGC2_THEIRS.version,
        conflict: { yours: value },
      }));
    } else {
      const n = Number(value);
      res.statusCode = 200;
      res.end(dgc2Record({ price: Number.isFinite(n) ? n : DGC2_THEIRS.price, version: version + 1 }));
    }
  });
  return true;
}

// Mock backend for the datagrid-bulk-errors recipe spec
// (datagrid-bulk-errors.html). Eligibility is a pure function of the
// id — 102 is "shipped", 107 is "not yours" — so the same selection
// always yields the same answer. Two branches:
//   POST /mock/bulk-errors/bulk  action=archive → best-effort 200
//   GET  /mock/bulk-errors/preflight             → executability report
//   POST /mock/bulk-errors/bulk  action=post     → atomic; a blocked id
//        answers 409 with the rows UNCHANGED and the selection KEPT.
const BE_IDS = [101, 102, 103, 104, 107];

function beReason(id) {
  if (id === 102) return 'Already shipped — cannot be changed';
  if (id === 107) return 'Not permitted';
  if (id === 104) return 'Locked by another job — try again';
  return null;
}

// Only a transient failure is worth re-submitting, so only it comes
// back checked — the retry set the user presses the button on again.
function beRetryable(id) {
  return id === 104;
}

function beRow(id, { failed = false, status = 'Active', checked = false } = {}) {
  const reason = failed ? beReason(id) : null;
  const describe = reason
    ? ` data-invalid aria-describedby="why-${id}"`
    : '';
  const tip = reason
    ? `<span class="hc-tooltip" id="why-${id}">${reason}</span>`
    : '';
  return `<tr class="hc-datagrid__row" id="row-${id}" data-testid="row-${id}"${failed ? ' data-attention="error"' : ''}>
  <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" name="ids" value="${id}"${checked ? ' checked' : ''} aria-label="Select ${id}" data-testid="cb-${id}"></td>
  <td class="hc-datagrid__cell">Product ${id}</td>
  <td class="hc-datagrid__cell"${describe} data-testid="status-${id}">${status} ${tip}</td>
</tr>`;
}

function beReasonTable(blocked) {
  const rows = [...blocked.entries()]
    .map(([reason, ids]) => `<tr><th scope="row">${reason}</th><td data-numeric>${ids.length}</td><td>${ids
      .map((id) => `<a href="#row-${id}" data-testid="jump-${id}">${id} Product ${id}</a>`)
      .join(', ')}</td></tr>`)
    .join('');
  return `<table class="hc-table"><thead><tr><th scope="col">Reason</th><th scope="col">Count</th><th scope="col">Rows</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function beSplit(ids) {
  const ok = [];
  const blocked = new Map();
  for (const id of ids) {
    const reason = beReason(id);
    if (!reason) { ok.push(id); continue; }
    if (!blocked.has(reason)) blocked.set(reason, []);
    blocked.get(reason).push(id);
  }
  return { ok, blocked };
}

// The main swap target is a <tbody>, so htmx parses the response in a
// table context — a bare <div> OOB fragment is foster-parented and its
// nested <table> mangled. Wrapping the OOB unit in <template> is the
// blessed escape (see the recipe contract).
function beReport(inner, { oob = false } = {}) {
  const div = `<div id="bulk-report" data-testid="report" aria-live="polite"${oob ? ' data-hx-swap-oob="innerHTML"' : ''}>${inner}</div>`;
  return oob ? `<template>${div}</template>` : div;
}

function handleBulkErrors(req, res, url) {
  if (!url.pathname.startsWith('/mock/bulk-errors/')) return false;

  if (url.pathname === '/mock/bulk-errors/preflight' && req.method === 'GET') {
    req.resume();
    const ids = url.searchParams.getAll('ids').map(Number).filter(Boolean);
    const { ok, blocked } = beSplit(ids);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    if (blocked.size === 0) {
      res.end(beReport(`<p data-testid="preflight-ok">${ok.length} rows will be executed.</p>`));
      return true;
    }
    const excludeForm = ok.length
      ? `<form data-hx-post="/mock/bulk-errors/bulk" data-hx-target="#rows" data-hx-swap="innerHTML"><input type="hidden" name="action" value="post">${ok
          .map((id) => `<input type="hidden" name="ids" value="${id}">`)
          .join('')}<button class="hc-button" type="submit" data-testid="exclude-run">Exclude ${ids.length - ok.length} and run ${ok.length}</button></form>`
      : '<p data-testid="preflight-dead-end">No executable rows.</p>';
    res.end(beReport(`<p data-testid="preflight-summary">${ok.length} of ${ids.length} rows are executable</p>${beReasonTable(blocked)}${excludeForm}`));
    return true;
  }

  if (url.pathname !== '/mock/bulk-errors/bulk' || req.method !== 'POST') return false;
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const params = new URLSearchParams(raw);
    const ids = params.getAll('ids').map(Number).filter(Boolean);
    const action = params.get('action') ?? 'archive';
    const { ok, blocked } = beSplit(ids);
    res.setHeader('Content-Type', MIME['.html']);

    if (action === 'post') {
      if (blocked.size > 0) {
        // Refusal: unchanged rows, selection kept, refusal copy.
        res.statusCode = 409;
        res.end(`${BE_IDS.map((id) => beRow(id, { checked: ids.includes(id) })).join('\n')}
${beReport(`<p data-testid="refusal"><strong>Nothing was executed.</strong></p>${beReasonTable(blocked)}`, { oob: true })}`);
        return;
      }
      res.statusCode = 200;
      res.end(`${BE_IDS.map((id) => beRow(id, { status: ids.includes(id) ? 'Posted' : 'Active' })).join('\n')}
${beReport('<p data-testid="posted">Posted.</p>', { oob: true })}`);
      return;
    }

    res.statusCode = 200;
    const rows = BE_IDS.map((id) => {
      if (!ids.includes(id)) return beRow(id);
      const failed = beReason(id) != null;
      return beRow(id, {
        failed,
        status: failed ? 'Active' : 'Archived',
        checked: failed && beRetryable(id),
      });
    }).join('\n');
    const inner = blocked.size
      ? `<p data-testid="summary">${ok.length} succeeded / ${ids.length - ok.length} failed</p>${beReasonTable(blocked)}<p><a href="/mock/bulk-errors/items?f-last-result=failed" data-testid="filter-failed">Filter to the failed rows</a></p>`
      : `<p data-testid="summary">${ok.length} rows archived.</p>`;
    res.end(`${rows}\n${beReport(inner, { oob: true })}`);
  });
  return true;
}

// Mock saved-views backend for the saved-views recipe spec
// (saved-views.html): stateless, exactly like the docs demo — the strip
// threads its own state (hidden view= inputs the save form includes;
// each chip's delete URL repeats the OTHER chips as view= params; a
// view= value packs as `<name>|<querystring>` and splits on the first
// `|`). GET /items answers the result list + the filter form
// re-rendered OOB with the values filled (a view is never opaque);
// POST /views answers the strip fragment (422 + field-errors alert on a
// blank or duplicate name — the fixture carries the documented
// beforeSwap allowance); DELETE /views/<name> answers the strip
// without it.
const SV_ITEMS = [
  { name: 'Quarterly revenue', status: 'active' },
  { name: 'Churn cohorts', status: 'active' },
  { name: 'Signup funnel', status: 'pending' },
  { name: 'Legacy exports', status: 'failed' },
  { name: 'Beans forecast', status: 'active' },
];

const svEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function svPack(view) {
  return `${view.name}|${new URLSearchParams({ q: view.q, status: view.status })}`;
}

function svUnpack(value) {
  const split = value.indexOf('|');
  if (split < 1) return null;
  const pairs = new URLSearchParams(value.slice(split + 1));
  return { name: value.slice(0, split), q: pairs.get('q') ?? '', status: pairs.get('status') ?? '' };
}

function svChip(view, others, current) {
  const applyUrl = svEsc(`/mock/saved-views/items?${new URLSearchParams({ q: view.q, status: view.status })}`);
  const remaining = new URLSearchParams();
  for (const other of others) remaining.append('view', svPack(other));
  const qs = remaining.toString();
  const deleteUrl = svEsc(`/mock/saved-views/views/${encodeURIComponent(view.name)}${qs ? `?${qs}` : ''}`);
  return `<li class="hc-chip">
    <a href="${applyUrl}"${current ? ' aria-current="true"' : ''} data-hx-get="${applyUrl}" data-hx-target="#results">${svEsc(view.name)}</a>
    <button class="hc-button" data-size="sm" type="button" aria-label="Delete view ${svEsc(view.name)}"
            data-hx-delete="${deleteUrl}" data-hx-target="#views">×</button>
  </li>`;
}

function svStrip(views, { currentName = null, error = '' } = {}) {
  if (views.length === 0) {
    return `${error}<p class="hc-field__message">No saved views yet.</p>`;
  }
  const hidden = views
    .map((view) => `<input type="hidden" name="view" value="${svEsc(svPack(view))}">`)
    .join('\n');
  const chips = views
    .map((view) => svChip(view, views.filter((o) => o !== view), view.name === currentName))
    .join('\n');
  return `${error}${hidden}\n<ul class="hc-chips">${chips}</ul>`;
}

function svFilterForm(q, status) {
  const options = [['', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['failed', 'Failed']]
    .map(([value, label]) => `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`)
    .join('');
  return `<form id="filters" action="/mock/saved-views/items" method="get"
      data-hx-get="/mock/saved-views/items" data-hx-target="#results" data-hx-swap-oob="outerHTML">
    <div class="hc-field">
      <label class="hc-field__label" for="q">Search</label>
      <input class="hc-input" id="q" name="q" type="search" value="${svEsc(q)}" data-testid="q">
    </div>
    <div class="hc-field">
      <label class="hc-field__label" for="status">Status</label>
      <select class="hc-select" id="status" name="status" data-testid="status">${options}</select>
    </div>
    <button class="hc-button" type="submit" data-testid="filter-apply">Apply</button>
  </form>`;
}

function svResults(q, status) {
  const term = q.trim().toLowerCase();
  const hits = SV_ITEMS.filter(
    (item) => (status === '' || item.status === status) && item.name.toLowerCase().includes(term),
  );
  if (hits.length === 0) {
    return '<p class="hc-field__message">No items match the current filters.</p>';
  }
  return `<ul class="hc-list">${hits.map(({ name }) => `<li>${name}</li>`).join('')}</ul>`;
}

function handleSavedViews(req, res, url) {
  if (url.pathname === '/mock/saved-views/items' && req.method === 'GET') {
    req.resume();
    const q = url.searchParams.get('q') ?? '';
    const status = url.searchParams.get('status') ?? '';
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(`${svResults(q, status)}\n${svFilterForm(q, status)}`);
    return true;
  }
  if (url.pathname === '/mock/saved-views/views' && req.method === 'POST') {
    readBody(req).then((body) => {
      const params = new URLSearchParams(body);
      const name = (params.get('name') ?? '').trim();
      const q = params.get('q') ?? '';
      const status = params.get('status') ?? '';
      const views = params.getAll('view').map(svUnpack).filter(Boolean);
      res.setHeader('Content-Type', MIME['.html']);
      const fail = (code, detail) => {
        res.statusCode = 422;
        res.end(svStrip(views, {
          error: `<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
          <p class="hc-alert__title">The view was not saved.</p>
          <ul class="hc-alert__errors"><li class="hc-alert__error" data-field="name" data-code="${code}">name: ${detail}</li></ul>
        </div>\n`,
        }));
      };
      if (!name) return fail('required', 'name the view first');
      if (views.some((view) => view.name === name)) {
        return fail('duplicate', 'a view with this name already exists');
      }
      res.statusCode = 200;
      res.end(svStrip([...views, { name, q, status }], { currentName: name }));
    });
    return true;
  }
  const del = url.pathname.match(/^\/mock\/saved-views\/views\/([^/]+)$/);
  if (del && req.method === 'DELETE') {
    req.resume();
    const name = decodeURIComponent(del[1]);
    const remaining = url.searchParams.getAll('view')
      .map(svUnpack)
      .filter(Boolean)
      .filter((view) => view.name !== name);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(svStrip(remaining));
    return true;
  }
  return false;
}

// Mock CSV import backend for the csv-import recipe spec
// (csv-import.html). POST /mock/csv-import/imports parses the CSV out
// of the multipart body (tiny strict parser: comma, "quoted" fields
// with "" escapes, \r\n? rows; two columns name,qty with an optional
// header) and answers the validation report — summary + real error
// table + the tokened confirm form — importing nothing. The token is
// stateless like the docs demo: base64url of the valid rows re-
// serialized as CSV (a real app holds the batch server-side). Commit
// decodes it and answers the result + toast; the canned token
// "expired" (and anything undecodable) answers the single-shot 409.
function csvParse(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function csvValidate(rows) {
  const valid = [];
  const errors = [];
  const first = rows[0];
  const hasHeader = first?.length === 2
    && first[0].trim().toLowerCase() === 'name'
    && first[1].trim().toLowerCase() === 'qty';
  for (let i = hasHeader ? 1 : 0; i < rows.length; i += 1) {
    const line = i + 1;
    const r = rows[i];
    if (r.length !== 2) {
      errors.push({ row: line, field: 'row', message: `expected 2 fields, got ${r.length}` });
      continue;
    }
    const name = r[0].trim();
    const qty = r[1].trim();
    if (!name) { errors.push({ row: line, field: 'name', message: 'name is required' }); continue; }
    if (!/^\d+$/.test(qty) || Number.parseInt(qty, 10) < 1) {
      errors.push({ row: line, field: 'qty', message: 'qty must be a positive integer' });
      continue;
    }
    valid.push({ name, qty: Number.parseInt(qty, 10) });
  }
  return { valid, errors };
}

function csvReport(valid, errors) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts = [];
  if (errors.length === 0) {
    parts.push(`<p>${valid.length} ${valid.length === 1 ? 'row' : 'rows'} ready to import.</p>`);
  } else {
    parts.push(`<p>${valid.length} of ${valid.length + errors.length} rows ready — ${errors.length} ${errors.length === 1 ? 'row has' : 'rows have'} errors and will be skipped.</p>`);
    const body = errors.map(({ row, field, message }) =>
      `<tr><th scope="row">${row}</th><td>${esc(field)}</td><td>${esc(message)}</td></tr>`).join('\n');
    parts.push(`<table class="hc-table">
      <caption>Rows that will not be imported</caption>
      <thead><tr><th scope="col">Row</th><th scope="col">Field</th><th scope="col">Message</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`);
  }
  if (valid.length > 0) {
    const csvField = (v) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
    const token = Buffer.from(
      valid.map((r) => `${csvField(r.name)},${r.qty}`).join('\n'), 'utf8',
    ).toString('base64url');
    const url = `/mock/csv-import/imports/${token}/commit`;
    parts.push(`<form method="post" action="${url}" data-hx-post="${url}" data-hx-target="#import-report" data-hx-disabled-elt="find button[type=submit]">
      <input type="hidden" name="token" value="${token}">
      <button class="hc-button" data-variant="primary" type="submit">Import the valid ${valid.length} ${valid.length === 1 ? 'row' : 'rows'}</button>
    </form>`);
  }
  return parts.join('\n');
}

function handleCsvImport(req, res, url) {
  if (url.pathname === '/mock/csv-import/imports' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      // The csv part's content: after its headers' blank line, up to
      // the next boundary line (single-file form, ASCII fixtures).
      const content = body.match(/name="csv"[^]*?\r\n\r\n([^]*?)\r\n--/)?.[1] ?? '';
      res.setHeader('Content-Type', MIME['.html']);
      const rows = csvParse(content);
      if (rows.length === 0) {
        res.statusCode = 422;
        return res.end('<p class="hc-field__message">The file has no data rows.</p>');
      }
      const { valid, errors } = csvValidate(rows);
      res.statusCode = valid.length > 0 ? 200 : 422;
      res.end(csvReport(valid, errors));
    });
    return true;
  }
  const commit = url.pathname.match(/^\/mock\/csv-import\/imports\/([^/]+)\/commit$/);
  if (commit && req.method === 'POST') {
    readBody(req).then(() => {
      const token = commit[1];
      res.setHeader('Content-Type', MIME['.html']);
      let batch = null;
      if (token !== 'expired') {
        try { batch = Buffer.from(token, 'base64url').toString('utf8'); } catch { batch = null; }
      }
      const n = batch === null ? 0 : csvParse(batch).length;
      if (n === 0) {
        // Single-shot tokens: consumed/expired/undecodable → 409.
        res.statusCode = 409;
        return res.end('<p class="hc-field__message">This import was already committed or has expired — upload the file again for a fresh report.</p>');
      }
      res.statusCode = 200;
      res.setHeader('HX-Trigger', hxTrigger({
        'hc:toast': { message: `${n} rows imported`, variant: 'success' },
        'items:changed': {},
      }));
      res.end(`<p>${n} ${n === 1 ? 'row' : 'rows'} imported.</p>`);
    });
    return true;
  }
  return false;
}

// Mock cursor feed for the datagrid-infinite recipe spec
// (datagrid-infinite.html): stateless — 15 deterministic products in
// batches of 5 (the fixture server-renders rows 1–5 with the same
// formula). GET /mock/datagrid-infinite/items?after=item-N answers the
// next <tr> batch plus a renewed sentinel, or the final batch closed
// by the aria-live end marker ("15 of 15"). Stale cursors resume from
// the nearest stable point — always 200, scrolling is not an error.
const DGI_TOTAL = 15;
const DGI_BATCH = 5;
const DGI_ADJECTIVES = ['Compact', 'Durable', 'Foldable', 'Luminous'];
const DGI_NOUNS = ['Anvil', 'Sprocket', 'Widget'];

function dgiRow(i) {
  const name = `${DGI_ADJECTIVES[(i - 1) % DGI_ADJECTIVES.length]} ${DGI_NOUNS[(i - 1) % DGI_NOUNS.length]}`;
  return `<tr class="hc-datagrid__row" data-testid="row">
    <th class="hc-datagrid__cell" scope="row">item-${i}</th>
    <td class="hc-datagrid__cell">${name}</td>
    <td class="hc-datagrid__cell">$${100 + ((i * 37) % 400)}</td>
    <td class="hc-datagrid__cell">${(i * 7) % 30}</td>
  </tr>`;
}

// `root` (a selector) switches the sentinel to the container-scrolled
// variant: `intersect once root:<sel>` instead of the window-viewport
// `revealed` — the cursor links thread the param along.
function dgiSentinel(afterIndex, root) {
  const trigger = root ? `intersect once root:${root} threshold:0.5` : 'revealed';
  const rootParam = root ? `&root=${encodeURIComponent(root)}` : '';
  return `<tr class="hc-datagrid__row" data-testid="sentinel"
      data-hx-get="/mock/datagrid-infinite/items?after=item-${afterIndex}${rootParam}"
      data-hx-trigger="${trigger}"
      data-hx-swap="outerHTML">
    <td class="hc-datagrid__cell" colspan="4" aria-live="polite"><span class="hc-spinner" aria-hidden="true"></span> Loading…</td>
  </tr>`;
}

function handleDatagridInfinite(req, res, url) {
  if (url.pathname !== '/mock/datagrid-infinite/items' || req.method !== 'GET') return false;
  req.resume();
  // Resumable cursor: item-N clamps into [0, TOTAL]; garbage resumes
  // from the start (the nearest stable point) — never a 4xx.
  const n = Number.parseInt(url.searchParams.get('after')?.match(/^item-(\d+)$/)?.[1] ?? '', 10);
  const afterIndex = Number.isNaN(n) ? 0 : Math.min(DGI_TOTAL, Math.max(0, n));
  const root = url.searchParams.get('root');
  const last = Math.min(afterIndex + DGI_BATCH, DGI_TOTAL);
  const parts = [];
  for (let i = afterIndex + 1; i <= last; i += 1) parts.push(dgiRow(i));
  parts.push(last < DGI_TOTAL
    ? dgiSentinel(last, root)
    : `<tr class="hc-datagrid__row">
    <td class="hc-datagrid__cell" colspan="4" aria-live="polite" data-testid="end">${DGI_TOTAL} of ${DGI_TOTAL}</td>
  </tr>`);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME['.html']);
  res.end(parts.join('\n'));
  return true;
}

function handleMock(req, res, url) {
  if (!url.pathname.startsWith('/mock/')) return false;
  if (handleSse(req, res, url)) return true;
  if (handleUndo(req, res, url)) return true;
  if (handleWizard(req, res, url)) return true;
  if (handleUpload(req, res, url)) return true;
  if (handleTree(req, res, url)) return true;
  if (handleTransfer(req, res, url)) return true;
  if (handleCascade(req, res, url)) return true;
  if (handlePostal(req, res, url)) return true;
  if (handleDirty(req, res, url)) return true;
  if (handleSession(req, res, url)) return true;
  if (handleConflict(req, res, url)) return true;
  if (handleDatagridInfinite(req, res, url)) return true;
  if (handleCsvImport(req, res, url)) return true;
  if (handleSavedViews(req, res, url)) return true;
  if (handleDatagridColumns(req, res, url)) return true;
  if (handleDatagridPrefs(req, res, url)) return true;
  if (handleDatagridFilter(req, res, url)) return true;
  if (handleDatagridTree(req, res, url)) return true;
  if (handleDatagridEditErrors(req, res, url)) return true;
  if (handleDatagridEditConflict(req, res, url)) return true;
  if (handleBulkErrors(req, res, url)) return true;
  if (handleChat(req, res, url)) return true;
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
