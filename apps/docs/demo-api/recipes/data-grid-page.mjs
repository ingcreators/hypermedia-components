// data-grid-page — the TEMPLATE, working.
//
// The template page documents a composition; this makes it behave, so
// the contracts can be seen meeting each other rather than described
// separately:
//
//   GET  /items?f-status=…&f-customer=…&sort=…&page=…
//     → the grid's rows, plus OOB re-renders of the applied-conditions
//       bar, the pager and the summary line (cleared — a new answer
//       has no failures yet)
//   GET  /items/<id>?peek=1&from=<list qs>&i=<ordinal>
//     → the record as a <dialog> (the peek rendering; the row's href
//       stays the canonical page), carrying Back at the start and the
//       walk at the end, with neighbours resolved by RE-RUNNING the
//       list query — so Next crosses a page boundary
//   POST /items/<id>  (ship)
//     → the edited row out of band + the dialog closes: the list
//       behind it is true again without a reload
//   POST /bulk        (ids + action)
//     → best-effort. Rows come back marked, the chrome gets ONE line
//       with the moves and the failed-only filter, and the grouped
//       breakdown goes to the docked panel — collapsed, carrying its
//       count
//   GET  /report?open=1|close=1&ids=…
//     → the docked panel, opened or collapsed. Hiding is a response,
//       not client state
//
// Stateless: the querystring fully determines every answer.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/data-grid-page`;
// The record has a page of its own — a real second URL, prerendered by
// Astro — and that is what a row link points at. The peek is layered on
// top with data-hx-get; without this the demo would be teaching
// "records live in modals", which the recipe says they do not.
const RECORD_ROUTE = `${DOCS_BASE}/templates/data-grid-page-record`;
const IDS = {
  grid: 'template-grid',
  rows: 'template-grid-rows',
  conditions: 'template-grid-conditions',
  summary: 'template-grid-summary',
  panel: 'template-grid-panel',
  pager: 'template-grid-pager',
  record: 'template-grid-record',
};
const PAGE_SIZE = 8;

const CUSTOMERS = ['Northwind', 'Contoso', 'Fabrikam', 'Adventure Works'];
const CARRIERS = ['Road', 'Air', 'Sea'];
const STATUSES = [
  ['open', 'Open'],
  ['shipped', 'Shipped'],
  ['closed', 'Closed'],
];

/** 24 orders — enough for three pages, so paging is real. Exported so
 * the static record route is built from the SAME data: two renderings
 * of one resource must not disagree about what the resource is. */
export const ORDERS = Array.from({ length: 24 }, (_, i) => ({
  id: 4901 + i,
  ordered: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
  customer: CUSTOMERS[i % CUSTOMERS.length],
  item: `Bearing assembly ${1000 + i}`,
  ship: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  carrier: CARRIERS[i % CARRIERS.length],
  qty: (i % 9) * 12 + 6,
  amount: ((i % 9) * 12 + 6) * 145,
  status: i % 7 === 0 ? 'shipped' : i % 5 === 0 ? 'closed' : 'open',
}));

const byId = new Map(ORDERS.map((o) => [o.id, o]));

/** Why a row cannot be approved. Pure function of the row, so the
 * demo needs no storage and every branch is reproducible. */
function blockedReason(order) {
  if (order.status === 'shipped') return 'Already shipped';
  if (order.status === 'closed') return 'Closed period';
  if (order.amount > 12000) return 'Over the approval limit';
  return null;
}

// ---- the query -------------------------------------------------------

function readQuery(params) {
  const statuses = params.getAll('f-status').filter((s) => STATUSES.some(([k]) => k === s));
  const customer = (params.get('f-customer') ?? '').trim();
  const sort = params.get('sort') ?? '-ship';
  const pageNo = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const failedOnly = params.get('f-last-result') === 'failed';
  const failedIds = params
    .getAll('failed')
    .map(Number)
    .filter((n) => byId.has(n));
  return { statuses, customer, sort, pageNo, failedOnly, failedIds };
}

/** The querystring a link must carry to mean the same question. */
function queryString(q, extra = {}) {
  const params = new URLSearchParams();
  for (const s of q.statuses) params.append('f-status', s);
  if (q.customer) params.set('f-customer', q.customer);
  if (q.sort) params.set('sort', q.sort);
  if (q.pageNo > 1) params.set('page', String(q.pageNo));
  if (q.failedOnly) params.set('f-last-result', 'failed');
  for (const id of q.failedIds) params.append('failed', String(id));
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) params.delete(k);
    else params.set(k, String(v));
  }
  return params.toString();
}

