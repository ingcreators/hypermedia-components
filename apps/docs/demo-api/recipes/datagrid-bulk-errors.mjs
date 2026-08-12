// datagrid-bulk-errors — recipes/datagrid-bulk-errors/contract.md
//
//   POST /bulk        (ids, action=archive)  — BEST-EFFORT
//     → 200: rows reflecting what happened (failures marked, reason
//       via aria-describedby) + the OOB report grouped by reason +
//       a warning toast that does not auto-dismiss
//   GET  /preflight   (ids, action=post)     — ATOMIC, phase 1
//     → 200: the executability report; when some rows are blocked it
//       offers "exclude the blockers and run the rest" carrying only
//       the executable ids; when none are, no submit at all
//   POST /bulk        (ids, action=post)     — ATOMIC, phase 2
//     → 200 when every id is executable; otherwise 409 with the rows
//       UNCHANGED, the checkboxes KEPT, and refusal copy
//
// Stateless: eligibility is derived from the row id alone (see
// SHIPPED / NOT_YOURS), so the same selection always yields the same
// answer.

import { DOCS_BASE, escapeHtml, html, hxTrigger } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-bulk-errors`;

/** 8 deterministic products; the reason (if any) is a pure function. */
const ITEMS = [101, 102, 103, 104, 105, 106, 107, 108].map((id) => ({
  id,
  name: `Product ${id}`,
}));

/**
 * Why this row cannot be acted on — null means it can. Explicit sets
 * rather than a formula, so the demo's outcome is readable from here:
 * 102 / 105 / 108 are shipped, 107 is not yours, 104 is momentarily
 * locked. Only the last of those is worth trying again, which is what
 * decides whether the row comes back checked.
 */
const SHIPPED = new Set([102, 105, 108]);
const NOT_YOURS = new Set([107]);
const LOCKED = new Set([104]);

function blockedReason(id) {
  if (SHIPPED.has(id)) return 'Already shipped — cannot be changed';
  if (NOT_YOURS.has(id)) return 'Not permitted';
  if (LOCKED.has(id)) return 'Locked by another job — try again';
  return null;
}

/** Retryable failures keep their checkbox, so one press retries them. */
function isRetryable(id) {
  return LOCKED.has(id);
}

function tooltipId(id) {
  return `bulk-errors-demo-why-${id}`;
}

/**
 * `blocked` marks the row with its reason. It means "this row cannot
 * proceed", which is equally true before the action runs (pre-flight,
 * refusal) and after it failed — the fact belongs to the ROW, not to
 * the attempt, so the marking never goes stale when the selection
 * changes. `oob` turns the row into an out-of-band update, which is
 * how the pre-flight marks rows without re-rendering the whole grid.
 */
function rowHtml(
  item,
  { blocked = false, status = 'Active', checked = false, oob = false } = {},
) {
  const reason = blocked ? blockedReason(item.id) : null;
  // data-invalid draws the corner marker (absolutely positioned, zero
  // layout cost); the reason rides as a tooltip the cell points at. No
  // inline "details" link: the table is max-content sized, so inline
  // additions widen the column — Back returns to the report instead.
  const cellAttrs = reason
    ? ` data-invalid aria-describedby="${tooltipId(item.id)}"`
    : '';
  const tip = reason
    ? `<span class="hc-tooltip" id="${tooltipId(item.id)}">${escapeHtml(reason)}</span>`
    : '';
  return `<tr class="hc-datagrid__row" id="bulk-errors-demo-row-${item.id}"${reason ? ' data-attention="error"' : ''}${oob ? ' data-hx-swap-oob="outerHTML"' : ''}>
  <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" name="ids" value="${item.id}"${checked ? ' checked' : ''} aria-label="Select ${escapeHtml(item.name)}"></td>
  <td class="hc-datagrid__cell">${escapeHtml(item.name)}</td>
  <td class="hc-datagrid__cell"${cellAttrs}>${escapeHtml(status)} ${tip}</td>
