// datagrid-columns — recipes/datagrid-columns/contract.md
//
//   GET /items?cols=name&cols=status&…
//     → 200 htmx: the grid fragment (scroll + table) with exactly the
//       requested columns in the server's canonical order, plus an OOB
//       outerHTML re-render of the chooser form with matching checked
//       states
//     → 200 no-JS: a full page with the same chooser + table (the
//       chooser is a real GET form, so Apply navigates here)
//     absent/empty cols → the default set (all four); unknown col
//     names are ignored — the server is the schema — and an
//     unknown-only request falls back to the default set too
//
// Stateless: the cols= params fully determine the answer. Persisting
// the choice per user (session, profile) is a real server's option,
// not part of the wire contract.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-columns`;
const GRID_ID = 'datagrid-columns-demo-grid';
const CHOOSER_ID = 'datagrid-columns-demo-chooser';
const FIELDS_ID = 'datagrid-columns-demo-fields';

/** Canonical column order — the requested set wins, this order does. */
const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'updated', label: 'Updated' },
];

const ITEMS = [
  { name: 'Ingest pipeline', status: 'Active', owner: 'Ada', updated: '2026-08-01' },
  { name: 'Nightly backup', status: 'Active', owner: 'Grace', updated: '2026-08-03' },
  { name: 'Billing export', status: 'Pending', owner: 'Alan', updated: '2026-08-05' },
  { name: 'Legacy sync', status: 'Failed', owner: 'Mary', updated: '2026-07-28' },
];

/** Requested columns → the canonical subset (default: all). */
function selectColumns(requested) {
  const wanted = new Set(requested);
  const selected = COLUMNS.filter((col) => wanted.has(col.key));
  return selected.length > 0 ? selected : COLUMNS;
}

/**
 * The chooser form — the complete element (outerHTML is the OOB swap),
 * checked states matching the rendered columns.
 */
// The OOB unit is the FIELDSET, never the form: the form carries
// data-hc-close-popover-on-success, and replacing it mid-request would
// detach the attribute carrier before htmx:afterRequest — the popover
// would never close (close-popover resolves closest() from the event
// target).
function fieldsHtml(selected, { oob = false } = {}) {
  const shown = new Set(selected.map((col) => col.key));
  const boxes = COLUMNS.map(
    (col) =>
      `<label class="hc-checkbox-label"><input class="hc-checkbox" type="checkbox" name="cols" value="${col.key}"${shown.has(col.key) ? ' checked' : ''}> ${escapeHtml(col.label)}</label>`,
  ).join('\n  ');
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  return `<fieldset class="hc-popover__body" id="${FIELDS_ID}"${oobAttr}>
  ${boxes}
  </fieldset>`;
}

function chooserHtml(selected) {
  return `<form id="${CHOOSER_ID}" action="${API}/items" method="get" data-hx-get="${API}/items" data-hx-target="#${GRID_ID}" data-hc-close-popover-on-success>
  ${fieldsHtml(selected)}
  <footer class="hc-popover__footer"><button class="hc-button" type="submit" data-variant="primary">Apply</button></footer>
</form>`;
}

/** The grid wrapper's innerHTML: scroll + table with only `selected`. */
function gridHtml(selected) {
  const head = selected
    .map((col) => `<th class="hc-datagrid__headcell" scope="col">${escapeHtml(col.label)}</th>`)
    .join('');
  const rows = ITEMS.map(
    (item) =>
      `<tr class="hc-datagrid__row">${selected
        .map((col) => `<td class="hc-datagrid__cell">${escapeHtml(item[col.key])}</td>`)
        .join('')}</tr>`,
  ).join('\n      ');
  return `<div class="hc-datagrid__scroll">
  <table class="hc-datagrid__table">
    <thead class="hc-datagrid__head">
      <tr>${head}</tr>
    </thead>
    <tbody class="hc-datagrid__body">
      ${rows}
    </tbody>
  </table>
</div>`;
}

export function handle({ method, path, url, request }) {
  if (method !== 'GET' || path !== '/items') return null;

  const selected = selectColumns(url.searchParams.getAll('cols'));

  if (isHtmx(request)) {
    // The grid for the wrapper's innerHTML, plus the chooser
    // re-rendered out-of-band with matching checked states.
    return html(`${gridHtml(selected)}
${fieldsHtml(selected, { oob: true })}`);
  }

  // No-JS fallback: the chooser is a real GET form — a plain submit
  // navigates here, so answer with a usable page (same columns).
  const headerRow = selected.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  const bodyRows = ITEMS.map(
    (item) => `<tr>${selected.map((col) => `<td>${escapeHtml(item[col.key])}</td>`).join('')}</tr>`,
  ).join('\n');
  return page(
    'Datagrid columns demo',
    `${chooserHtml(selected)}
<table>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`,
  );
}
