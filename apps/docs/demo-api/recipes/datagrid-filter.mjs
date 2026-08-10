// datagrid-filter — recipes/datagrid-filter/contract.md
//
//   GET /items?f-status=active&…
//     → 200 htmx: the grid fragment (scroll + table) with only matching
//       rows — the Status header's trigger button rides inside it,
//       data-filtered + an aria-label naming the active values — plus
//       an OOB outerHTML re-render of the filter form's fieldset with
//       matching checked states
//     → 200 no-JS: a full page with the same filtered table
//     absent/empty f-status → the unfiltered grid (plain trigger);
//     unknown values are ignored — the server is the schema — and an
//     unknown-only request falls back to unfiltered too
//
// Stateless: the f-status params fully determine the answer. Real apps
// compose filters across columns via server-rendered hidden f-<col>
// inputs in each form (contract.md, Filter rules).

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-filter`;
const GRID_ID = 'datagrid-filter-demo-grid';
const FIELDS_ID = 'datagrid-filter-demo-fields';
const TRIGGER_ID = 'datagrid-filter-demo-trigger';
const POPOVER_ID = 'datagrid-filter-demo-popover';

const STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
];

const ITEMS = [
  { name: 'Ingest pipeline', status: 'active', owner: 'Ada' },
  { name: 'Nightly backup', status: 'active', owner: 'Grace' },
  { name: 'Billing export', status: 'pending', owner: 'Alan' },
  { name: 'Legacy sync', status: 'failed', owner: 'Mary' },
];

/** Requested statuses → the known subset (empty = unfiltered). */
function selectStatuses(requested) {
  const known = new Set(STATUSES.map((s) => s.key));
  return [...new Set(requested)].filter((key) => known.has(key));
}

function triggerHtml(selected) {
  const labels = STATUSES.filter((s) => selected.includes(s.key)).map((s) => s.label);
  const filtered = labels.length > 0;
  const aria = filtered
    ? `Filter Status — active: ${labels.join(', ')}`
    : 'Filter Status';
  return `<button class="hc-button" data-variant="${filtered ? 'primary' : 'ghost'}" data-size="sm" type="button" id="${TRIGGER_ID}" popovertarget="${POPOVER_ID}"${filtered ? ' data-filtered' : ''} aria-label="${escapeHtml(aria)}">Filter</button>`;
}

// The OOB unit is the FIELDSET, never the form: the form carries
// data-hc-close-popover-on-success, and replacing it mid-request would
// detach the attribute carrier before htmx:afterRequest — the popover
// would never close.
function fieldsHtml(selected, { oob = false } = {}) {
  const checked = new Set(selected);
  const boxes = STATUSES.map(
    (s) =>
      `<label class="hc-checkbox-label"><input class="hc-checkbox" type="checkbox" name="f-status" value="${s.key}"${checked.has(s.key) ? ' checked' : ''}> ${escapeHtml(s.label)}</label>`,
  ).join('\n  ');
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  return `<fieldset class="hc-popover__body" id="${FIELDS_ID}"${oobAttr}>
  ${boxes}
  </fieldset>`;
}

function formHtml(selected) {
  return `<form action="${API}/items" method="get" data-hx-get="${API}/items" data-hx-target="#${GRID_ID}" data-hc-close-popover-on-success>
  ${fieldsHtml(selected)}
  <footer class="hc-popover__footer"><button class="hc-button" type="submit" data-variant="primary">Apply</button></footer>
</form>`;
}

const BAR_ID = 'datagrid-filter-demo-conditions';

/**
 * The applied-conditions bar. One item per condition — here there is
 * only one column, so at most one — with the value SUMMARISED once more
 * than one status is selected, and a remove link pointing at the URL
 * without `f-status`. The bar rides out of band because the demo's
 * layout puts it above the grid wrapper rather than inside it.
 */
function barHtml(selected, { oob = false } = {}) {
  const labels = STATUSES.filter((s) => selected.includes(s.key)).map((s) => s.label);
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  if (labels.length === 0) {
    // Empty: the component collapses, but the element must still come
    // back so the next filtered response has something to replace.
    return `<div class="hc-filterbar" id="${BAR_ID}"${oobAttr}><ul class="hc-filterbar__list"></ul></div>`;
  }
  const value = labels.length === 1 ? labels[0] : `${labels.length} values`;
  const clearHref = `${API}/items`;
  return `<div class="hc-filterbar" id="${BAR_ID}"${oobAttr}>
  <ul class="hc-filterbar__list">
    <li class="hc-filterbar__item">
      <button class="hc-filterbar__chip" type="button" popovertarget="${POPOVER_ID}">
        <span class="hc-filterbar__label">Status</span>
        <span class="hc-filterbar__op">is</span>
        <span class="hc-filterbar__value">${escapeHtml(value)}</span>
      </button>
      <a class="hc-filterbar__remove" href="${clearHref}" data-hx-get="${clearHref}" data-hx-target="#${GRID_ID}" aria-label="Remove Status filter">×</a>
    </li>
  </ul>
  <a class="hc-filterbar__clear" href="${clearHref}" data-hx-get="${clearHref}" data-hx-target="#${GRID_ID}">Clear all</a>
</div>`;
}

/** The grid wrapper's innerHTML: scroll + table, rows filtered. */
function gridHtml(selected) {
  const statusLabel = new Map(STATUSES.map((s) => [s.key, s.label]));
  const rows = ITEMS.filter(
    (item) => selected.length === 0 || selected.includes(item.status),
  )
    .map(
      (item) =>
        `<tr class="hc-datagrid__row"><td class="hc-datagrid__cell">${escapeHtml(item.name)}</td><td class="hc-datagrid__cell">${escapeHtml(statusLabel.get(item.status))}</td><td class="hc-datagrid__cell">${escapeHtml(item.owner)}</td></tr>`,
    )
    .join('\n      ');
  return `<div class="hc-datagrid__scroll">
  <table class="hc-datagrid__table">
    <thead class="hc-datagrid__head">
      <tr>
        <th class="hc-datagrid__headcell" scope="col">Name</th>
        <th class="hc-datagrid__headcell" scope="col">Status ${triggerHtml(selected)}</th>
        <th class="hc-datagrid__headcell" scope="col">Owner</th>
      </tr>
    </thead>
    <tbody class="hc-datagrid__body">
      ${rows}
    </tbody>
  </table>
</div>`;
}

export function handle({ method, path, url, request }) {
  if (method !== 'GET' || path !== '/items') return null;

  const selected = selectStatuses(url.searchParams.getAll('f-status'));

  if (isHtmx(request)) {
    // The grid for the wrapper's innerHTML (the filtered trigger rides
    // in its header), plus the fieldset re-rendered out-of-band.
    return html(`${gridHtml(selected)}
${fieldsHtml(selected, { oob: true })}
${barHtml(selected, { oob: true })}`);
  }

  // No-JS fallback: the filter is a real GET form — a plain submit
  // navigates here, so answer with a usable page (same filter).
  const statusLabel = new Map(STATUSES.map((s) => [s.key, s.label]));
  const bodyRows = ITEMS.filter(
    (item) => selected.length === 0 || selected.includes(item.status),
  )
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(statusLabel.get(item.status))}</td><td>${escapeHtml(item.owner)}</td></tr>`,
    )
    .join('\n');
  return page(
    'Datagrid filter demo',
    `${barHtml(selected)}
${formHtml(selected)}
<table>
  <thead><tr><th>Name</th><th>Status</th><th>Owner</th></tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`,
  );
}
