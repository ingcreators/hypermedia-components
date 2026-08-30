// datagrid-edit-errors — recipes/datagrid-edit-errors/contract.md
//
//   PATCH /items/:id  (col, value[, confirm])
//     → 200: the record <tbody> re-rendered — row alone, the cell
//       showing the server's formatting of the accepted value
//     → 200 CONFIRM-PENDING: the value is acceptable but unusual (a
//       ship date in the future), so the record comes back with the
//       PROPOSED value marked data-attention="warning" and a warning
//       row offering Confirm / Cancel. Nothing is committed yet.
//     → 422: the record <tbody> re-rendered — cell back on the
//       server's value, data-invalid + aria wiring, plus the
//       __error-row naming the rejected input
//     unknown row/col → 404
//   GET /items/:id  → the stored record (what Cancel restores)
//
// Stateless like every docs demo: the "server value" is the fixture
// value, so a rejection always restores it. Real apps read/write their
// store; the wire is identical.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-edit-errors`;

const ITEMS = {
  1: { name: 'Chai', price: 18, ship: '2026-08-01' },
  2: { name: 'Chang', price: 19, ship: '2026-08-03' },
};

/**
 * The confirmation token. It is bound to (row, column, value) — and in
 * a versioned store, to the version too — so a confirmation obtained
 * for one value can never commit a different one. This demo is
 * stateless, so it recomputes the token instead of storing a nonce; a
 * real server issues a SINGLE-USE nonce and deletes it on redemption.
 */
function confirmToken(id, col, value) {
  let h = 0;
  for (const ch of `${id}:${col}:${value}`) h = (h * 31 + ch.codePointAt(0)) | 0;
  return (h >>> 0).toString(36);
}

function isFutureDate(value) {
  const today = new Date().toISOString().slice(0, 10);
  return value > today;
}

/**
 * One record <tbody>. Exactly one of `invalid` / `confirm` may be set:
 * a rejection (422) or a proposal awaiting confirmation (200).
 */
function recordHtml(id, { invalid = null, confirm = null, values = null } = {}) {
  const item = { ...ITEMS[id], ...values };
  const noteId = `edit-errors-demo-${id}-note`;
  const priceAttrs = invalid?.col === 'price'
    ? ` data-invalid aria-invalid="true" aria-describedby="${noteId}"`
    : '';
  // The proposed cell is NOT data-pending: nothing is in flight, the
  // server is waiting on the USER. A spinner would say otherwise.
  const shipAttrs = invalid?.col === 'ship'
    ? ` data-invalid aria-invalid="true" aria-describedby="${noteId}"`
    : confirm
      ? ` data-attention="warning" aria-describedby="${noteId}"`
      : '';

  let noteRow = '';
  if (invalid) {
    noteRow = `
  <tr class="hc-datagrid__error-row">
    <td class="hc-datagrid__error" colspan="3"><span role="alert" id="${noteId}">${escapeHtml(invalid.message)}</span></td>
  </tr>`;
  } else if (confirm) {
    // Static data-hx-vals (no js:) — CSP-safe, and it pins exactly the
    // value being confirmed alongside its token.
    const vals = escapeHtml(
      JSON.stringify({ col: 'ship', value: confirm.value, confirm: confirm.token }),
    );
    noteRow = `
  <tr class="hc-datagrid__error-row">
    <td class="hc-datagrid__error" data-tone="warning" colspan="3">
      <span role="alert" id="${noteId}">${escapeHtml(confirm.message)}</span>
      <button class="hc-button" data-size="sm" data-variant="primary" type="button"
              data-hx-patch="${API}/items/${id}"
              data-hx-vals="${vals}"
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Confirm</button>
      <button class="hc-button" data-size="sm" type="button"
              data-hx-get="${API}/items/${id}"
              data-hx-target="closest tbody" data-hx-swap="outerHTML">Cancel</button>
    </td>
  </tr>`;
  }

  return `<tbody class="hc-datagrid__record" id="edit-errors-demo-${id}"${confirm ? ' data-attention="warning"' : ''}
  data-hx-patch="${API}/items/${id}"
  data-hx-trigger="hc:datagridedit"
  data-hx-vals="js:{ col: event.detail.col, value: event.detail.value }"
  data-hx-disinherit="hx-vals"
  data-hx-swap="outerHTML">
  <tr class="hc-datagrid__row">
    <td class="hc-datagrid__cell">${escapeHtml(item.name)}</td>
    <td class="hc-datagrid__cell" data-numeric data-editable data-col="price" data-value="${item.price}"${priceAttrs}>${item.price.toFixed(2)}</td>
    <td class="hc-datagrid__cell" data-editable data-col="ship" data-value="${escapeHtml(item.ship)}"${shipAttrs}>${escapeHtml(item.ship)}</td>
  </tr>${noteRow}
</tbody>`;
}

function patchPrice(id, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return html(
      recordHtml(id, {
        invalid: {
          col: 'price',
          message: `"${raw}" is not a number — Price must be a number greater than 0.`,
        },
      }),
      { status: 422 },
    );
  }
  if (value <= 0) {
    return html(
      recordHtml(id, {
        invalid: {
          col: 'price',
          message: `${raw} is out of range — Price must be greater than 0.`,
        },
      }),
      { status: 422 },
    );
  }
  return html(recordHtml(id, { values: { price: value } }));
}

function patchShip(id, raw, confirm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    return html(
      recordHtml(id, {
        invalid: {
          col: 'ship',
          message: `"${raw}" is not a date — Ship date must be YYYY-MM-DD.`,
        },
      }),
      { status: 422 },
    );
  }
  // The soft rule: acceptable, but only the server knows it needs
  // asking about. Not a 422 (nothing is wrong with the value) and not
  // a client-side confirm (the rule is discovered on the way in).
  if (isFutureDate(raw) && confirm !== confirmToken(id, 'ship', raw)) {
    return html(
      recordHtml(id, {
        values: { ship: raw },
        confirm: {
          value: raw,
          token: confirmToken(id, 'ship', raw),
          message: `${raw} is in the future. Confirm to ship ${ITEMS[id].name} on that date.`,
        },
      }),
    );
  }
  return html(recordHtml(id, { values: { ship: raw } }));
}

export async function handle({ method, path, request }) {
  const m = path.match(/^\/items\/(\d+)$/);
  if (!m) return null;
  const id = Number(m[1]);
  if (!ITEMS[id]) return new Response('Not found', { status: 404 });

  // Cancel: the stored record, exactly as it was. Nothing was written,
  // so there is nothing to undo.
  if (method === 'GET') return html(recordHtml(id));
  if (method !== 'PATCH') return null;

  const form = await request.formData();
  const col = form.get('col');
  const raw = String(form.get('value') ?? '').trim();
  const confirm = form.get('confirm') ? String(form.get('confirm')) : null;

  if (col === 'price') return patchPrice(id, raw);
  if (col === 'ship') return patchShip(id, raw, confirm);
  return new Response('Unknown column', { status: 404 });
}
