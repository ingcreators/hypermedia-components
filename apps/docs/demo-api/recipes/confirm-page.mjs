// confirm-page — templates/confirm-page (入力 → 確認 → 完了)
//
//   GET  /flow     → 200, the input step (optionally pre-filled)
//   POST /confirm  → 422 input step re-rendered with field errors /
//                    200 the review step: the server renders WHAT IT
//                    PARSED (formatted amount), the values ride as
//                    hidden fields, and the idempotency key is minted
//                    at THIS render
//   POST /place    → nav=back: the input step with values intact
//                    nav=place: the done step — the receipt number
//                    derives from the key, so a double submit gets
//                    the SAME receipt (the idempotency-key replay,
//                    stateless because the response is a pure
//                    function of the key)
//
// One region (#confirm-page-demo-flow), whole-region outerHTML swaps —
// the multi-step-form shape specialised to three fixed steps.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/confirm-page`;
const FLOW_ID = 'confirm-page-demo-flow';

/** Deterministic receipt from the key — a replayed place gets the same one. */
function receiptNo(key) {
  let h = 11;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 90000;
  return `REQ-${10000 + h}`;
}

function stepper(current) {
  const steps = [
    ['Input', 1],
    ['Review', 2],
    ['Done', 3],
  ];
  const items = steps
    .map(([label, n]) => {
      if (n < current) {
        return `    <li class="hc-stepper__step" data-state="complete">
      <span class="hc-stepper__marker" aria-hidden="true">✓</span>
      <span class="hc-stepper__label">${label} <span class="hc-sr-only">(completed)</span></span>
    </li>`;
      }
      const cur = n === current ? ' aria-current="step"' : '';
      return `    <li class="hc-stepper__step"${cur}>
      <span class="hc-stepper__marker" aria-hidden="true">${n}</span>
      <span class="hc-stepper__label">${label}</span>
    </li>`;
    })
    .join('\n');
  return `  <ol class="hc-stepper">\n${items}\n  </ol>`;
}

function field(id, label, name, value, error) {
  const invalid = error ? ' aria-invalid="true"' : '';
  const hint = error
    ? `\n      <p class="hc-field__hint" data-variant="error">${error}</p>`
    : '';
  return `    <div class="hc-field">
      <label class="hc-field__label" for="${id}">${label}</label>
      <input class="hc-input" id="${id}" name="${name}" value="${escapeHtml(value)}"${invalid}>${hint}
    </div>`;
}

function inputStep({ item = 'Ergonomic chair', amount = '48000', errors = {} } = {}) {
  return `<section id="${FLOW_ID}">
${stepper(1)}
  <form method="post" action="${API}/confirm"
        data-hx-post="${API}/confirm"
        data-hx-target="#${FLOW_ID}" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
${field(`${FLOW_ID}-item`, 'Item', 'item', item, errors.item)}
${field(`${FLOW_ID}-amount`, 'Amount (¥)', 'amount', amount, errors.amount)}
    <button class="hc-button" data-variant="primary" type="submit">Review</button>
  </form>
</section>`;
}

function reviewStep(item, amount) {
  const key = `ik_${crypto.randomUUID().slice(0, 8)}`;
  const formatted = `¥${Number(amount).toLocaleString('en-US')}`;
  return `<section id="${FLOW_ID}">
${stepper(2)}
  <form method="post" action="${API}/place"
        data-hx-post="${API}/place"
        data-hx-target="#${FLOW_ID}" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
    <input type="hidden" name="idempotency_key" value="${key}">
    <input type="hidden" name="item" value="${escapeHtml(item)}">
    <input type="hidden" name="amount" value="${escapeHtml(amount)}">
    <dl class="hc-stack">
      <div><dt>Item</dt><dd>${escapeHtml(item)}</dd></div>
      <div><dt>Amount</dt><dd>${formatted}</dd></div>
    </dl>
    <p class="hc-field__hint">Review what the server parsed — the
      formatted amount above is the server's reading, not an echo.
      Key for this render: <code>${key}</code></p>
    <div class="hc-toolbar" role="toolbar" aria-label="Review actions">
      <button class="hc-button" type="submit" name="nav" value="back"
              formnovalidate>Back</button>
      <button class="hc-button" data-variant="primary" type="submit"
              name="nav" value="place">Place order</button>
    </div>
  </form>
</section>`;
}

function doneStep(key, item, amount) {
  const formatted = `¥${Number(amount).toLocaleString('en-US')}`;
  return `<section id="${FLOW_ID}">
${stepper(3)}
  <div class="hc-card" role="status">
    <p>Order <strong>${receiptNo(key)}</strong> placed — ${escapeHtml(item)},
      ${formatted}.</p>
    <p class="hc-field__hint">Pressing Place order twice lands here
      with the <em>same</em> receipt number — the response derives
      from the idempotency key, which is the replay contract.</p>
    <button class="hc-button" data-variant="ghost" type="button"
            data-hx-get="${API}/flow"
            data-hx-target="#${FLOW_ID}" data-hx-swap="outerHTML">Start again</button>
  </div>
</section>`;
}

function validate(form) {
  const item = String(form.get('item') ?? '').trim();
  const amount = String(form.get('amount') ?? '').trim();
  const errors = {};
  if (!item) errors.item = 'Item is required.';
  if (!/^\d+$/.test(amount)) errors.amount = 'Amount must be a whole number of yen.';
  return { item, amount, errors };
}

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/flow') {
    const body = inputStep();
    return isHtmx(request) ? html(body) : page('Confirm page demo', body);
  }

  if (method === 'POST' && path === '/confirm') {
    const { item, amount, errors } = validate(await request.formData());
    if (Object.keys(errors).length) {
      return html(inputStep({ item, amount, errors }), { status: 422 });
    }
    return html(reviewStep(item, amount));
  }

  if (method === 'POST' && path === '/place') {
    const form = await request.formData();
    const nav = String(form.get('nav') ?? 'place');
    const { item, amount, errors } = validate(form);
    if (nav === 'back') {
      return html(inputStep({ item, amount }));
    }
    // Hidden fields came from our own review render, but the server
    // re-validates anyway — the client is never the validator.
    if (Object.keys(errors).length) {
      return html(inputStep({ item, amount, errors }), { status: 422 });
    }
    const key = String(form.get('idempotency_key') ?? '');
    if (!key) return html('<p>Missing idempotency key.</p>', { status: 422 });
    return html(doneStep(key, item, amount));
  }

  return null;
}
