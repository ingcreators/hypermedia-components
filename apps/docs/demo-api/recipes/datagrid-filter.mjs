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
import { isRelative } from '../relative-dates.mjs';
import {
  describeRange,
  labelRange,
  joinRangeValue,
  rangeFromParams,
  resolveRange,
  splitRangeValue,
} from '../ranges.mjs';

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

// Due dates are computed per request as offsets from today, so the demo
// keeps straddling "now" instead of going stale a week after it was
// written — which is the same reason a saved view needs relative
// expressions in the first place.
const ITEMS = [
  { name: 'Ingest pipeline', status: 'active', owner: 'Ada', dueIn: -3 },
  { name: 'Nightly backup', status: 'active', owner: 'Grace', dueIn: 0 },
  { name: 'Billing export', status: 'pending', owner: 'Alan', dueIn: 2 },
  { name: 'Legacy sync', status: 'failed', owner: 'Mary', dueIn: 10 },
];

function dueDate(item, now) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + item.dueIn),
  );
  return d.toISOString().slice(0, 10);
}

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

// The presets the server offers for THIS column. Option values are the
// wire expressions — RANGES, because a date filter is a period and a
// preset has to set both ends from one control. Nobody types those; the
// server picks the list because it knows which periods suit the column.
const DUE_PRESETS = [
  ['', 'Any'],
  ['@today..@today', 'Today'],
  ['@today..', 'Today or later'],
  ['@week-start..@week-end', 'This week'],
  ['@month-start..@month-end', 'This month'],
  ['@month-start-1m..@month-end-1m', 'Last month'],
  ['@today-7d..@today', 'Last 7 days'],
];

const DUE_FIELD_ID = 'datagrid-filter-demo-due-field';

/**
 * The due-date control: a preset list, a pair of date inputs once the
 * user picks "Custom dates…", or the offset composer. ONE control at a
 * time — rendering both and hiding one would submit the condition
 * twice, since hidden controls keep submitting.
 */
