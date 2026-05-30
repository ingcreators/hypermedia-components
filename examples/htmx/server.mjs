#!/usr/bin/env node
// Static + API server for the htmx example.
//
// Routes
//   GET    /              -> index.html
//   GET    /hc.{css,...}  -> aliased to packages/core/dist
//   GET    /items         -> table-body HTML for the current items
//   POST   /items         -> add an item, return <tr> + HX-Trigger toast
//   DELETE /items/:id     -> remove an item, return empty + HX-Trigger toast
//   GET    /search?q=...  -> filtered table body
//
// In-memory state. Restarting the server resets the data.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, resolve, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = here;
const coreDist = resolve(here, '..', '..', 'packages', 'core', 'dist');

const PORT = Number(process.env.PORT) || 4323;

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
};

// --- mock data ----------------------------------------------------------------

let nextId = 4;
const items = [
  { id: 1, name: 'Acme widgets', status: 'success', statusLabel: 'Active' },
  { id: 2, name: 'Industrial sprockets', status: 'warning', statusLabel: 'Pending' },
  { id: 3, name: 'Vintage cogs', status: 'error', statusLabel: 'Failed' },
];

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function rowHtml(item) {
  return `
<tr id="item-${item.id}">
  <td>${escape(item.name)}</td>
  <td><span class="hc-badge" data-variant="${escape(item.status)}">${escape(item.statusLabel)}</span></td>
  <td>
    <span class="hc-action">
      <button
        class="hc-button"
        data-size="sm"
        data-variant="error"
        type="button"
        data-hc-confirm="Delete ${escape(item.name)}?"
        data-hx-delete="/items/${item.id}"
        data-hx-trigger="hc:confirmed"
        data-hx-target="closest tr"
        data-hx-swap="outerHTML"
        data-hx-disabled-elt="this"
        data-hx-indicator="closest .hc-action">
        Delete
      </button>
      <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
    </span>
  </td>
</tr>`.trim();
}

function tbodyHtml(list) {
  if (list.length === 0) {
    return `<tr><td colspan="3"><p class="hc-field__message">No items.</p></td></tr>`;
  }
  return list.map(rowHtml).join('\n');
}

// --- helpers ------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
}

function sendHtml(res, status, body, extraHeaders = {}) {
  send(res, status, body, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
}

function hxTrigger(events) {
  return { 'HX-Trigger': JSON.stringify(events) };
}

function resolveLocal(urlPath) {
  if (ASSET_ALIASES.has(urlPath)) return ASSET_ALIASES.get(urlPath);
  let p = urlPath === '/' ? '/index.html' : urlPath;
  p = normalize(p).replace(/^[\\/]+/, '');
  const full = resolve(root, p);
  if (!full.startsWith(root)) return null;
  return full;
}

function streamFile(file, res) {
  let s;
  try { s = statSync(file); } catch { return send(res, 404, 'Not found'); }
  if (s.isDirectory()) return send(res, 404, 'Not found');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

// --- request handler ----------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method;

  // --- API routes ---
  if (method === 'GET' && pathname === '/items') {
    return sendHtml(res, 200, tbodyHtml(items));
  }

  if (method === 'GET' && pathname === '/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    return sendHtml(res, 200, tbodyHtml(filtered));
  }

  if (method === 'POST' && pathname === '/items') {
    const body = await readBody(req);
    const { name } = parseForm(body);
    if (!name || !name.trim()) {
      return sendHtml(
        res,
        422,
        `<tr><td colspan="3"><p class="hc-field__message" style="color: var(--hc-color-error);">Name is required.</p></td></tr>`,
      );
    }
    const item = { id: nextId++, name: name.trim(), status: 'success', statusLabel: 'Active' };
    items.push(item);
    return sendHtml(
      res,
      201,
      rowHtml(item),
      hxTrigger({ 'hc:toast': { message: `Added "${item.name}".`, variant: 'success' } }),
    );
  }

  const delMatch = method === 'DELETE' && pathname.match(/^\/items\/(\d+)$/);
  if (delMatch) {
    const id = Number(delMatch[1]);
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return send(res, 404, '');
    const [removed] = items.splice(idx, 1);
    return sendHtml(
      res,
      200,
      '',
      hxTrigger({ 'hc:toast': { message: `Deleted "${removed.name}".`, variant: 'success' } }),
    );
  }

  // --- static / aliased assets ---
  if (method === 'GET' || method === 'HEAD') {
    const file = resolveLocal(pathname);
    if (file) return streamFile(file, res);
  }

  return send(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`htmx example: http://localhost:${PORT}/`);
  console.log(`  serving:   ${root}`);
  console.log(`  hc assets: ${coreDist}`);
  if (!safeExists(join(coreDist, 'hc.css'))) {
    console.warn('  ⚠  hc.css not found — run `pnpm -w run build` first.');
  }
});

function safeExists(p) {
  try { statSync(p); return true; } catch { return false; }
}