/** Matching rows, sorted — the sequence everything else counts against. */
function matching(q) {
  const term = q.customer.toLowerCase();
  let rows = ORDERS.filter(
    (o) =>
      (q.statuses.length === 0 || q.statuses.includes(o.status)) &&
      (term === '' || o.customer.toLowerCase().includes(term)),
  );
  if (q.failedOnly) rows = rows.filter((o) => q.failedIds.includes(o.id));
  const keys = q.sort ? q.sort.split(',').filter(Boolean) : [];
  rows.sort((a, b) => {
    for (const key of keys) {
      const desc = key.startsWith('-');
      const col = desc ? key.slice(1) : key;
      const va = a[col];
      const vb = b[col];
      if (va === vb) continue;
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return desc ? -cmp : cmp;
    }
    // Stable tiebreak, always: without it paging repeats and drops rows.
    return a.id - b.id;
  });
  return rows;
}

// ---- fragments -------------------------------------------------------

function rowHtml(order, { ordinal, q, failed = null }) {
  const from = encodeURIComponent(queryString(q));
  // The href is the record's own PAGE — bookmarkable, middle-clickable,
  // and what a browser with no JavaScript follows. The peek is the
  // enhancement layered on top of it, never a replacement.
  const href = `${RECORD_ROUTE}/${order.id}/?from=${from}&i=${ordinal}`;
  const peek = `${API}/items/${order.id}?from=${from}&i=${ordinal}&peek=1`;
  const attention = failed ? ' data-attention="error"' : '';
  const errorRow = failed
    ? `\n<tr class="hc-datagrid__error-row" id="row-error-${order.id}"><td class="hc-datagrid__error" colspan="8"><span role="alert">${escapeHtml(failed)}</span></td></tr>`
    : '';
  return `<tr class="hc-datagrid__row" id="template-grid-row-${order.id}" data-row-no="${ordinal}"${attention}>
  <td class="hc-datagrid__cell" data-frozen style="--hc-datagrid-left: 0;"><input type="checkbox" class="hc-checkbox" name="ids" value="${order.id}" aria-label="Select order SO-${order.id}"></td>
  <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row" style="--hc-datagrid-left: 2.5rem;"><a href="${escapeHtml(href)}" data-hc-row-link data-hx-get="${escapeHtml(peek)}" data-hx-target="#${IDS.record}" data-hx-swap="innerHTML">SO-${order.id}</a></th>
  <td class="hc-datagrid__cell">${order.ordered}</td>
  <td class="hc-datagrid__cell">${escapeHtml(order.customer)}</td>
  <td class="hc-datagrid__cell">${escapeHtml(order.item)}</td>
  <td class="hc-datagrid__cell">${order.ship}</td>
  <td class="hc-datagrid__cell">${escapeHtml(order.carrier)}</td>
  <td class="hc-datagrid__cell" data-numeric>${order.amount.toLocaleString('en-US')}</td>
</tr>${errorRow}`;
}

