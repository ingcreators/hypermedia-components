// row-detail — recipes/row-detail/contract.md
//
//   GET /items?page=<n>
//     → the list fragment: rows whose identity cell holds a real
//       <a href>, each carrying its ordinal (data-row-no) and a stable
//       id, so the detail can come back to the row
//   GET /items/<id>?from=<list url>&seq=list&i=<ordinal>
//     → the record, with Back to list = <list url>#row-<id> and
//       neighbours resolved by RE-RUNNING the list query, so "next"
//       crosses a page boundary without the client knowing pages exist
//   POST /selections  (the ids checkboxes)
//     → 303 to the first record of an ordered SNAPSHOT
//   GET /items/<id>?seq=<token>&i=<n>
//     → the record at that position within the snapshot; a record that
//       no longer exists is a TOMBSTONE step (Next still works), and an
//       unreadable token is 410 — never a silent fallback to walking
//       everything
//
// Stateless (the live-demos doctrine): a real server stores the
// snapshot per user and expires it; this demo packs the ids into the
// token itself so the walk survives without storage. The wire contract
// is the same either way.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/row-detail`;
const LIST_ID = 'row-detail-demo-list';
const RECORD_ID = 'row-detail-demo-record';
const PAGE_SIZE = 3;

const ORDERS = [
  { id: 4901, customer: 'Northwind', ship: '2026-08-14' },
  { id: 4902, customer: 'Contoso', ship: '2026-08-02' },
  { id: 4903, customer: 'Northwind', ship: '2026-08-02' },
  { id: 4904, customer: 'Fabrikam', ship: '2026-09-01' },
  { id: 4905, customer: 'Adventure Works', ship: '2026-08-21' },
  { id: 4906, customer: 'Contoso', ship: '2026-08-30' },
];

const byId = new Map(ORDERS.map((o) => [o.id, o]));

/** The list query IS the sequence: ordinals are positions in it. */
const ordinalOf = (id) => ORDERS.findIndex((o) => o.id === id) + 1;

/** `sel-4901-4903-4999` — an ordered snapshot, packed into the token. */
function packSelection(ids) {
  return `sel-${ids.join('-')}`;
}

/**
 * Read a snapshot token. `null` means unreadable — the caller answers
 * 410 rather than widening the walk to everything, which is the one
 * failure mode this whole programme refuses.
 */
export function unpackSelection(token) {
  if (typeof token !== 'string' || !token.startsWith('sel-')) return null;
  const ids = token
    .slice('sel-'.length)
    .split('-')
    .map((part) => Number(part));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return ids;
}

/** The neighbours of a position in a sequence, as ids (null at an end). */
function neighbours(sequence, index) {
  return {
    prev: index > 0 ? sequence[index - 1] : null,
    next: index < sequence.length - 1 ? sequence[index + 1] : null,
  };
}

function listUrl(pageNo) {
  return `${API}/items?page=${pageNo}`;
}

function rowHtml(order, { pageNo }) {
  const no = ordinalOf(order.id);
  const from = encodeURIComponent(listUrl(pageNo));
  const href = `${API}/items/${order.id}?from=${from}&seq=list&i=${no}`;
  return `<tr class="hc-datagrid__row" id="row-detail-demo-row-${order.id}" data-row-no="${no}">
  <td class="hc-datagrid__cell"><input class="hc-checkbox" type="checkbox" name="ids" value="${order.id}" aria-label="Select SO-${order.id}"></td>
  <td class="hc-datagrid__cell" data-numeric>${no}</td>
  <th class="hc-datagrid__cell" scope="row"><a href="${escapeHtml(href)}" data-hc-row-link data-hx-get="${escapeHtml(href)}" data-hx-target="#${RECORD_ID}" data-hx-swap="innerHTML">SO-${order.id}</a></th>
  <td class="hc-datagrid__cell">${escapeHtml(order.customer)}</td>
  <td class="hc-datagrid__cell">${order.ship}</td>
</tr>`;
}

function listHtml(pageNo) {
  const start = (pageNo - 1) * PAGE_SIZE;
  const rows = ORDERS.slice(start, start + PAGE_SIZE)
    .map((order) => rowHtml(order, { pageNo }))
    .join('\n');
  const pages = Math.ceil(ORDERS.length / PAGE_SIZE);
  const pager = Array.from({ length: pages }, (_, i) => i + 1)
    .map(
      (n) =>
        `<a class="hc-pagination__item"${n === pageNo ? ' aria-current="page"' : ''} href="${listUrl(n)}" data-hx-get="${listUrl(n)}" data-hx-target="#${LIST_ID}" data-hx-swap="innerHTML">${n}</a>`,
    )
    .join('');
  return `<form id="row-detail-demo-form" action="${API}/selections" method="post" data-hx-post="${API}/selections" data-hx-target="#${RECORD_ID}" data-hx-swap="innerHTML">
  <div class="hc-toolbar" role="toolbar" aria-label="Record actions">
    <button class="hc-button" data-variant="secondary" type="submit">Open selected</button>
  </div>
  <div class="hc-datagrid" data-row-total="${ORDERS.length}">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell" scope="col"><span class="hc-sr-only">Select</span></th>
            <th class="hc-datagrid__headcell" scope="col" data-numeric>#</th>
            <th class="hc-datagrid__headcell" scope="col">Order</th>
            <th class="hc-datagrid__headcell" scope="col">Customer</th>
            <th class="hc-datagrid__headcell" scope="col">Ship date</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__body">
${rows}
        </tbody>
      </table>
    </div>
  </div>
  <nav class="hc-pagination" aria-label="Pages">${pager}</nav>
</form>`;
}