function dueFieldHtml(raw, { mode = null, oob = false, now = new Date() } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const known = DUE_PRESETS.some(([value]) => value === raw);
  const { from, to } = splitRangeValue(raw);
  const absolute = (end) => (isRelative(end) ? '' : end);
  const anyRelative = isRelative(from) || isRelative(to);

  // ABSOLUTE ends belong in date inputs. A relative expression never
  // does — putting `@today-45d` in <input type="date"> makes the browser
  // show an empty field, and the condition is lost on the next submit.
  //
  // The pair carries real names, so without JavaScript it submits as
  // f-due-from / f-due-to; installRangeValue() joins it into one
  // f-due=A..B when the behavior is there. The server takes both.
  if (mode === 'dates' || (!mode && raw && !anyRelative)) {
    return `<div class="hc-field" id="${DUE_FIELD_ID}"${oobAttr}>
  <span class="hc-field__label" id="f-due-range-label">Due</span>
  <div class="hc-cluster" role="group" aria-labelledby="f-due-range-label" data-hc-range="f-due">
    <input class="hc-input" type="date" name="f-due-from" aria-label="Due from" value="${escapeHtml(absolute(from))}">
    <span aria-hidden="true">–</span>
    <input class="hc-input" type="date" name="f-due-to" aria-label="Due to" value="${escapeHtml(absolute(to))}">
  </div>
  ${backToPresets()}
</div>`;
  }

  // The composer: any N, any unit. Its controls are NOT named f-due —
  // while it is open the condition simply is not set yet, which is
  // honest. "Use" asks the server to compose the expression and answers
  // the field with it selected.
  if (mode === 'relative') {
    return `<div class="hc-field" id="${DUE_FIELD_ID}"${oobAttr}>
  <span class="hc-field__label" id="f-due-rel-label">Due</span>
  <div class="hc-cluster" role="group" aria-labelledby="f-due-rel-label">
    <span>the last</span>
    <input class="hc-input" type="number" min="1" name="due-n" value="7" aria-label="How many">
    <select class="hc-select" name="due-unit" aria-label="Unit">
      <option value="d">days</option>
      <option value="w">weeks</option>
      <option value="m">months</option>
      <option value="y">years</option>
    </select>
    <button class="hc-button" data-size="sm" type="button" data-hx-get="${API}/filters/due?compose=1" data-hx-include="closest .hc-field" data-hx-target="#${DUE_FIELD_ID}" data-hx-swap="outerHTML">Use</button>
  </div>
  ${backToPresets()}
</div>`;
  }

  // Presets. A range that is not one of them is added as a selected
  // option, labelled by the server — so a composed expression (or a
  // mixed range) round-trips readably instead of disappearing.
  const extra =
    raw && !known
      ? `<option value="${escapeHtml(raw)}" selected>${escapeHtml(labelRange(raw, { now }))}</option>`
      : '';
  const options = DUE_PRESETS.map(
    ([value, label]) =>
      `<option value="${value}"${value === raw ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `<div class="hc-field" id="${DUE_FIELD_ID}"${oobAttr}>
  <label class="hc-field__label" for="f-due-select">Due</label>
  <select class="hc-select" id="f-due-select" name="f-due" data-hx-get="${API}/filters/due" data-hx-target="#${DUE_FIELD_ID}" data-hx-swap="outerHTML" data-hx-trigger="change[this.value.startsWith('custom')]">
    ${options}${extra}
    <option value="custom-relative">Custom — the last N days…</option>
    <option value="custom-dates">Custom — between two dates…</option>
  </select>
</div>`;
}

function backToPresets() {
  return `<a class="hc-field__hint" href="${API}/items" data-hx-get="${API}/filters/due?preset=1" data-hx-target="#${DUE_FIELD_ID}" data-hx-swap="outerHTML">Use a preset instead</a>`;
}

function formHtml(selected) {
  return `<form action="${API}/items" method="get" data-hx-get="${API}/items" data-hx-target="#${GRID_ID}" data-hc-close-popover-on-success>
  ${fieldsHtml(selected)}
  ${dueFieldHtml('')}
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
/** The current URL minus one condition — what a remove control points at. */
function hrefWithout(drop, selected, due) {
  const params = new URLSearchParams();
  if (drop !== 'f-status') for (const s of selected) params.append('f-status', s);
  if (drop !== 'f-due' && due) params.set('f-due', due);
  const qs = params.toString();
  return qs ? `${API}/items?${qs}` : `${API}/items`;
}

function barHtml(selected, { oob = false, due = null, now = new Date() } = {}) {
  const labels = STATUSES.filter((s) => selected.includes(s.key)).map((s) => s.label);
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const items = [];
  if (labels.length > 0) {
    const value = labels.length === 1 ? labels[0] : `${labels.length} values`;
    items.push(
      `<li class="hc-filterbar__item">
      <button class="hc-filterbar__chip" type="button" popovertarget="${POPOVER_ID}">
        <span class="hc-filterbar__label">Status</span>
        <span class="hc-filterbar__op">is</span>
        <span class="hc-filterbar__value">${escapeHtml(value)}</span>
      </button>
      <a class="hc-filterbar__remove" href="${hrefWithout('f-status', selected, due)}" data-hx-get="${hrefWithout('f-status', selected, due)}" data-hx-target="#${GRID_ID}" aria-label="Remove Status filter">×</a>
    </li>`,
    );
  }
  if (due) {
    // ONE chip for what the user thinks of as one condition — a period.
    // The expression is what was stored; the resolved dates are what
    // reassure. Showing only one of the two is how a relative condition
    // becomes a guess.
    const range = describeRange(due, { now });
    items.push(
      `<li class="hc-filterbar__item">
      <button class="hc-filterbar__chip" type="button" popovertarget="${POPOVER_ID}">
        <span class="hc-filterbar__label">Due</span>
        <span class="hc-filterbar__op">${escapeHtml(range.op)}</span>
        <span class="hc-filterbar__value">${escapeHtml(range.value)}</span>
      </button>
      <a class="hc-filterbar__remove" href="${hrefWithout('f-due', selected, due)}" data-hx-get="${hrefWithout('f-due', selected, due)}" data-hx-target="#${GRID_ID}" aria-label="Remove Due filter">×</a>
    </li>`,
    );
  }
  if (items.length === 0) {
    // Empty: the component collapses, but the element must still come
    // back so the next filtered response has something to replace.
    return `<div class="hc-filterbar" id="${BAR_ID}"${oobAttr}><ul class="hc-filterbar__list"></ul></div>`;
  }
  const clearHref = `${API}/items`;
  return `<div class="hc-filterbar" id="${BAR_ID}"${oobAttr}>
  <ul class="hc-filterbar__list">
    ${items.join('\n    ')}
  </ul>
  <a class="hc-filterbar__clear" href="${clearHref}" data-hx-get="${clearHref}" data-hx-target="#${GRID_ID}">Clear all</a>
</div>`;
}

/** Rows matching every condition in the request. */
function matching(selected, { due = null, now = new Date() } = {}) {
  return ITEMS.filter((item) => {
    if (selected.length > 0 && !selected.includes(item.status)) return false;
    const date = dueDate(item, now);
    if (due?.from && date < due.from) return false;
    if (due?.to && date > due.to) return false;
    return true;
  });
}

/** The grid wrapper's innerHTML: scroll + table, rows filtered. */
function gridHtml(selected, { due = null, now = new Date() } = {}) {
  const statusLabel = new Map(STATUSES.map((s) => [s.key, s.label]));
  const rows = matching(selected, { due, now })
    .map(
      (item) =>
        `<tr class="hc-datagrid__row"><td class="hc-datagrid__cell">${escapeHtml(item.name)}</td><td class="hc-datagrid__cell">${escapeHtml(statusLabel.get(item.status))}</td><td class="hc-datagrid__cell">${escapeHtml(item.owner)}</td><td class="hc-datagrid__cell">${dueDate(item, now)}</td></tr>`,
    )
    .join('\n      ');
  return `<div class="hc-datagrid__scroll">
  <table class="hc-datagrid__table">
    <thead class="hc-datagrid__head">
      <tr>
        <th class="hc-datagrid__headcell" scope="col">Name</th>
        <th class="hc-datagrid__headcell" scope="col">Status ${triggerHtml(selected)}</th>
        <th class="hc-datagrid__headcell" scope="col">Owner</th>
        <th class="hc-datagrid__headcell" scope="col">Due</th>
      </tr>
    </thead>
    <tbody class="hc-datagrid__body">
      ${rows}
    </tbody>
  </table>
</div>`;
}

export function handle({ method, path, url, request }) {
  // Swapping the due control between presets, date inputs and the
  // composer is a re-render, not a second control: one name, one
  // control, always.
  if (method === 'GET' && path === '/filters/due') {
    if (url.searchParams.get('preset') === '1') return html(dueFieldHtml(''));

    // Compose N + unit into the one range the wire carries. The server
    // owns the canonical form, so the field comes back holding a single
    // control whose value is the finished expression.
    if (url.searchParams.get('compose') === '1') {
      const n = Math.max(1, Number(url.searchParams.get('due-n') ?? 0) || 0);
      const unit = String(url.searchParams.get('due-unit') ?? 'd');
      const expression = `@today-${n}${'dwmy'.includes(unit) ? unit : 'd'}..@today`;
      return html(dueFieldHtml(expression));
    }

    const choice = url.searchParams.get('f-due');
    return html(
      dueFieldHtml('', { mode: choice === 'custom-dates' ? 'dates' : 'relative' }),
    );
  }

  if (method !== 'GET' || path !== '/items') return null;

  const selected = selectStatuses(url.searchParams.getAll('f-status'));

  // One "now" for the whole request, so every condition in it resolves
  // against the same instant.
  const now = new Date();

  // The range arrives as one param, or as the -from / -to pair the two
  // date inputs submit when installRangeValue() never ran. Both are the
  // same condition; canonicalise to `A..B` so everything downstream —
  // the chip, the remove link, a saved view's comparison — sees one
  // shape.
  const rawDue = rangeFromParams(url.searchParams, 'f-due');
  const due = rawDue ? resolveRange(rawDue, { now }) : null;

  // FAIL CLOSED. An expression the server does not understand is an
  // error, never "no filter" — silently dropping a condition shows the
  // user more data than they asked for.
  if (due?.error) {
    return html(
      `<div class="hc-alert" data-variant="error" role="alert"><p><strong>Unknown date expression</strong> ${escapeHtml(due.error)}. Nothing was filtered out — this request was refused rather than answered with more rows than you asked for.</p></div>`,
      { status: 400 },
    );
  }

  // A reversed range is REFUSED, never swapped. Running a different
  // condition from the one written is the failure this whole pattern
  // exists to prevent — and the client's native refusal can be bypassed
  // by anyone who types the URL.
  if (due?.from && due?.to && due.from > due.to) {
    return html(
      `<div class="hc-alert" data-variant="error" role="alert"><p><strong>The range ends before it starts</strong> — ${escapeHtml(joinRangeValue(due.from, due.to))}. Nothing was answered: swapping the ends would run a condition nobody asked for.</p></div>`,
      { status: 400 },
    );
  }

  if (isHtmx(request)) {
    // The grid for the wrapper's innerHTML (the filtered trigger rides
    // in its header), plus the fieldset re-rendered out-of-band.
    return html(`${gridHtml(selected, { due, now })}
${fieldsHtml(selected, { oob: true })}
${barHtml(selected, { oob: true, due: rawDue, now })}
${dueFieldHtml(rawDue, { oob: true, now })}`);
  }

  // No-JS fallback: the filter is a real GET form — a plain submit
  // navigates here, so answer with a usable page (same filter).
  const statusLabel = new Map(STATUSES.map((s) => [s.key, s.label]));
  const bodyRows = matching(selected, { due, now })
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(statusLabel.get(item.status))}</td><td>${escapeHtml(item.owner)}</td><td>${dueDate(item, now)}</td></tr>`,
    )
    .join('\n');
  return page(
    'Datagrid filter demo',
    `${barHtml(selected, { due: rawDue, now })}
${formHtml(selected)}
<table>
  <thead><tr><th>Name</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`,
  );
}