function rowsHtml(q, { failures = new Map() } = {}) {
  const rows = matching(q);
  const start = (q.pageNo - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  if (slice.length === 0) {
    return `<tr class="hc-datagrid__row"><td class="hc-datagrid__cell" colspan="8">No orders match these conditions. <a href="${API}/items">Clear all</a></td></tr>`;
  }
  return slice
    .map((order) =>
      rowHtml(order, {
        ordinal: start + slice.indexOf(order) + 1,
        q,
        failed: failures.get(order.id) ?? null,
      }),
    )
    .join('\n');
}

function conditionsHtml(q, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const chips = [];
  const label = new Map(STATUSES);
  if (q.statuses.length) {
    const without = queryString({ ...q, statuses: [], pageNo: 1 });
    chips.push(chip('Status', 'is', q.statuses.map((s) => label.get(s)).join(', '), without));
  }
  if (q.customer) {
    const without = queryString({ ...q, customer: '', pageNo: 1 });
    chips.push(chip('Customer', 'contains', q.customer, without));
  }
  if (q.failedOnly) {
    const without = queryString({ ...q, failedOnly: false, pageNo: 1 });
    chips.push(chip('Last result', 'is', `failed (${q.failedIds.length})`, without));
  }
  const clear = `<a class="hc-filterbar__clear" href="${API}/items" data-hx-get="${API}/items" data-hx-target="#${IDS.rows}" data-hx-swap="innerHTML">Clear all</a>`;
  return `<div class="hc-filterbar" id="${IDS.conditions}"${oobAttr}>
  <ul class="hc-filterbar__list">${chips.join('')}</ul>
  ${chips.length ? clear : ''}
</div>`;
}

function chip(name, op, value, withoutQs) {
  const href = `${API}/items${withoutQs ? `?${withoutQs}` : ''}`;
  return `<li class="hc-filterbar__item">
  <button class="hc-filterbar__chip" type="button" onclick="document.getElementById('template-grid-filters').showModal()">
    <span class="hc-filterbar__label">${escapeHtml(name)}</span>
    <span class="hc-filterbar__op">${escapeHtml(op)}</span>
    <span class="hc-filterbar__value">${escapeHtml(value)}</span>
  </button>
  <a class="hc-filterbar__remove" href="${escapeHtml(href)}" data-hx-get="${escapeHtml(href)}" data-hx-target="#${IDS.rows}" data-hx-swap="innerHTML" aria-label="Remove ${escapeHtml(name)} filter">×</a>
</li>`;
}

function pagerHtml(q, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const total = matching(q).length;
  const start = (q.pageNo - 1) * PAGE_SIZE;
  const shown = Math.min(PAGE_SIZE, Math.max(0, total - start));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (n, text, rel) =>
    n >= 1 && n <= pages
      ? `<a class="hc-pagination__item" data-hc-rel="${rel}" href="${API}/items?${queryString(q, { page: n })}" data-hx-get="${API}/items?${queryString(q, { page: n })}" data-hx-target="#${IDS.rows}" data-hx-swap="innerHTML">${text}</a>`
      : `<span class="hc-pagination__item" aria-disabled="true">${text}</span>`;
  return `<div class="hc-toolbar" role="toolbar" aria-label="Rows" id="${IDS.pager}"${oobAttr}>
  <span aria-live="polite">${shown ? `${start + 1}–${start + shown}` : '0'} of ${total}</span>
  <span data-hc-spacer="true"></span>
  <nav class="hc-pagination" aria-label="Pages">${link(q.pageNo - 1, 'Previous', 'prev')}${link(q.pageNo + 1, 'Next', 'next')}</nav>
</div>`;
}

function summaryHtml(inner, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="innerHTML"' : '';
  return `<div id="${IDS.summary}" aria-live="polite"${oobAttr}>${inner}</div>`;
}

function reasonTable(failures) {
  const groups = new Map();
  for (const [id, reason] of failures) {
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(id);
  }
  const rows = [...groups]
    .map(
      ([reason, ids]) =>
        `<tr><th scope="row">${escapeHtml(reason)}</th><td>${ids.length}</td><td>${ids
          .slice(0, 5)
          .map((id) => `<a href="#template-grid-row-${id}">SO-${id}</a>`)
          .join(', ')}${ids.length > 5 ? ` and ${ids.length - 5} more` : ''}</td></tr>`,
    )
    .join('');
  return `<table class="hc-table"><thead><tr><th scope="col">Reason</th><th scope="col">Rows</th><th scope="col">Which</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function panelHtml({ failures = new Map(), open = false, oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const count = failures.size;
  const ids = [...failures.keys()].map((id) => `ids=${id}`).join('&');
  if (!open) {
    return template(
      `<div class="hc-splitter__panel" id="${IDS.panel}" data-collapsed${oobAttr}>
  <button class="hc-button" data-size="sm" data-variant="${count ? 'secondary' : 'ghost'}" type="button"${count ? '' : ' disabled'} data-hx-get="${API}/report?open=1&${ids}" data-hx-target="#${IDS.panel}" data-hx-swap="outerHTML" aria-label="Show why rows failed">Reasons${count ? ` (${count})` : ''}</button>
</div>`,
      oob,
    );
  }
  return template(
    `<div class="hc-splitter__panel hc-scroll-area" id="${IDS.panel}"${oobAttr}>
  <div class="hc-cluster" style="justify-content: space-between;">
    <strong>Why they failed</strong>
    <button class="hc-button" data-size="sm" data-variant="ghost" type="button" data-hx-get="${API}/report?close=1&${ids}" data-hx-target="#${IDS.panel}" data-hx-swap="outerHTML">Hide</button>
  </div>
  ${reasonTable(failures)}
</div>`,
    oob,
  );
}

/** A <div> riding a <tbody>-targeted response is foster-parented by the
 * table parser; <template> is the documented escape. */
function template(div, oob) {
  return oob ? `<template>${div}</template>` : div;
}

// ---- the record ------------------------------------------------------

function recordHtml(order, { q, ordinal }) {
  const rows = matching(q);
  const index = rows.findIndex((o) => o.id === order.id);
  const prev = index > 0 ? rows[index - 1] : null;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;
  const from = encodeURIComponent(queryString(q));
  const walkHref = (o, i) => `${API}/items/${o.id}?peek=1&from=${from}&i=${i}`;
  const step = (o, i, text, label) =>
    o
      ? `<a class="hc-button" data-size="sm" href="${escapeHtml(walkHref(o, i))}" data-hx-get="${escapeHtml(walkHref(o, i))}" data-hx-target="#${IDS.record}" data-hx-swap="innerHTML" aria-label="${label}">${text}</a>`
      : `<span class="hc-button" data-size="sm" aria-disabled="true" aria-label="${label}">${text}</span>`;
  return `<dialog class="hc-dialog" aria-labelledby="template-grid-record-title" style="--hc-dialog-max-width: 34rem;">
  <div class="hc-dialog__header">
    <div class="hc-cluster" style="justify-content: space-between;">
      <button class="hc-button" data-variant="ghost" type="button" onclick="this.closest('dialog').close()">← Back to list</button>
      <h2 class="hc-dialog__title" id="template-grid-record-title">SO-${order.id}</h2>
      <div class="hc-cluster">
        <a class="hc-button" data-size="sm" data-variant="ghost" href="${RECORD_ROUTE}/${order.id}/?from=${from}&i=${ordinal}">Open full page ↗</a>
        <span>${index + 1} / ${rows.length}</span>
        ${step(prev, index, '‹', 'Previous record')}
        ${step(next, index + 2, '›', 'Next record')}
      </div>
    </div>
  </div>
  <form class="hc-dialog__body" method="post" action="${API}/items/${order.id}" data-hx-post="${API}/items/${order.id}" data-hx-target="#template-grid-row-${order.id}" data-hx-swap="outerHTML" data-hc-close-dialog-on-success>
    <div class="hc-field">
      <span class="hc-field__label">Customer</span>
      <p>${escapeHtml(order.customer)} · ${escapeHtml(order.item)}</p>
    </div>
    <div class="hc-field">
      <label class="hc-field__label" for="record-ship">Ship date</label>
      <input class="hc-input" type="date" id="record-ship" name="ship" value="${order.ship}">
    </div>
    <input type="hidden" name="from" value="${escapeHtml(queryString(q))}">
    <input type="hidden" name="i" value="${ordinal}">
    <footer class="hc-dialog__footer">
      <button class="hc-button" type="submit" formmethod="dialog">Cancel</button>
      <button class="hc-button" data-variant="primary" type="submit">Save</button>
    </footer>
  </form>
</dialog>`;
}

/** The record's own page: the same header arrangement as the peek —
 * exit at the start, walk at the end — without the dialog around it. */
function recordPageHtml(order, { q, ordinal }) {
  const rows = matching(q);
  const index = rows.findIndex((o) => o.id === order.id);
  const prev = index > 0 ? rows[index - 1] : null;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;
  const from = encodeURIComponent(queryString(q));
  const href = (o, i) => `${API}/items/${o.id}?from=${from}&i=${i}`;
  const step = (o, i, text, label) =>
    o
      ? `<a class="hc-button" data-size="sm" href="${escapeHtml(href(o, i))}" aria-label="${label}">${text}</a>`
      : `<span class="hc-button" data-size="sm" aria-disabled="true" aria-label="${label}">${text}</span>`;
  // Back carries the list query AND the row anchor, so the list comes
  // back as it was with the row the user left from under the cursor.
  const back = `${API}/items?${queryString(q)}#template-grid-row-${order.id}`;
  return `<article class="hc-card">
  <header class="hc-cluster" style="justify-content: space-between;">
    <a class="hc-button" data-variant="ghost" href="${escapeHtml(back)}">← Back to list</a>
    <h2 style="margin:0">SO-${order.id}</h2>
    <div class="hc-cluster">
      <span>${index + 1} / ${rows.length}</span>
      ${step(prev, index, '‹', 'Previous record')}
      ${step(next, index + 2, '›', 'Next record')}
    </div>
  </header>
  <dl>
    <dt>Customer</dt><dd>${escapeHtml(order.customer)}</dd>
    <dt>Item</dt><dd>${escapeHtml(order.item)}</dd>
    <dt>Ship date</dt><dd>${order.ship}</dd>
    <dt>Amount</dt><dd>${order.amount.toLocaleString('en-US')}</dd>
    <dt>Row</dt><dd>${ordinal} of ${rows.length}</dd>
  </dl>
</article>`;
}

// ---- the handler -----------------------------------------------------

export async function handle({ method, path, url, request }) {
  const q = readQuery(url.searchParams);

  if (method === 'GET' && path === '/items') {
    if (!isHtmx(request)) {
      return page(
        'Data grid page demo',
        `${conditionsHtml(q)}<table><tbody>${rowsHtml(q)}</tbody></table>${pagerHtml(q)}`,
      );
    }
    return html(`${rowsHtml(q)}
${conditionsHtml(q, { oob: true })}
${pagerHtml(q, { oob: true })}
${summaryHtml('', { oob: true })}
${panelHtml({ oob: true })}`);
  }

  if (method === 'GET' && path === '/report') {
    const ids = url.searchParams.getAll('ids').map(Number).filter((n) => byId.has(n));
    const failures = new Map(
      ids.map((id) => [id, blockedReason(byId.get(id)) ?? 'Rejected by the server']),
    );
    const open = url.searchParams.get('close') !== '1' && failures.size > 0;
    return html(panelHtml({ failures, open }));
  }

  const record = method === 'GET' && path.match(/^\/items\/(\d+)$/);
  if (record) {
    const order = byId.get(Number(record[1]));
    if (!order) return html('<p>No such order.</p>', { status: 404 });
    const listQuery = readQuery(new URLSearchParams(url.searchParams.get('from') ?? ''));
    const ordinal = Number(url.searchParams.get('i') ?? 1);
    // TWO RENDERINGS OF ONE RESOURCE. `?peek=1` is the dialog the list
    // asks for; the bare URL is the record's own page, which is what
    // the row's href points at and what a browser with no JavaScript
    // (or a middle-click, or a shared link) gets.
    if (url.searchParams.get('peek') === '1') {
      return html(recordHtml(order, { q: listQuery, ordinal }));
    }
    return page(`SO-${order.id}`, recordPageHtml(order, { q: listQuery, ordinal }));
  }

  const save = method === 'POST' && path.match(/^\/items\/(\d+)$/);
  if (save) {
    const order = byId.get(Number(save[1]));
    if (!order) return html('<p>No such order.</p>', { status: 404 });
    const form = await request.formData();
    const ship = String(form.get('ship') ?? order.ship);
    const listQuery = readQuery(new URLSearchParams(String(form.get('from') ?? '')));
    const ordinal = Number(form.get('i') ?? 1);
    // The demo has no storage, so the row comes back showing what was
    // sent — which is what a real server would return after writing it.
    return html(
      rowHtml({ ...order, ship }, { ordinal, q: listQuery }),
    );
  }

  if (method === 'POST' && path === '/bulk') {
    const form = await request.formData();
    const ids = form.getAll('ids').map(Number).filter((n) => byId.has(n));
    const listQuery = readQuery(new URLSearchParams(String(form.get('from') ?? '')));
    if (ids.length === 0) {
      return html(
        summaryHtml(
          `<div class="hc-alert" data-variant="info" role="status"><p>Select rows first.</p></div>`,
        ),
      );
    }
    const failures = new Map();
    for (const id of ids) {
      const reason = blockedReason(byId.get(id));
      if (reason) failures.set(id, reason);
    }
    const ok = ids.length - failures.size;
    const failedIds = [...failures.keys()];
    const failedQs = queryString({
      ...listQuery,
      failedOnly: true,
      failedIds,
      pageNo: 1,
    });
    const filterHref = `${API}/items?${failedQs}`;
    const nav =
      failedIds.length > 1
        ? ` <a href="#template-grid-row-${failedIds[0]}">Previous</a> <span>Error 1 of ${failedIds.length} — row ${failedIds[0]}</span> <a href="#template-grid-row-${failedIds[1]}">Next</a> ·`
        : '';
    const summary = failures.size
      ? `<div class="hc-alert" data-variant="warning" role="status"><p class="hc-alert__body"><strong>${ok} approved / ${failures.size} could not be.</strong>${nav} <a href="${escapeHtml(filterHref)}" data-hx-get="${escapeHtml(filterHref)}" data-hx-target="#${IDS.rows}" data-hx-swap="innerHTML">Show only failed (${failures.size})</a></p></div>`
      : `<div class="hc-alert" data-variant="success" role="status"><p>${ok} approved.</p></div>`;
    return html(`${rowsHtml(listQuery, { failures })}
${summaryHtml(summary, { oob: true })}
${panelHtml({ failures, oob: true })}`);
  }

  return null;
}
