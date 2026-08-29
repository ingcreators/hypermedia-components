// datagrid-snapshot-pager — recipes/datagrid-snapshot-pager/contract.md
//
//   GET  /search  → page 1's rows + OOB snapshot (keys), page-field,
//                   status, pager (or a no-JS full page)
//   POST /page    → keys[] + page (last value wins) → that page's rows
//                   in keys order + OOB pager/status/page-field;
//                   422 over the cap. Keys are left untouched.
//   POST /act     → ids[] + action (approve|withdraw) + keys[] + page →
//                   the current page re-rendered + OOB keys + status
//
// Stateless with a twist: a real server keeps row state in its
// database, but Workers isolates are ephemeral, so this demo threads
// the state through the tokens themselves — `p7` pending, `a7`
// approved, `x7` vanished — and re-renders the form's keys block
// out-of-band after each action (the same trick as the
// datagrid-bulk-actions demo's `state` input). The tokens stay opaque
// to the markup, which is the contract's whole point. Anything
// unparseable renders as a tombstone (the vanished-row branch).

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-snapshot-pager`;
const ROWS_ID = 'snapshot-pager-demo-rows';
const KEYS_ID = 'snapshot-pager-demo-keys';
const PAGER_ID = 'snapshot-pager-demo-pager';
const STATUS_ID = 'snapshot-pager-demo-status';
const PAGE_ID = 'snapshot-pager-demo-page';

const TOTAL = 56;
const PAGE_SIZE = 20;
const CAP = 100;

const KINDS = [
  'Expense report', 'Travel request', 'Purchase order', 'Leave request',
  'Budget change', 'Access request', 'Contract draft',
];
const NAMES = [
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Ito',
  'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi',
];

/** Deterministic queue item for 1-based index i — dates ascend. */
function item(i) {
  const day = new Date(Date.UTC(2026, 4, 1 + i));
  return {
    id: 4000 + i,
    title: `${KINDS[(i - 1) % KINDS.length]} #${4000 + i}`,
    requester: NAMES[(i - 1) % NAMES.length],
    date: day.toISOString().slice(0, 10),
  };
}

/** token → { i, state } | null (null = vanished/foreign key). */
function parseToken(token) {
  const m = /^([pax])(\d+)$/.exec(token ?? '');
  if (!m) return null;
  const i = Number.parseInt(m[2], 10);
  if (i < 1 || i > TOTAL) return null;
  return { i, state: { p: 'pending', a: 'approved', x: 'vanished' }[m[1]] };
}

/** The snapshot block — every key, in order, in one OOB-swappable div. */
function keysHtml(keys, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  const inputs = keys.map((t) => `  <input type="hidden" name="keys" value="${escapeHtml(t)}">`);
  return `<div id="${KEYS_ID}" hidden${oobAttr}>\n${inputs.join('\n')}\n</div>`;
}

function tombstoneHtml(id) {
  return `<tr class="hc-datagrid__row" data-tombstone>
  <td class="hc-datagrid__cell"></td>
  <th class="hc-datagrid__cell" scope="row">${id}</th>
  <td class="hc-datagrid__cell" colspan="3">No longer in this queue.</td>
</tr>`;
}

function rowHtml(token) {
  const parsed = parseToken(token);
  if (!parsed) return tombstoneHtml('—');
  const { i, state } = parsed;
  const { id, title, requester, date } = item(i);
  if (state === 'vanished') return tombstoneHtml(id);
  const pending = state === 'pending';
  const checkbox = pending
    ? `<input type="checkbox" class="hc-checkbox" name="ids" value="${id}" aria-label="Select ${escapeHtml(title)}">`
    : `<input type="checkbox" class="hc-checkbox" disabled aria-label="Approved — cannot select">`;
  const status = pending
    ? 'Pending'
    : '<span class="hc-badge" data-variant="success">Approved</span>';
  return `<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell">${checkbox}</td>
  <th class="hc-datagrid__cell" scope="row">${id}</th>
  <td class="hc-datagrid__cell">${escapeHtml(title)} · ${escapeHtml(requester)}</td>
  <td class="hc-datagrid__cell"><time>${date}</time></td>
  <td class="hc-datagrid__cell">${status}</td>
</tr>`;
}

function rowsHtml(keys, page_) {
  return keys
    .slice((page_ - 1) * PAGE_SIZE, page_ * PAGE_SIZE)
    .map(rowHtml)
    .join('\n');
}

