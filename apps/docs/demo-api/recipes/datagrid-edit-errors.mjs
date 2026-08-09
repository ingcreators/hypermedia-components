// datagrid-edit-errors — recipes/datagrid-edit-errors/contract.md
//
//   PATCH /items/:id  (col, value)
//     → 200: the record <tbody> re-rendered — row alone, the cell
//       showing the server's formatting of the accepted value
//     → 422: the record <tbody> re-rendered — cell back on the
//       server's value, data-invalid + aria wiring, plus the
//       __error-row naming the rejected input
//     unknown row/col → 404
//
// Stateless like every docs demo: the "server value" is the fixture
// price, so a rejection always restores it. Real apps read/write their
// store; the wire is identical.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-edit-errors`;

const ITEMS = {
  1: { name: 'Chai', price: 18 },
  2: { name: 'Chang', price: 19 },
};

function recordHtml(id, { invalid = null } = {}) {
  const item = ITEMS[id];
  const errorId = `edit-errors-demo-${id}-error`;
  const invalidAttrs = invalid
    ? ` data-invalid aria-invalid="true" aria-describedby="${errorId}"`
    : '';
  const errorRow = invalid
    ? `
  <tr class="hc-datagrid__error-row">
    <td class="hc-datagrid__error" colspan="2"><span role="alert" id="${errorId}">${escapeHtml(invalid)}</span></td>
  </tr>`
    : '';
  return `<tbody class="hc-datagrid__record" id="edit-errors-demo-${id}"
  data-hx-patch="${API}/items/${id}"
  data-hx-trigger="hc:datagridedit"
  data-hx-vals="js:{ col: event.detail.col, value: event.detail.value }"
  data-hx-swap="outerHTML">
  <tr class="hc-datagrid__row">
    <td class="hc-datagrid__cell">${escapeHtml(item.name)}</td>
    <td class="hc-datagrid__cell" data-numeric data-editable data-col="price" data-value="${item.price}"${invalidAttrs}>${item.price.toFixed(2)}</td>
  </tr>${errorRow}
</tbody>`;
}

export async function handle({ method, path, request }) {
  const m = path.match(/^\/items\/(\d+)$/);
  if (method !== 'PATCH' || !m) return null;
  const id = Number(m[1]);
  if (!ITEMS[id]) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  if (form.get('col') !== 'price') return new Response('Unknown column', { status: 404 });

  const raw = String(form.get('value') ?? '').trim();
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return html(recordHtml(id, {
      invalid: `"${raw}" is not a number — Price must be a number greater than 0.`,
    }), { status: 422 });
  }
  if (value <= 0) {
    return html(recordHtml(id, {
      invalid: `${raw} is out of range — Price must be greater than 0.`,
    }), { status: 422 });
  }
  // Stateless demo: echo the accepted value as the server's formatting.
  return html(recordHtml(id).replace(
    `data-value="${ITEMS[id].price}">${ITEMS[id].price.toFixed(2)}`,
    `data-value="${value}">${value.toFixed(2)}`,
  ));
}
