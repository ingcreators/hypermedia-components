// datagrid-edit-conflict — recipes/datagrid-edit-conflict/contract.md
//
//   PATCH /items/:id  (col, value, version)
//     version matches + valid → 200: record re-render, version + 1
//     version matches + invalid → 422: the datagrid-edit-errors branch
//     stale version → 409: the conflict presentation (theirs in the
//       cells, fresh version, alert naming both values, overwrite /
//       discard actions)
//   GET /items/:id → 200: the record plain (the Discard target)
//
// Stateless demo choreography: the fixture's base version is 3 and the
// PATCH always conflicts the FIRST time (the demo simulates another
// user having saved version 4 = price 20) — resubmitting against
// version ≥ 4 succeeds. Real apps compare against their store; the
// wire is identical.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-edit-conflict`;

const BASE = { 1: { name: 'Chai', price: 18, version: 3 } };
const THEIRS = { price: 20, version: 4 }; // what the "other user" saved

function recordHtml(id, { price, version, conflict = null } = {}) {
  const item = BASE[id];
  const conflictRow = conflict
    ? `
  <tr class="hc-datagrid__error-row">
    <td class="hc-datagrid__error" colspan="2">
      <span role="alert" id="edit-conflict-demo-${id}-alert">Edit conflict: another user saved ${THEIRS.price.toFixed(2)} while you were editing. Your value: ${escapeHtml(conflict.yours)}.</span>
      <button class="hc-button" data-size="sm" data-variant="primary" type="button"
              data-hx-patch="${API}/items/${id}"
              data-hx-vals='{"col":"price","value":"${escapeHtml(conflict.yours)}","version":"${version}"}'
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Overwrite with ${escapeHtml(conflict.yours)}</button>
      <button class="hc-button" data-size="sm" type="button"
              data-hx-get="${API}/items/${id}"
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Discard mine</button>
    </td>
  </tr>`
    : '';
  return `<tbody class="hc-datagrid__record" id="edit-conflict-demo-${id}" data-version="${version}"
  data-hx-patch="${API}/items/${id}"
  data-hx-trigger="hc:datagridedit"
  data-hx-vals="js:{ col: event.detail.col, value: event.detail.value, version: event.target.closest('tbody').dataset.version }"
  data-hx-swap="outerHTML">
  <tr class="hc-datagrid__row"${conflict ? ' data-tone="error"' : ''}>
    <td class="hc-datagrid__cell">${escapeHtml(item.name)}</td>
    <td class="hc-datagrid__cell" data-numeric data-editable data-col="price" data-value="${price}">${price.toFixed(2)}</td>
  </tr>${conflictRow}
</tbody>`;
}

export async function handle({ method, path, request }) {
  const m = path.match(/^\/items\/(\d+)$/);
  if (!m || !BASE[Number(m[1])]) return null;
  const id = Number(m[1]);

  if (method === 'GET') {
    // The Discard target: the current state, plain.
    return html(recordHtml(id, { price: THEIRS.price, version: THEIRS.version }));
  }
  if (method !== 'PATCH') return null;

  const form = await request.formData();
  if (form.get('col') !== 'price') return new Response('Unknown column', { status: 404 });
  const raw = String(form.get('value') ?? '').trim();
  const version = Number(form.get('version'));

  if (!(version >= THEIRS.version)) {
    // Stale: the conflict presentation — theirs in the cells, fresh
    // version, yours preserved in the alert + overwrite action.
    return html(
      recordHtml(id, { price: THEIRS.price, version: THEIRS.version, conflict: { yours: raw } }),
      { status: 409 },
    );
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    // The datagrid-edit-errors branch, version kept.
    return html(
      recordHtml(id, { price: THEIRS.price, version }).replace(
        'data-col="price"',
        `data-col="price" data-invalid aria-invalid="true" aria-describedby="edit-conflict-demo-${id}-error"`,
      ).replace(
        '</tr>\n</tbody>',
        `</tr>
  <tr class="hc-datagrid__error-row"><td class="hc-datagrid__error" colspan="2"><span role="alert" id="edit-conflict-demo-${id}-error">"${escapeHtml(raw)}" is not a valid price.</span></td></tr>
</tbody>`,
      ),
      { status: 422 },
    );
  }
  return html(recordHtml(id, { price: n, version: version + 1 }));
}
