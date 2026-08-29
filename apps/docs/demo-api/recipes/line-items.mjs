// line-items — recipes/line-items/contract.md
//
//   GET  /quote   → 200 + the whole form (a fresh two-row quote)
//   POST /recalc  → 200 + the whole form re-rendered (add / remove /
//                   recalc by the pressed button), or 422 with the
//                   bad raw values echoed back and totals as "—"
//
// Stateless: the rows ARE the request — item/qty/price repeat per
// row and align positionally (tree-order serialization). The server
// is the only calculator: line totals, subtotal, 10% tax (floored —
// rounding is business truth), grand total.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/line-items`;
const FORM_ID = 'line-items-demo-form';

const TAX_RATE = 0.1;

const yen = (n) => `¥${n.toLocaleString('en-US')}`;

/** Parse one positional row; returns errors per field. */
function parseRow(item, qty, price) {
  const row = { item: item ?? '', qty: qty ?? '', price: price ?? '', errors: {} };
  if (!/^\d+$/.test(String(row.qty).trim()) || Number.parseInt(row.qty, 10) < 1) {
    row.errors.qty = 'Quantity must be a whole number of 1 or more.';
  }
  if (!/^\d+$/.test(String(row.price).trim())) {
    row.errors.price = 'Unit price must be a whole number (yen).';
  }
  if (!row.errors.qty && !row.errors.price) {
    row.total = Number.parseInt(row.qty, 10) * Number.parseInt(row.price, 10);
  }
  return row;
}

function wire() {
  return `data-hx-post="${API}/recalc" data-hx-target="#${FORM_ID}" data-hx-swap="outerHTML"`;
}

function rowHtml(row, i) {
  const qtyInvalid = row.errors.qty ? ' aria-invalid="true"' : '';
  const priceInvalid = row.errors.price ? ' aria-invalid="true"' : '';
  const message = row.errors.qty ?? row.errors.price;
  const totalCell = message
    ? `<span class="hc-field__message" data-variant="error">${escapeHtml(message)}</span>`
    : yen(row.total);
  return `<tr>
  <td><input class="hc-input" name="item" value="${escapeHtml(row.item)}" aria-label="Item"></td>
  <td><input class="hc-input" name="qty" value="${escapeHtml(String(row.qty))}" inputmode="numeric" aria-label="Quantity"${qtyInvalid} data-hx-trigger="change" ${wire()}></td>
  <td><input class="hc-input" name="price" value="${escapeHtml(String(row.price))}" inputmode="numeric" aria-label="Unit price"${priceInvalid} data-hx-trigger="change" ${wire()}></td>
  <td data-cell="line-total">${totalCell}</td>
  <td><button class="hc-button" data-variant="ghost" type="submit" name="remove" value="${i + 1}" ${wire()}>Remove</button></td>
</tr>`;
}

function formHtml(rows) {
  const invalid = rows.some((r) => r.errors.qty || r.errors.price);
  const subtotal = invalid ? null : rows.reduce((sum, r) => sum + r.total, 0);
  const tax = subtotal == null ? null : Math.floor(subtotal * TAX_RATE);
  const dash = '—';
  return `<form method="post" action="${API}/recalc" id="${FORM_ID}" data-hc-line-items>
<table class="hc-table">
  <thead>
    <tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Unit price</th>
        <th scope="col">Line total</th><th scope="col"><span aria-hidden="true"></span></th></tr>
  </thead>
  <tbody>
${rows.map(rowHtml).join('\n')}
  </tbody>
  <tfoot>
    <tr><th scope="row" colspan="3">Subtotal</th><td>${subtotal == null ? dash : yen(subtotal)}</td><td></td></tr>
    <tr><th scope="row" colspan="3">Tax (10%)</th><td>${tax == null ? dash : yen(tax)}</td><td></td></tr>
    <tr><th scope="row" colspan="3">Total</th><td>${subtotal == null ? dash : yen(subtotal + tax)}</td><td></td></tr>
  </tfoot>
</table>
<button class="hc-button" type="submit" name="add" value="1" ${wire()}>Add row</button>
</form>`;
}

const FRESH = [
  parseRow('Widget', '3', '1200'),
  parseRow('Gasket', '5', '800'),
];

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/quote') {
    const body = formHtml(FRESH);
    if (isHtmx(request)) return html(body);
    return page('Line items demo', body);
  }

  if (method === 'POST' && path === '/recalc') {
    const form = await request.formData();
    const items = form.getAll('item').map(String);
    const qtys = form.getAll('qty').map(String);
    const prices = form.getAll('price').map(String);
    let rows = items.map((item, i) => parseRow(item, qtys[i], prices[i]));

    if (form.get('add') != null) rows.push(parseRow('', '1', '0'));
    const remove = Number.parseInt(String(form.get('remove') ?? ''), 10);
    if (!Number.isNaN(remove)) rows = rows.filter((_, i) => i !== remove - 1);

    const invalid = rows.some((r) => r.errors.qty || r.errors.price);
    const body = formHtml(rows);
    const status = invalid ? 422 : 200;
    if (isHtmx(request)) return html(body, { status });
    return page('Line items demo', body, { status });
  }

  return null;
}