</tr>`;
}

/** ids → { ok: number[], blocked: Map<reason, number[]> } */
function split(ids) {
  const ok = [];
  const blocked = new Map();
  for (const id of ids) {
    const reason = blockedReason(id);
    if (!reason) {
      ok.push(id);
      continue;
    }
    if (!blocked.has(reason)) blocked.set(reason, []);
    blocked.get(reason).push(id);
  }
  return { ok, blocked };
}

const CAP = 3; // the demo's inline cap (10 in real apps — see contract)

function reasonTableHtml(blocked) {
  const rows = [...blocked.entries()]
    .map(([reason, ids]) => {
      const named = ids
        .slice(0, CAP)
        .map(
          (id) =>
            `<a href="#bulk-errors-demo-row-${id}">${id} Product ${id}</a>`,
        )
        .join(', ');
      const rest = ids.length > CAP ? ` … <span>and ${ids.length - CAP} more</span>` : '';
      return `<tr><th scope="row">${escapeHtml(reason)}</th><td data-numeric>${ids.length}</td><td>${named}${rest}</td></tr>`;
    })
    .join('\n');
  return `<table class="hc-table" data-density="compact">
  <thead><tr><th scope="col">Reason</th><th scope="col" data-numeric>Count</th><th scope="col">Rows</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// Header values are latin-1 — the blessed \uXXXX transform (toast
// contract) keeps Japanese messages legal on the wire.
function toastHeader(message, variant) {
  return { 'HX-Trigger': hxTrigger({ 'hc:toast': { message, variant } }) };
}

// The main swap target is a <tbody>, so htmx parses the response in a
// table context: a bare <div> OOB fragment gets foster-parented and its
// nested <table> mangled. <template> is htmx's blessed escape for
// exactly this (contract.md, "Riding along with a tbody swap").
/**
 * The moves, in the summary line. Twelve failures scattered through a
 * long list is a queue, so the O(1) line carries prev / next as REAL
 * fragment links naming rows by id — installDatagrid() lands the active
 * cell on the row a fragment names, so this is focus movement with no
 * client state. The counter is server-rendered from the same list the
 * report groups, so the two cannot drift.
 */
function navigatorHtml(ids) {
  const failed = ids.filter((id) => blockedReason(id) != null);
  if (failed.length < 2) return '';
  const first = failed[0];
  const second = failed[1];
  return ` <a href="#bulk-errors-demo-row-${first}">Previous</a> <span>Error 1 of ${failed.length} — row ${first}</span> <a href="#bulk-errors-demo-row-${second}">Next</a>`;
}

const DETAIL_ID = 'bulk-errors-demo-detail';

/**
 * The grouped breakdown, DOCKED beside the grid rather than stacked
 * above it: a side panel spends horizontal space, which a full-height
 * list page has, and both stay live — click a reason and watch the
 * rows behind it. Empty means collapsed, so a screen with nothing to
 * report looks like a screen with nothing to report.
 */
function detailPanel(inner, { oob = false, open = false, count = 0 } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  const reopen = `${API}/report?open=1`;
  // COLLAPSED IS THE DEFAULT, and collapsed still shows: a rail with
  // the count and the way back. An empty panel taxes every day for a
  // rare event; a panel that vanishes when closed is a dead end.
  if (!open) {
    return wrap(
      `<div class="hc-splitter__panel" id="${DETAIL_ID}" data-collapsed${oobAttr}>
  <button class="hc-button" data-size="sm" data-variant="${count ? 'secondary' : 'ghost'}" type="button" data-hx-get="${reopen}" data-hx-include="closest form" data-hx-target="#${DETAIL_ID}" data-hx-swap="outerHTML"${count ? '' : ' disabled'} aria-label="Show why rows failed">Reasons${count ? ` (${count})` : ''}</button>
</div>`,
      oob,
    );
  }
  return wrap(
    `<div class="hc-splitter__panel hc-scroll-area" id="${DETAIL_ID}"${oobAttr}>
  <div class="hc-cluster" style="justify-content: space-between;">
    <strong>Why they failed</strong>
    <button class="hc-button" data-size="sm" data-variant="ghost" type="button" data-hx-get="${API}/report?close=1" data-hx-include="closest form" data-hx-target="#${DETAIL_ID}" data-hx-swap="outerHTML">Hide</button>
  </div>
  ${inner}
</div>`,
    oob,
  );
}

// A <div> riding a <tbody>-targeted response is foster-parented by the
// table parser; <template> is the documented escape.
function wrap(div, oob) {
  return oob ? `<template>${div}</template>` : div;
}

function bulkReport(inner, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="innerHTML"' : '';
  const div = `<div id="bulk-errors-demo-report" aria-live="polite"${oobAttr}>${inner}</div>`;
  return oob ? `<template>${div}</template>` : div;
}

/**
 * The count the user was shown, pinned. A real server signs or stores
 * this; the demo derives it from the conditions so the same conditions
 * always yield the same token — which is exactly the property that
 * matters: a token from a DIFFERENT set of conditions must not validate.
 */
function countToken(conditions, count) {
  let h = 0;
  for (const ch of `${conditions}|${count}`) h = (h * 31 + ch.codePointAt(0)) | 0;
  return `ct_${(h >>> 0).toString(36)}`;
}