/** Prev / next + the counter, the same shape for either sequence. */
function walkHtml({ prev, next, position, total, label, seq, from }) {
  const href = (id) =>
    `${API}/items/${id}?${new URLSearchParams({ seq, i: String(id === prev ? position - 1 : position + 1), ...(from ? { from } : {}) })}`;
  const back = from ? decodeURIComponent(from) : listUrl(1);
  return `<div class="hc-cluster" style="justify-content: space-between;">
  <div class="hc-cluster">
    ${prev ? `<a class="hc-button" data-size="sm" href="${escapeHtml(href(prev))}" data-hx-get="${escapeHtml(href(prev))}" data-hx-target="#${RECORD_ID}" data-hx-swap="innerHTML">Previous</a>` : '<span class="hc-button" data-size="sm" aria-disabled="true">Previous</span>'}
    <span>${escapeHtml(label)}</span>
    ${next ? `<a class="hc-button" data-size="sm" href="${escapeHtml(href(next))}" data-hx-get="${escapeHtml(href(next))}" data-hx-target="#${RECORD_ID}" data-hx-swap="innerHTML">Next</a>` : '<span class="hc-button" data-size="sm" aria-disabled="true">Next</span>'}
  </div>
  <a class="hc-button" data-variant="ghost" href="${escapeHtml(back)}">Back to list</a>
</div>`;
}

function recordHtml(order, walk) {
  return `<article class="hc-card">
  <header class="hc-cluster" style="justify-content: space-between;">
    <h3 style="margin:0">SO-${order.id}</h3>
  </header>
  ${walk}
  <dl>
    <dt>Customer</dt><dd>${escapeHtml(order.customer)}</dd>
    <dt>Ship date</dt><dd>${order.ship}</dd>
    <dt>Row</dt><dd>${ordinalOf(order.id)} of ${ORDERS.length}</dd>
  </dl>
</article>`;
}

/** A record in the snapshot that no longer exists. A step, not a wall:
 * aborting the walk at the first gap makes it untrustworthy exactly
 * when the data is moving. */
function tombstoneHtml(id, walk) {
  return `<article class="hc-card">
  <h3 style="margin:0">SO-${id}</h3>
  ${walk}
  <div class="hc-alert" data-variant="warning" role="status">
    <p>This record is no longer available — it was deleted or moved out of scope after the selection was taken. <strong>Next still works.</strong></p>
  </div>
</article>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const pageNo = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const fragment = `<div id="${LIST_ID}">${listHtml(pageNo)}</div>`;
    if (isHtmx(request)) return html(listHtml(pageNo));
    return page('Row detail demo', fragment);
  }

  // The selection is not a query, so it has to be carried: POST the ids
  // once, walk an ordered snapshot afterwards.
  if (method === 'POST' && path === '/selections') {
    const form = await request.formData();
    const ids = form.getAll('ids').map(Number).filter(Boolean);
    if (ids.length === 0) {
      return html(
        `<div class="hc-alert" data-variant="info" role="status"><p>Select rows first, then press <strong>Open selected</strong>.</p></div>`,
      );
    }
    const token = packSelection(ids);
    const first = ids[0];
    const target = `${API}/items/${first}?seq=${token}&i=1`;
    // 303 in the no-JS path; htmx follows a client redirect header.
    if (isHtmx(request)) {
      return html('', { headers: { 'HX-Location': target } });
    }
    return new Response(null, { status: 303, headers: { Location: target } });
  }

  const match = method === 'GET' && path.match(/^\/items\/(\d+)$/);
  if (!match) return null;

  const id = Number(match[1]);
  const seq = url.searchParams.get('seq') ?? 'list';
  const from = url.searchParams.get('from');

  if (seq === 'list') {
    const index = ORDERS.findIndex((o) => o.id === id);
    if (index < 0) return html('<p>No such record.</p>', { status: 404 });
    const sequence = ORDERS.map((o) => o.id);
    const { prev, next } = neighbours(sequence, index);
    const walk = walkHtml({
      prev,
      next,
      position: index + 1,
      total: sequence.length,
      label: `Record ${index + 1} of ${sequence.length}`,
      seq: 'list',
      from,
    });
    return html(recordHtml(byId.get(id), walk));
  }

  const sequence = unpackSelection(seq);
  // FAIL CLOSED. An unreadable or expired snapshot is 410 with a way
  // back — never "walk everything instead", which would widen the set
  // the user asked for.
  if (!sequence) {
    return html(
      `<div class="hc-alert" data-variant="error" role="alert"><p><strong>That selection has expired.</strong> Nothing was widened — <a href="${listUrl(1)}">go back to the list</a> and select again.</p></div>`,
      { status: 410 },
    );
  }
  const index = sequence.indexOf(id);
  if (index < 0) return html('<p>That record is not in this selection.</p>', { status: 404 });
  const { prev, next } = neighbours(sequence, index);
  const walk = walkHtml({
    prev,
    next,
    position: index + 1,
    total: sequence.length,
    label: `Record ${index + 1} of ${sequence.length} selected`,
    seq,
    from,
  });
  const order = byId.get(id);
  return html(order ? recordHtml(order, walk) : tombstoneHtml(id, walk));
}
