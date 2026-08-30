// datagrid-sort — recipes/datagrid-sort/contract.md
//
//   GET /items?sort=-ship,order
//     → 200 htmx: the grid fragment, sorted, its header cells carrying
//       the matching aria-sort / data-sort-index, plus OOB re-renders
//       of the trigger (the read-out) and the panel region
//     → 200 no-JS: a full page with the same sorted table
//   GET /sort?add=<col> / ?drop=<col>
//     → 200: the panel region (#…-keys) with the key appended / removed
//
// Both wire shapes are accepted: the joined `sort=-ship,order` that
// installSortList() sends, and the per-key `dir-<col>` params a no-JS
// submit sends IN DOM ORDER. They say the same thing; the server
// canonicalises to the joined form, which is what the trigger, the
// grid headers and a saved view all read.
//
// Stateless: the params fully determine the answer.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-sort`;
const GRID_ID = 'datagrid-sort-demo-grid';
const PANEL_ID = 'datagrid-sort-demo-panel';
const KEYS_ID = 'datagrid-sort-demo-keys';
const TRIGGER_ID = 'datagrid-sort-demo-trigger';

/** Every sortable column — including one the grid does not show, which
 * is exactly the case a header click cannot serve. */
const COLUMNS = [
  { key: 'order', label: 'Order', shown: true },
  { key: 'customer', label: 'Customer', shown: true },
  { key: 'ship', label: 'Ship date', shown: true },
  { key: 'amount', label: 'Amount', shown: true, numeric: true },
  { key: 'warehouse', label: 'Warehouse', shown: false },
];

const ROWS = [
  { order: 'SO-4901', customer: 'Northwind', ship: '2026-08-14', amount: 2610, warehouse: 'Osaka' },
  { order: 'SO-4902', customer: 'Contoso', ship: '2026-08-02', amount: 990, warehouse: 'Kobe' },
  { order: 'SO-4903', customer: 'Northwind', ship: '2026-08-02', amount: 4180, warehouse: 'Osaka' },
  { order: 'SO-4904', customer: 'Fabrikam', ship: '2026-09-01', amount: 1750, warehouse: 'Chiba' },
];

const byKey = new Map(COLUMNS.map((c) => [c.key, c]));

/**
 * The sort set a request asks for, whichever shape it arrived in: the
 * joined `sort=-ship,order`, or the per-key `dir-<col>` params a no-JS
 * submit sends in DOM order. Unknown keys are dropped — the server is
 * the schema — but the rest of the set survives, because refusing the
 * whole instruction over one stale key would be worse than answering
 * the part that still means something.
 */
export function readSort(params) {
  const joined = params.get('sort');
  const raw = joined
    ? joined.split(',')
    : [...params.keys()]
        .filter((name) => name.startsWith('dir-'))
        .map((name) => {
          const key = name.slice('dir-'.length);
          return params.get(name) === 'desc' ? `-${key}` : key;
        });
  const seen = new Set();
  const keys = [];
  for (const token of raw) {
    const desc = token.startsWith('-');
    const key = (desc ? token.slice(1) : token).trim();
    if (!key || seen.has(key) || !byKey.has(key)) continue;
    seen.add(key);
    keys.push({ key, desc });
  }
  return keys;
}

const wireOf = (keys) => keys.map((k) => (k.desc ? `-${k.key}` : k.key)).join(',');

/** The trigger IS the read-out: it says the whole set, in order. */
function triggerHtml(keys, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const label =
    keys.length === 0
      ? 'Sort: default'
      : `Sort (${keys.length}): ${keys
          .map((k) => `${byKey.get(k.key).label} ${k.desc ? '↓' : '↑'}`)
          .join(', ')}`;
  return `<button class="hc-button" data-variant="${keys.length ? 'secondary' : 'ghost'}" type="button" id="${TRIGGER_ID}" popovertarget="${PANEL_ID}"${oobAttr}>${escapeHtml(label)}</button>`;
}

/**
 * The panel region: the ordered keys plus the add control. Add and
 * remove answer THIS element, and it opts out of the close-on-success
 * glue — a panel that edits itself must not dismiss itself.
 */