/** Rows matching a query-scoped request. The demo's one condition is status. */
function matching(status) {
  if (!status) return ITEMS.map((i) => i.id);
  // "open" is everything that is not blocked — enough to make the
  // count-changes branch demonstrable.
  return ITEMS.filter((i) => (status === 'open') === (blockedReason(i.id) == null)).map(
    (i) => i.id,
  );
}

export async function handle({ method, path, url, request }) {
  // The docked panel is a REGION the server owns: hiding it is a
  // response, not client state, so the two surfaces cannot disagree.
  if (method === 'GET' && path === '/report') {
    const ids = url.searchParams.getAll('ids').map(Number).filter(Boolean);
    const { blocked } = split(ids);
    const count = [...blocked.values()].reduce((n, rows) => n + rows.length, 0);
    // Closing is a response, not client state, so the rail comes back
    // carrying the count — the way in is never lost.
    if (url.searchParams.get('close') === '1') return html(detailPanel('', { count }));
    return html(
      detailPanel(count ? reasonTableHtml(blocked) : '', { open: count > 0, count }),
    );
  }

  // ---- Atomic phase 1: pre-flight -------------------------------
  if (method === 'GET' && path === '/preflight') {
    const ids = url.searchParams.getAll('ids').map(Number).filter(Boolean);
    const { ok, blocked } = split(ids);
    if (ids.length === 0) {
      return html(
        bulkReport('<p role="status">Select rows first.</p>'),
      );
    }
    if (blocked.size === 0) {
      return html(
        bulkReport(`<div class="hc-alert" data-variant="info" role="status">
  <p><strong>${ok.length} rows will be executed.</strong></p>
  <form data-hx-post="${API}/bulk" data-hx-target="#bulk-errors-demo-rows" data-hx-swap="innerHTML">
    <input type="hidden" name="action" value="post">
    ${ok.map((id) => `<input type="hidden" name="ids" value="${id}">`).join('')}
    <button class="hc-button" data-variant="primary" type="submit">Run</button>
  </form>
</div>`),
      );
    }
    const blockedCount = ids.length - ok.length;
    // The report names the blocked rows and links to them; without a
    // mark on the row itself the link lands on something that looks
    // like every other row. These ride along as OOB updates —
    // <template>-wrapped, because <tr> in a div-targeted response is
    // dropped by the parser (contract.md, "Riding along with a swap").
    const markedRows = `<template>${ITEMS.filter(
      (item) => ids.includes(item.id) && blockedReason(item.id) != null,
    )
      .map((item) => rowHtml(item, { blocked: true, checked: true, oob: true }))
      .join('\n')}</template>`;
    const excludeForm = ok.length
      ? `<form data-hx-post="${API}/bulk" data-hx-target="#bulk-errors-demo-rows" data-hx-swap="innerHTML">
    <input type="hidden" name="action" value="post">
    ${ok.map((id) => `<input type="hidden" name="ids" value="${id}">`).join('')}
    <button class="hc-button" data-variant="primary" type="submit">Exclude ${blockedCount} and run ${ok.length}</button>
  </form>`
      : '<p>No executable rows.</p>';
    return html(
      `${bulkReport(`<div class="hc-alert" data-variant="warning" role="status">
  <p><strong>${ok.length} of ${ids.length} rows are executable</strong>; ${blockedCount} are blocked.</p>
  ${reasonTableHtml(blocked)}
  ${excludeForm}
</div>`)}
${markedRows}`,
    );
  }

  if (method !== 'POST' || path !== '/bulk') return null;

  const form = await request.formData();
  const scope = String(form.get('scope') ?? 'ids');
  let ids = form.getAll('ids').map(Number).filter(Boolean);
  const action = String(form.get('action') ?? 'archive');

  if (scope === 'matching') {
    // Acting on the QUERY rather than on a list of ids — the only shape
    // that survives 4,873 rows. The two are mutually exclusive.
    if (form.getAll('ids').length > 0) {
      return html(
        bulkReport(
          '<p role="alert">A request may name ids or a query, never both.</p>',
        ),
        { status: 400 },
      );
    }
    const status = String(form.get('f-status') ?? '');
    const matched = matching(status);
    const sent = String(form.get('count-token') ?? '');
    const fresh = countToken(status, matched.length);

    // The count is part of what the user agreed to. If it moved, the
    // operation on offer is not the one they pressed — re-confirm
    // rather than silently acting on the new set.
    if (sent !== fresh) {
      return html(
        bulkReport(`<div class="hc-alert" data-variant="warning" role="alert">
  <p><strong>The number of matching rows changed.</strong> ${matched.length} rows match now. Confirm again to act on them.</p>
  <form data-hx-post="${API}/bulk" data-hx-target="#bulk-errors-demo-rows" data-hx-swap="innerHTML">
    <input type="hidden" name="action" value="${escapeHtml(action)}">
    <input type="hidden" name="scope" value="matching">
    <input type="hidden" name="f-status" value="${escapeHtml(status)}">
    <input type="hidden" name="count-token" value="${fresh}">
    <button class="hc-button" data-variant="primary" type="submit">Archive all ${matched.length} matching</button>
  </form>
</div>`),
        { status: 409 },
      );
    }
    ids = matched;
  }

  const { ok, blocked } = split(ids);

  // ---- Atomic phase 2 -------------------------------------------
  if (action === 'post') {
    if (blocked.size > 0) {
      // Refusal: rows UNCHANGED, checkboxes KEPT, refusal copy.
      // Nothing ran, so no status changes — but the blocked rows are
      // WHY nothing ran, and saying so is not the same as claiming
      // they failed. The report's row links now land on something
      // visibly marked.
      const rows = ITEMS.map((item) =>
        rowHtml(item, {
          checked: ids.includes(item.id),
          blocked: ids.includes(item.id) && blockedReason(item.id) != null,
        }),
      ).join('\n');
      const blockedCount = ids.length - ok.length;
      return html(
        `${rows}
${bulkReport(`<div class="hc-alert" data-variant="error" role="alert">
  <p><strong>Nothing was executed.</strong> ${blockedCount} of the ${ids.length} selected rows do not qualify, so the whole batch was rolled back.</p>
  ${reasonTableHtml(blocked)}
</div>`, { oob: true })}`,
        {
          status: 409,
          headers: toastHeader(
            `Nothing was executed (${blockedCount} rows do not qualify)`,
            'error',
          ),
        },
      );
    }
    const rows = ITEMS.map((item) =>
      rowHtml(item, { status: ids.includes(item.id) ? 'Posted' : 'Active' }),
    ).join('\n');
    return html(
      `${rows}
${bulkReport(`<p role="status">${ok.length} rows posted.</p>`, { oob: true })}`,
      { headers: toastHeader(`${ok.length} rows posted`, 'success') },
    );
  }

  // ---- Best-effort ----------------------------------------------
  // Retryable failures come back CHECKED: the actions bar stays up and
  // the same button now applies to exactly the rows worth trying again.
  // Succeeded rows and permanent failures come back unchecked —
  // re-submitting either would be pointless.
  const rows = ITEMS.map((item) => {
    if (!ids.includes(item.id)) return rowHtml(item);
    const failed = blockedReason(item.id) != null;
    return rowHtml(item, {
      blocked: failed,
      status: failed ? 'Active' : 'Archived',
      checked: failed && isRetryable(item.id),
    });
  }).join('\n');

  if (blocked.size === 0) {
    return html(
      `${rows}
${bulkReport(`<p role="status">${ok.length} rows archived.</p>`, { oob: true })}`,
      { headers: toastHeader(`${ok.length} rows archived`, 'success') },
    );
  }
  const failedCount = ids.length - ok.length;
  const retryable = ids.filter((id) => blockedReason(id) && isRetryable(id));
  // A partially-checked grid reads as a bug unless the report says why.
  const retryLine = retryable.length
    ? `<p><strong>${retryable.length} can be retried</strong> and ${retryable.length === 1 ? 'is' : 'are'} still selected — press <strong>Archive</strong> again to apply to ${retryable.length === 1 ? 'it' : 'those'} alone.${
        failedCount > retryable.length
          ? ` The other ${failedCount - retryable.length} ${
              failedCount - retryable.length === 1 ? 'needs' : 'need'
            } a change first.`
          : ''
      }</p>`
    : '';
  return html(
    `${rows}
${bulkReport(`<div class="hc-alert" data-variant="warning" role="status">
  <p><strong>${ok.length} succeeded / ${failedCount} failed</strong> (of ${ids.length} selected)${navigatorHtml(ids)} · <a href="${API}/items?f-last-result=failed">Show only failed</a></p>
  ${retryLine}
</div>`, { oob: true })}
${detailPanel(reasonTableHtml(blocked), { oob: true, count: failedCount })}`,
    {
      headers: toastHeader(
        `${ok.length} succeeded / ${failedCount} failed`,
        'warning',
      ),
    },
  );
}
