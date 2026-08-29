// idempotency-key — recipes/idempotency-key/contract.md
//
//   GET  /form    → 200, a fresh form with a freshly minted key
//   POST /orders  → 200 first commit / 200 replayed original /
//                   422 same-key-different-payload / 422 validation
//                   (validation leaves the key live)
//
// Stateless twist: a real server stores key → (request-hash,
// response); Workers isolates can't, so the first commit writes a
// `receipt` (the spent key) and `receipt_amount` (the request hash
// stand-in) back into the form out-of-band, and the form carries the
// "already seen" bit itself on the next submit. The receipt NUMBER
// derives from the key, so the replayed response really is the
// original one.

import { DOCS_BASE, escapeHtml, html, hxTrigger, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/idempotency-key`;
const FORM_WRAP_ID = 'idempotency-key-demo-form';
const RESULT_ID = 'idempotency-key-demo-result';
const RECEIPT_ID = 'idempotency-key-demo-receipt';
const RECEIPT_AMOUNT_ID = 'idempotency-key-demo-receipt-amount';

/** Deterministic order number from the key — replay shows the SAME order. */
function orderNo(key) {
  let h = 7;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 90000;
  return `ORD-${10000 + h}`;
}

function receiptInputs(receipt, amount, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  return `<input type="hidden" name="receipt" value="${escapeHtml(receipt)}" id="${RECEIPT_ID}"${oobAttr}>
<input type="hidden" name="receipt_amount" value="${escapeHtml(amount)}" id="${RECEIPT_AMOUNT_ID}"${oobAttr}>`;
}

function formHtml(key) {
  return `<form method="post" action="${API}/orders">
  <input type="hidden" name="idempotency_key" value="${key}">
  ${receiptInputs('', '')}
  <div class="hc-field">
    <label class="hc-field__label" for="${FORM_WRAP_ID}-amount">Amount</label>
    <input class="hc-input" id="${FORM_WRAP_ID}-amount" name="amount" value="1200" inputmode="numeric">
    <p class="hc-field__hint">Key for this form render: <code>${key}</code></p>
  </div>
  <button class="hc-button" data-variant="primary" type="submit"
          data-hx-post="${API}/orders"
          data-hx-target="#${RESULT_ID}" data-hx-swap="innerHTML"
          data-hx-disabled-elt="this">Place order</button>
</form>`;
}

function successCard(key, amount, { replayed = false } = {}) {
  const note = replayed
    ? `\n  <p class="hc-field__hint">Duplicate submit detected — the original
    response was replayed; no second order exists.</p>`
    : '';
  return `<div class="hc-card">
  <p>Order <strong>${orderNo(key)}</strong> placed — ¥${escapeHtml(amount)}.</p>${note}
  <button class="hc-button" data-variant="ghost" type="button"
          data-hx-get="${API}/form"
          data-hx-target="#${FORM_WRAP_ID}" data-hx-swap="innerHTML">Start a new order (fresh key)</button>
</div>`;
}

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/form') {
    const key = `ik_${crypto.randomUUID().slice(0, 8)}`;
    const body = formHtml(key);
    return isHtmx(request)
      ? html(body)
      : page('Idempotency key demo', `${body}\n<div id="${RESULT_ID}"></div>`);
  }

  if (method === 'POST' && path === '/orders') {
    const form = await request.formData();
    const key = String(form.get('idempotency_key') ?? '');
    const amount = String(form.get('amount') ?? '').trim();
    const receipt = String(form.get('receipt') ?? '');
    const receiptAmount = String(form.get('receipt_amount') ?? '');

    if (!key) return html('<p>Missing idempotency key.</p>', { status: 422 });

    // Validation failure: the key is NOT spent — fix and resubmit.
    if (!/^\d+$/.test(amount)) {
      return html(
        `<div class="hc-alert" data-variant="error" role="status">
  <p class="hc-alert__title">Amount must be a whole number.</p>
  <p class="hc-alert__body">Fix the value and submit again — the key
    is still live, so the corrected submit will commit.</p>
</div>`,
        { status: 422 },
      );
    }

    // Replay branch: this form already committed with this key.
    if (receipt === key) {
      if (receiptAmount !== amount) {
        return html(
          `<div class="hc-alert" data-variant="error" role="status">
  <p class="hc-alert__title">This form was already submitted with different values.</p>
  <p class="hc-alert__body">Order ${orderNo(key)} (¥${escapeHtml(receiptAmount)}) already
    exists. Start a new order to submit a different amount.</p>
</div>`,
          { status: 422 },
        );
      }
      return html(successCard(key, amount, { replayed: true }), {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: `Order ${orderNo(key)} placed`, variant: 'success' },
          }),
        },
      });
    }

    // First commit: answer + write the spent key back into the form
    // out-of-band (a real server writes its storage row instead).
    return html(
      `${successCard(key, amount)}
${receiptInputs(key, amount, { oob: true })}`,
      {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: `Order ${orderNo(key)} placed`, variant: 'success' },
          }),
        },
      },
    );
  }

  return null;
}
