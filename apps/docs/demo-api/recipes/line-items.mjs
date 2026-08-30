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
  /**
   * A numeric cell: the bare input when valid; when invalid, an
   * `.hc-field[data-invalid]` wrapper (the hook `.hc-field__message`
   * error styling keys on) with the message linked via
   * `aria-describedby`.
   */
  const numberCell = (name, label, value, error) => {
    const errorId = `${FORM_ID}-r${i + 1}-${name}-error`;
    const input = `<input class="hc-input" name="${name}" value="${escapeHtml(String(value))}" inputmode="numeric" aria-label="${label}"${error ? ` aria-invalid="true" aria-describedby="${errorId}"` : ''} data-hx-trigger="change" ${wire()}>`;
    if (!error) return input;
    return `<div class="hc-field" data-invalid="true">${input}<p class="hc-field__message" id="${errorId}">${escapeHtml(error)}</p></div>`;
  };
  const removeLabel = row.item.trim() ? `Remove ${row.item.trim()}` : `Remove row ${i + 1}`;
  return `<tr>
  <td><input class="hc-input" name="item" value="${escapeHtml(row.item)}" aria-label="Item"></td>
  <td>${numberCell('qty', 'Quantity', row.qty, row.errors.qty)}</td>
  <td>${numberCell('price', 'Unit price', row.price, row.errors.price)}</td>
  <td data-cell="line-total">${row.total == null ? '—' : yen(row.total)}</td>
  <td><button class="hc-button" data-variant="ghost" type="submit" name="remove-row" value="${i + 1}" aria-label="${escapeHtml(removeLabel)}" ${wire()}>Remove</button></td>
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
    // `remove-row`, never `remove`: a control named after a form DOM
    // API shadows it (form.remove === the button), and htmx calls
    // target.remove() when outerHTML-swapping the form — the old form
    // would throw and never leave the page.
    const remove = Number.parseInt(String(form.get('remove-row') ?? ''), 10);
    if (!Number.isNaN(remove)) rows = rows.filter((_, i) => i !== remove - 1);

    const invalid = rows.some((r) => r.errors.qty || r.errors.price);
    const body = formHtml(rows);
    const status = invalid ? 422 : 200;
    if (isHtmx(request)) return html(body, { status });
    return page('Line items demo', body, { status });
  }

  return null;
}