function keysHtml(keys, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const rows = keys
    .map(({ key, desc }) => {
      const label = byKey.get(key).label;
      return `<li class="hc-item" data-hc-sortable-id="${key}" data-hc-sort-key="${key}">
        <button class="hc-button" data-variant="ghost" data-size="sm" type="button" data-hc-sortable-handle aria-label="Reorder ${escapeHtml(label)}">⠿</button>
        <span class="hc-item__title">${escapeHtml(label)}</span>
        <select class="hc-select" data-size="sm" name="dir-${key}" aria-label="${escapeHtml(label)} direction">
          <option value="asc"${desc ? '' : ' selected'}>Ascending</option>
          <option value="desc"${desc ? ' selected' : ''}>Descending</option>
        </select>
        <button class="hc-button" data-variant="ghost" data-size="sm" type="submit" name="drop" value="${key}" formaction="${API}/sort" data-hx-get="${API}/sort?drop=${key}" data-hx-include="closest form" data-hx-target="#${KEYS_ID}" data-hx-swap="outerHTML" aria-label="Remove ${escapeHtml(label)} from the sort">Remove</button>
      </li>`;
    })
    .join('\n      ');

  const used = new Set(keys.map((k) => k.key));
  const options = COLUMNS.filter((c) => !used.has(c.key))
    .map(
      (c) =>
        `<option value="${c.key}">${escapeHtml(c.label)}${c.shown ? '' : ' (not shown)'}</option>`,
    )
    .join('');

  const empty = `<p class="hc-field__hint">No sort — the server's default ordering.</p>`;

  return `<div class="hc-popover__body" id="${KEYS_ID}" data-hc-close-popover-on-success="false"${oobAttr}>
  ${keys.length ? `<ul class="hc-stack" data-hc-sortable data-hc-sort-list="sort">\n      ${rows}\n    </ul>` : empty}
  <div class="hc-field">
    <label class="hc-field__label" for="${KEYS_ID}-add">Add a column</label>
    <select class="hc-select" id="${KEYS_ID}-add" name="add">
      <option value="">Choose…</option>
      ${options}
    </select>
    <button class="hc-button" data-size="sm" type="submit" formaction="${API}/sort" data-hx-get="${API}/sort" data-hx-include="closest form" data-hx-target="#${KEYS_ID}" data-hx-swap="outerHTML">Add</button>
  </div>
</div>`;
}

function panelHtml(keys) {
  return `<div class="hc-popover" id="${PANEL_ID}" popover data-side="bottom" data-align="start" aria-labelledby="${TRIGGER_ID}">
  <form action="${API}/items" method="get" data-hx-get="${API}/items" data-hx-target="#${GRID_ID}" data-hc-close-popover-on-success>
    ${keysHtml(keys)}
    <footer class="hc-popover__footer">
      <button class="hc-button" data-variant="primary" type="submit">Apply</button>
    </footer>
  </form>
</div>`;
}

/** Rows in the requested order. Ties break on the primary key, always:
 * without a stable tiebreak, paging a low-cardinality sort repeats and
 * drops rows between requests. */
function sortRows(keys) {
  const rows = [...ROWS];
  rows.sort((a, b) => {
    for (const { key, desc } of keys) {
      const col = byKey.get(key);
      const va = a[key];
      const vb = b[key];
      const cmp = col.numeric ? va - vb : String(va).localeCompare(String(vb));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return String(a.order).localeCompare(String(b.order));
  });
  return rows;
}

function gridHtml(keys) {
  const index = new Map(keys.map((k, i) => [k.key, { i: i + 1, desc: k.desc }]));
  const heads = COLUMNS.filter((c) => c.shown)
    .map((c) => {
      const hit = index.get(c.key);
      const sorted = hit
        ? ` aria-sort="${hit.desc ? 'descending' : 'ascending'}"${keys.length > 1 ? ` data-sort-index="${hit.i}"` : ''}`
        : '';
      return `<th class="hc-datagrid__headcell" data-sortable data-col="${c.key}" scope="col"${c.numeric ? ' data-numeric' : ''}${sorted}>${escapeHtml(c.label)}</th>`;
    })
    .join('\n        ');
  const body = sortRows(keys)
    .map(
      (row) =>
        `<tr class="hc-datagrid__row">${COLUMNS.filter((c) => c.shown)
          .map(
            (c) =>
              `<td class="hc-datagrid__cell"${c.numeric ? ' data-numeric' : ''}>${escapeHtml(String(c.numeric ? row[c.key].toLocaleString('en-US') : row[c.key]))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('\n      ');
  return `<div class="hc-datagrid__scroll">
  <table class="hc-datagrid__table">
    <thead class="hc-datagrid__head">
      <tr>
        ${heads}
      </tr>
    </thead>
    <tbody class="hc-datagrid__body">
      ${body}
    </tbody>
  </table>
</div>`;
}

export function handle({ method, path, url, request }) {
  if (method !== 'GET') return null;

  // Adding and removing a key are SERVER round trips: which columns are
  // available is the server's knowledge (permissions, the column set,
  // the data), so the client never invents a row.
  if (path === '/sort') {
    const keys = readSort(url.searchParams);
    const add = url.searchParams.get('add');
    const drop = url.searchParams.get('drop');
    let next = keys;
    if (drop) next = keys.filter((k) => k.key !== drop);
    if (add && byKey.has(add) && !keys.some((k) => k.key === add)) {
      next = [...next, { key: add, desc: false }];
    }
    return html(keysHtml(next));
  }

  if (path !== '/items') return null;

  const keys = readSort(url.searchParams);

  if (isHtmx(request)) {
    return html(`${gridHtml(keys)}
${triggerHtml(keys, { oob: true })}
${keysHtml(keys, { oob: true })}`);
  }

  // No-JS fallback: the panel is a real GET form, so Apply navigates
  // here — with the per-key dir-<col> params, in DOM order.
  const rows = sortRows(keys)
    .map(
      (row) =>
        `<tr>${COLUMNS.filter((c) => c.shown)
          .map((c) => `<td>${escapeHtml(String(row[c.key]))}</td>`)
          .join('')}</tr>`,
    )
    .join('\n');
  return page(
    'Datagrid sort demo',
    `${triggerHtml(keys)}
${panelHtml(keys)}
<table>
  <thead><tr>${COLUMNS.filter((c) => c.shown)
    .map((c) => `<th>${escapeHtml(c.label)}</th>`)
    .join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`,
  );
}