function pagerHtml(keys, page_, { oob = false } = {}) {
  const last = Math.max(1, Math.ceil(keys.length / PAGE_SIZE));
  const items = [];
  for (let p = 1; p <= last; p += 1) {
    const current = p === page_ ? ' aria-current="page"' : '';
    items.push(
      `<button class="hc-pagination__item" type="submit" name="page" value="${p}"${current} data-hx-post="${API}/page" data-hx-target="#${ROWS_ID}" data-hx-swap="innerHTML">${p}</button>`,
    );
  }
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  return `<nav class="hc-pagination" id="${PAGER_ID}"${oobAttr} aria-label="Pagination">
  ${items.join('\n  ')}
</nav>`;
}

function statusHtml(keys, page_, { oob = false } = {}) {
  const first = (page_ - 1) * PAGE_SIZE + 1;
  const last = Math.min(page_ * PAGE_SIZE, keys.length);
  const states = keys.map((t) => parseToken(t)?.state ?? 'vanished');
  const approved = states.filter((s) => s === 'approved').length;
  const vanished = states.filter((s) => s === 'vanished').length;
  const parts = [`${first}–${last} of ${keys.length} (as of search)`];
  if (approved) parts.push(`${approved} approved`);
  if (vanished) parts.push(`${vanished} gone`);
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  return `<p id="${STATUS_ID}"${oobAttr} aria-live="polite">${parts.join(' — ')}</p>`;
}

function pageFieldHtml(page_, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  return `<input type="hidden" name="page" value="${page_}" id="${PAGE_ID}"${oobAttr}>`;
}

function lastValue(form, name, fallback) {
  const all = form.getAll(name).filter((v) => typeof v === 'string');
  return all.length ? all[all.length - 1] : fallback;
}

function clampPage(form, keys) {
  const last = Math.max(1, Math.ceil(keys.length / PAGE_SIZE));
  const n = Number.parseInt(lastValue(form, 'page', '1'), 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(last, Math.max(1, n));
}

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/search') {
    // A fresh snapshot: all 56 items pending.
    const keys = Array.from({ length: TOTAL }, (_, idx) => `p${idx + 1}`);
    if (isHtmx(request)) {
      return html(
        `${rowsHtml(keys, 1)}
${keysHtml(keys, { oob: true })}
${pageFieldHtml(1, { oob: true })}
${statusHtml(keys, 1, { oob: true })}
${pagerHtml(keys, 1, { oob: true })}`,
      );
    }
    // No-JS: a usable full page — the whole form server-rendered.
    return page(
      'Snapshot pager demo',
      `<form method="post" action="${API}/page">
${keysHtml(keys)}
${pageFieldHtml(1)}
<table>
  <thead><tr><th></th><th>ID</th><th>Request</th><th>Submitted</th><th>Status</th></tr></thead>
  <tbody>${rowsHtml(keys, 1)}</tbody>
</table>
${statusHtml(keys, 1)}
${pagerHtml(keys, 1)}
</form>`,
    );
  }

  if (method === 'POST' && (path === '/page' || path === '/act')) {
    const form = await request.formData();
    let keys = form.getAll('keys').filter((v) => typeof v === 'string');
    if (keys.length === 0) {
      return html('<p>Empty snapshot — search again.</p>', { status: 422 });
    }
    if (keys.length > CAP) {
      // The contract's broken-client branch: never a truncated page.
      return html(`<p>Snapshot over the ${CAP}-key cap — narrow the search.</p>`, {
        status: 422,
      });
    }
    const page_ = clampPage(form, keys);

    if (path === '/page') {
      return html(
        `${rowsHtml(keys, page_)}
${pagerHtml(keys, page_, { oob: true })}
${statusHtml(keys, page_, { oob: true })}
${pageFieldHtml(page_, { oob: true })}`,
      );
    }

    // /act — approve or withdraw the selected ids, then re-render the
    // CURRENT page (the hidden page field travelled with the form).
    const withdraw = lastValue(form, 'action', 'approve') === 'withdraw';
    const ids = new Set(form.getAll('ids').map((v) => Number.parseInt(String(v), 10)));
    keys = keys.map((token) => {
      const parsed = parseToken(token);
      if (!parsed || parsed.state !== 'pending' || !ids.has(item(parsed.i).id)) return token;
      return `${withdraw ? 'x' : 'a'}${parsed.i}`;
    });
    return html(
      `${rowsHtml(keys, page_)}
${keysHtml(keys, { oob: true })}
${statusHtml(keys, page_, { oob: true })}`,
    );
  }

  return null;
}
