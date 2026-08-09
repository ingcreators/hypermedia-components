// datagrid-infinite — recipes/datagrid-infinite/contract.md
//
//   GET /items[?after=item-N]
//     → 200 htmx: the next <tr> batch + a new sentinel row carrying
//       the next cursor — or, at the end of the list, the batch
//       (possibly empty) with NO sentinel, closed by the end-of-list
//       marker row ("15 of 15", aria-live polite)
//     → 200 no-JS: a full page with that window (the sentinel is inert
//       without htmx; page 1 is served by the docs demo markup)
//     stale/garbled cursors resume from the nearest stable point —
//     always 200, scrolling is not an error
//
// Stateless: 15 deterministic fake products (batches of 5) derived
// from the row index alone; the cursor is the last row's id
// (`after=item-N`), never a page number.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-infinite`;

const TOTAL = 15;
const BATCH = 5;

// Coprime list lengths so cycling yields distinct names.
const ADJECTIVES = ['Compact', 'Durable', 'Foldable', 'Luminous'];
const NOUNS = ['Anvil', 'Sprocket', 'Widget'];

/** Deterministic product for 1-based row index i. */
function product(i) {
  return {
    id: `item-${i}`,
    name: `${ADJECTIVES[(i - 1) % ADJECTIVES.length]} ${NOUNS[(i - 1) % NOUNS.length]}`,
    price: 100 + ((i * 37) % 400),
    stock: (i * 7) % 30,
  };
}

function rowHtml(i) {
  const { id, name, price, stock } = product(i);
  return `<tr class="hc-datagrid__row">
  <th class="hc-datagrid__cell" scope="row">${id}</th>
  <td class="hc-datagrid__cell">${escapeHtml(name)}</td>
  <td class="hc-datagrid__cell">$${price}</td>
  <td class="hc-datagrid__cell">${stock}</td>
</tr>`;
}

// The docs demo is the CONTAINER-SCROLLED variant: the grid keeps its
// own scrollbar, so the sentinel uses `intersect once root:<scroll>`
// (IntersectionObserver, container-aware) instead of the
// window-viewport `revealed` — which, with only 15 demo rows, would
// chain-load everything on a tall screen before any scrolling. The
// contract's page-scroll shape keeps `revealed`; see its
// container-scrolled carve-out.
const DEMO_ROOT = '#datagrid-infinite-demo-scroll';

function sentinelHtml(afterIndex) {
  return `<tr class="hc-datagrid__row" data-hx-get="${API}/items?after=item-${afterIndex}" data-hx-trigger="intersect once root:${DEMO_ROOT} threshold:0.5" data-hx-swap="outerHTML">
  <td class="hc-datagrid__cell" colspan="4" aria-live="polite"><span class="hc-spinner" aria-hidden="true"></span> Loading…</td>
</tr>`;
}

function endMarkerHtml() {
  return `<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell" colspan="4" aria-live="polite">${TOTAL} of ${TOTAL}</td>
</tr>`;
}

/**
 * The cursor is resumable, never an error: `item-N` clamps into
 * [0, TOTAL]; anything unparsable resumes from the start (the demo's
 * nearest stable point).
 */
function cursorIndex(after) {
  const n = Number.parseInt(after?.match(/^item-(\d+)$/)?.[1] ?? '', 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(TOTAL, Math.max(0, n));
}

/** The batch fragment: rows after the cursor + sentinel or end row. */
function batchHtml(afterIndex) {
  const last = Math.min(afterIndex + BATCH, TOTAL);
  const rows = [];
  for (let i = afterIndex + 1; i <= last; i += 1) rows.push(rowHtml(i));
  rows.push(last < TOTAL ? sentinelHtml(last) : endMarkerHtml());
  return rows.join('\n');
}

export function handle({ method, path, url, request }) {
  if (method !== 'GET' || path !== '/items') return null;

  const afterIndex = cursorIndex(url.searchParams.get('after'));

  if (isHtmx(request)) return html(batchHtml(afterIndex));

  // No-JS fallback: a direct navigation gets a readable page with the
  // same window (the sentinel row is inert without htmx).
  const last = Math.min(afterIndex + BATCH, TOTAL);
  const rows = [];
  for (let i = afterIndex + 1; i <= last; i += 1) {
    const { id, name, price, stock } = product(i);
    rows.push(`<tr><th scope="row">${id}</th><td>${escapeHtml(name)}</td><td>$${price}</td><td>${stock}</td></tr>`);
  }
  return page(
    'Datagrid infinite demo',
    `<p>${afterIndex + 1}–${last} of ${TOTAL}</p>
<table>
  <thead><tr><th>ID</th><th>Product</th><th>Price</th><th>Stock</th></tr></thead>
  <tbody>${rows.join('\n')}</tbody>
</table>
${last < TOTAL ? `<p><a href="${API}/items?after=item-${last}">More</a></p>` : ''}`,
  );
}
