// result-cap — recipes/result-cap/contract.md
//
//   GET /orders?q=…&mode=truncate|reject → 200 always:
//     ≤ cap hits          rows + exact count, no banner
//     over cap, truncate  first cap rows + warning banner + "cap+" count
//     over cap, reject    no rows + hc-empty reject block
//     0 hits              the normal empty state
//
// Stateless: a deterministic set of 90 fake orders derived from the
// row index alone, "sorted by order date (oldest first)" by
// construction. The demo cap is 25 so the empty search truncates.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/result-cap`;

const CAP = 25;
const TOTAL = 90;

// Coprime list lengths (13 × 11) so cycling yields distinct customers.
const ADJECTIVES = [
  'Aerodynamic', 'Compact', 'Durable', 'Ergonomic', 'Foldable',
  'Gigantic', 'Heavy-duty', 'Incredible', 'Luminous', 'Modular',
  'Portable', 'Rustic', 'Sleek',
];
const NOUNS = [
  'Anvil', 'Bearing', 'Camshaft', 'Dynamo', 'Flywheel', 'Gasket',
  'Hinge', 'Impeller', 'Piston', 'Sprocket', 'Widget',
];

/** Deterministic order for 1-based index i — dates ascend with i. */
function order(i) {
  const day = new Date(Date.UTC(2026, 0, 1 + (i - 1) * 3));
  return {
    id: `ORD-${1000 + i}`,
    customer: `${ADJECTIVES[(i - 1) % ADJECTIVES.length]} ${NOUNS[(i - 1) % NOUNS.length]} Co.`,
    date: day.toISOString().slice(0, 10),
  };
}

const ALL = Array.from({ length: TOTAL }, (_, idx) => order(idx + 1));

function rowsHtml(orders) {
  const items = orders.map(
    (o) => `  <li>${o.id} — ${escapeHtml(o.customer)} — <time>${o.date}</time></li>`,
  );
  return `<ul>\n${items.join('\n')}\n</ul>`;
}

function bannerHtml() {
  return `<div class="hc-alert" data-variant="warning" role="status" data-hc-result-cap>
  <p class="hc-alert__title">Showing the first ${CAP} results.</p>
  <p class="hc-alert__body">More than ${CAP} orders match, sorted by
    order date (oldest first). Narrow the search to see the rest, or
    export the full set to CSV.</p>
</div>`;
}

function rejectHtml() {
  return `<div class="hc-empty" data-hc-result-cap role="status">
  <div class="hc-empty__media" aria-hidden="true">🔍</div>
  <p class="hc-empty__title">More than ${CAP} orders match.</p>
  <p class="hc-empty__description">Narrow the search to at most ${CAP}
    orders, then work the list. Nothing is shown so that no order can
    be silently cut off.</p>
</div>`;
}

function emptyHtml(q) {
  return `<div class="hc-empty" role="status">
  <div class="hc-empty__media" aria-hidden="true">📭</div>
  <p class="hc-empty__title">No orders match “${escapeHtml(q)}”.</p>
  <p class="hc-empty__description">Try a shorter or different term.</p>
</div>`;
}

/** The #results fragment — the contract's four branches. */
function resultsHtml(q, mode) {
  const needle = q.trim().toLowerCase();
  // The contract's LIMIT cap+1: stop collecting past cap+1 hits.
  const hits = [];
  for (const o of ALL) {
    if (needle && !`${o.id} ${o.customer}`.toLowerCase().includes(needle)) continue;
    hits.push(o);
    if (hits.length > CAP) break;
  }

  if (hits.length === 0) return emptyHtml(q);
  if (hits.length <= CAP) {
    return `<p aria-live="polite">${hits.length} result${hits.length === 1 ? '' : 's'}</p>
${rowsHtml(hits)}`;
  }
  if (mode === 'reject') return rejectHtml();
  return `${bannerHtml()}
<p aria-live="polite">${CAP}+ results</p>
${rowsHtml(hits.slice(0, CAP))}`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/orders') {
    const q = url.searchParams.get('q') ?? '';
    const mode = url.searchParams.get('mode') === 'reject' ? 'reject' : 'truncate';
    const fragment = resultsHtml(q, mode);

    if (isHtmx(request)) return html(fragment);

    // No-JS fallback: the form's action GETs here — render a full
    // page with the same branch server-rendered.
    return page(
      'Result cap demo',
      `<form action="${API}/orders" method="get" role="search">
  <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Search orders">
  <select name="mode">
    <option value="truncate"${mode === 'truncate' ? ' selected' : ''}>Truncate over the cap</option>
    <option value="reject"${mode === 'reject' ? ' selected' : ''}>Reject over the cap</option>
  </select>
  <button type="submit">Search</button>
</form>
${fragment}`,
    );
  }

  return null;
}
