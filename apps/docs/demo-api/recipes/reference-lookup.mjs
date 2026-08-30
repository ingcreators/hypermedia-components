// reference-lookup — recipes/reference-lookup/contract.md
//
//   GET /field                     → 200, the field (initial demo state)
//   GET /resolve?customer_code=…   → 200 resolved / 422 unresolved /
//                                    200 cleared — always the whole field
//   GET /lookup                    → 200, the search dialog
//   GET /lookup/results?q=…        → 200, the result list fragment
//   GET /pick?id=…                 → 200, the field resolved to that row
//
// Stateless: a fixed in-module master list (one row inactive, to show
// visible-but-refused). The field's current value always rides in the
// request, so there is nothing to remember.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/reference-lookup`;
const FIELD_ID = 'reference-lookup-demo-field';
const ROOT_ID = 'reference-lookup-demo-root';
const RESULTS_ID = 'reference-lookup-demo-results';

const MASTERS = [
  { id: 'cus_9f2', code: 'C-1041', name: 'Acme Trading K.K.' },
  { id: 'cus_a11', code: 'C-1042', name: 'Vanished Corp.', inactive: 'inactive since 2026-04' },
  { id: 'cus_b3c', code: 'C-1043', name: 'Meridian Logistics' },
  { id: 'cus_c8d', code: 'C-1105', name: 'Kitsune Foods' },
  { id: 'cus_d51', code: 'C-1107', name: 'Aozora Metalworks' },
  { id: 'cus_e77', code: 'C-1201', name: 'Polaris Insurance' },
];

function findByCode(code) {
  const needle = code.trim().toUpperCase();
  return MASTERS.find((m) => m.code === needle) ?? null;
}

/**
 * The whole field, in one of three states:
 *  master   → resolved
 *  error    → unresolved (message, empty id)
 *  neither  → cleared
 */
function fieldHtml({ code = '', master = null, error = null } = {}) {
  const invalid = error ? ' aria-invalid="true"' : '';
  const hint = error
    ? `<p class="hc-field__message" data-variant="error">${escapeHtml(error)}</p>`
    : `<p class="hc-field__hint">${master ? escapeHtml(master.name) : '—'}</p>`;
  return `<div class="hc-field" id="${FIELD_ID}" data-hc-lookup>
  <label class="hc-field__label" for="${FIELD_ID}-code">Customer</label>
  <div class="hc-input-group">
    <input class="hc-input" id="${FIELD_ID}-code" name="customer_code"
           value="${escapeHtml(master ? master.code : code)}"${invalid}
           data-hx-get="${API}/resolve" data-hx-trigger="change"
           data-hx-target="#${FIELD_ID}" data-hx-swap="outerHTML">
    <button class="hc-button" type="button" aria-haspopup="dialog"
            aria-label="Search customers"
            data-hx-get="${API}/lookup"
            data-hx-target="#${ROOT_ID}" data-hx-swap="innerHTML">🔍</button>
  </div>
  ${hint}
  <input type="hidden" name="customer_id" value="${master ? master.id : ''}">
</div>`;
}

function resultsHtml(q) {
  const needle = q.trim().toLowerCase();
  const hits = MASTERS.filter(
    (m) => !needle || `${m.code} ${m.name}`.toLowerCase().includes(needle),
  );
  if (hits.length === 0) {
    return `<li><span class="hc-menu__item" aria-disabled="true">No customers match “${escapeHtml(q)}”.</span></li>`;
  }
  return hits
    .map((m) => {
      if (m.inactive) {
        return `<li><button class="hc-menu__item" type="button" aria-disabled="true">${m.code} — ${escapeHtml(m.name)} (${m.inactive})</button></li>`;
      }
      return `<li><button class="hc-menu__item" type="button"
      data-hx-get="${API}/pick?id=${m.id}"
      data-hx-target="#${FIELD_ID}" data-hx-swap="outerHTML">${m.code} — ${escapeHtml(m.name)}</button></li>`;
    })
    .join('\n');
}

function dialogHtml() {
  return `<dialog class="hc-dialog" data-hc-close-dialog-on-success aria-labelledby="${RESULTS_ID}-title">
  <h2 id="${RESULTS_ID}-title">Select a customer</h2>
  <form role="search" action="${API}/lookup" method="get"
        data-hc-close-dialog-on-success="false">
    <input class="hc-input" type="search" name="q" placeholder="Code or name"
           aria-label="Search customers"
           data-hx-get="${API}/lookup/results"
           data-hx-trigger="input changed delay:300ms, search"
           data-hx-target="#${RESULTS_ID}" data-hx-swap="innerHTML"
           data-hx-sync="closest form:replace">
  </form>
  <ul class="hc-menu" id="${RESULTS_ID}">
${resultsHtml('')}
  </ul>
  <form method="dialog"><button class="hc-button">Cancel</button></form>
</dialog>`;
}

export function handle({ method, path, url, request }) {
  if (method !== 'GET') return null;

  if (path === '/field') {
    const body = fieldHtml({ master: MASTERS[0] });
    return isHtmx(request) ? html(body) : page('Reference lookup demo', body);
  }

  if (path === '/resolve') {
    const code = url.searchParams.get('customer_code') ?? '';
    if (!code.trim()) return html(fieldHtml({}));
    const master = findByCode(code);
    if (master) return html(fieldHtml({ master }));
    return html(
      fieldHtml({ code, error: `No customer with code ${code.trim().toUpperCase()}.` }),
      { status: 422 },
    );
  }

  if (path === '/lookup') return html(dialogHtml());

  if (path === '/lookup/results') {
    return html(resultsHtml(url.searchParams.get('q') ?? ''));
  }

  if (path === '/pick') {
    const master = MASTERS.find((m) => m.id === url.searchParams.get('id') && !m.inactive);
    if (!master) return html(fieldHtml({ error: 'That customer can no longer be referenced.' }), { status: 422 });
    return html(fieldHtml({ master }));
  }

  return null;
}
