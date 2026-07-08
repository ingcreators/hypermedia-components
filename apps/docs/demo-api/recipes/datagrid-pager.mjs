// datagrid-pager — recipes/datagrid-pager/contract.md
//
//   GET /products?page=N&size=S → 200, only the page's rows (the
//                                 tbody's innerHTML) + OOB pager + OOB
//                                 status (htmx), or the full page with
//                                 that page's rows (no HX-Request)
//
// Stateless: 5,000 deterministic fake products derived from the row
// index alone. Defaults page=1 size=100; size clamps to [10, 200],
// page to [1, ceil(5000/size)]. The pager shows a window of the
// current page ±2 plus first/last, with ellipses when gapped.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-pager`;
const ROWS_ID = 'datagrid-pager-demo-rows';
const PAGER_ID = 'datagrid-pager-demo-pager';
const STATUS_ID = 'datagrid-pager-demo-status';

const TOTAL = 5000;

// Coprime list lengths (13 × 11) so cycling yields 143 distinct names.
const ADJECTIVES = [
  'Aerodynamic', 'Compact', 'Durable', 'Ergonomic', 'Foldable',
  'Gigantic', 'Heavy-duty', 'Incredible', 'Luminous', 'Modular',
  'Portable', 'Rustic', 'Sleek',
];
const NOUNS = [
  'Anvil', 'Bearing', 'Camshaft', 'Dynamo', 'Flywheel', 'Gasket',
  'Hinge', 'Impeller', 'Piston', 'Sprocket', 'Widget',
];

/** Deterministic product for 1-based row index i (of 5,000). */
function product(i) {
  return {
    id: 100 + i,
    name: `${ADJECTIVES[(i - 1) % ADJECTIVES.length]} ${NOUNS[(i - 1) % NOUNS.length]}`,
    price: 100 + ((i * 137) % 9900),
  };
}

const thousands = (n) => n.toLocaleString('en-US');

function clamp(value, min, max, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function rowHtml(i) {
  const { id, name, price } = product(i);
  return `<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" aria-label="Select ${escapeHtml(name)}"></td>
  <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">${id}</th>
  <td class="hc-datagrid__cell" data-col="name">${escapeHtml(name)}</td>
  <td class="hc-datagrid__cell">$${thousands(price)}</td>
</tr>`;
}

function rowsHtml(page, size) {
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, TOTAL);
  const rows = [];
  for (let i = first; i <= last; i += 1) rows.push(rowHtml(i));
  return rows.join('\n');
}

function pageUrl(p, size) {
  return `${API}/products?page=${p}&size=${size}`;
}

/**
 * One pager entry. Live entries carry the htmx wiring plus a real
 * `href="?page=N"` no-JS path; disabled Prev/Next keep only the href.
 */
function itemHtml(p, size, { label = String(p), rel, current = false, disabled = false } = {}) {
  const relAttr = rel ? ` data-hc-rel="${rel}"` : '';
  if (disabled) {
    return `<a class="hc-pagination__item"${relAttr} aria-disabled="true" href="?page=${p}&size=${size}">${label}</a>`;
  }
  const currentAttr = current ? ' aria-current="page"' : '';
  return `<a class="hc-pagination__item"${relAttr}${currentAttr} href="?page=${p}&size=${size}" data-hx-get="${pageUrl(p, size)}" data-hx-target="#${ROWS_ID}" data-hx-swap="innerHTML">${label}</a>`;
}

/** Numeric window: current ±2 plus first/last, ellipses when gapped. */
function numberedItems(page, last, size) {
  const pages = new Set([1, last]);
  for (let p = page - 2; p <= page + 2; p += 1) {
    if (p >= 1 && p <= last) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push('<span class="hc-pagination__ellipsis">…</span>');
    items.push(itemHtml(p, size, { current: p === page }));
    prev = p;
  }
  return items;
}

function pagerHtml(page, size, { oob = false } = {}) {
  const last = Math.ceil(TOTAL / size);
  const items = [
    page === 1
      ? itemHtml(1, size, { label: 'Prev', rel: 'prev', disabled: true })
      : itemHtml(page - 1, size, { label: 'Prev', rel: 'prev' }),
    ...numberedItems(page, last, size),
    page === last
      ? itemHtml(last, size, { label: 'Next', rel: 'next', disabled: true })
      : itemHtml(page + 1, size, { label: 'Next', rel: 'next' }),
  ];
  const oobAttr = oob ? ' hx-swap-oob="true"' : '';
  return `<nav class="hc-pagination" id="${PAGER_ID}"${oobAttr} aria-label="Pagination">
  ${items.join('\n  ')}
</nav>`;
}

function statusHtml(page, size, { oob = false } = {}) {
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, TOTAL);
  const oobAttr = oob ? ' hx-swap-oob="true"' : '';
  return `<p id="${STATUS_ID}"${oobAttr} aria-live="polite">${thousands(first)}–${thousands(last)} / ${thousands(TOTAL)}</p>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/products') {
    const size = clamp(url.searchParams.get('size'), 10, 200, 100);
    const lastPage = Math.ceil(TOTAL / size);
    const page_ = clamp(url.searchParams.get('page'), 1, lastPage, 1);

    if (isHtmx(request)) {
      // The page's rows for the tbody, plus the pager and status
      // updated out-of-band in the same response.
      return html(
        `${rowsHtml(page_, size)}
${pagerHtml(page_, size, { oob: true })}
${statusHtml(page_, size, { oob: true })}`,
      );
    }

    // No-JS fallback: the pager hrefs (`?page=N&size=S`) navigate here
    // as normal GETs — render a usable full page with that window.
    return page(
      'Datagrid pager demo',
      `${statusHtml(page_, size)}
<table>
  <thead><tr><th></th><th>ID</th><th>Name</th><th>Unit price</th></tr></thead>
  <tbody>${rowsHtml(page_, size)}</tbody>
</table>
${pagerHtml(page_, size)}`,
    );
  }

  return null;
}
