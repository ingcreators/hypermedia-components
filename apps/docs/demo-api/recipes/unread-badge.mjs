// unread-badge — recipes/unread-badge/contract.md
//
//   GET  /nav       → 200, the current nav fragment (self-polling)
//   GET  /nav?flood=1 → 200, a past-the-cap fragment ("9+")
//   POST /read-all  → 200, confirmation + the ZEROED nav fragment
//                     out-of-band (the anti-drift rule)
//
// Stateless twist: a real server counts `read_at IS NULL`; Workers
// isolates can't, so the poll URL threads an anchor timestamp
// (`?since=<ms>`) and the count derives from wall-clock elapsed —
// one "arrival" every few seconds. Mark-all-read answers with a
// fresh anchor (`since=now`), so the badge zeroes and then honestly
// starts creeping up again as new demo arrivals land.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/unread-badge`;
const NAV_ID = 'unread-badge-demo-nav';
const PANEL_ID = 'unread-badge-demo-panel';

const CAP = 9; // 99 is customary; 9 keeps the state reachable in a demo
const ARRIVAL_MS = 4000; // one unread arrival every 4s
const FIRST_LOAD_UNREAD = 3;

function count(since) {
  const elapsed = Date.now() - since;
  return elapsed > 0 ? Math.floor(elapsed / ARRIVAL_MS) : 0;
}

function navFragment(since, { oob = false } = {}) {
  const n = count(since);
  const capped = n > CAP;
  const label = n === 0
    ? 'Notifications'
    : capped
      ? `Notifications, more than ${CAP} unread`
      : `Notifications, ${n} unread`;
  const badge = n === 0
    ? ''
    : `\n  <span class="hc-badge" data-variant="info" aria-hidden="true">${capped ? `${CAP}+` : n}</span>`;
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  return `<a class="hc-button" data-variant="ghost" href="${API}/list"
   id="${NAV_ID}" data-hc-unread aria-label="${escapeHtml(label)}"${oobAttr}
   data-hx-get="${API}/nav?since=${since}" data-hx-trigger="every 3s"
   data-hx-target="this" data-hx-swap="outerHTML">
  Notifications${badge}
</a>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/nav') {
    const flood = url.searchParams.get('flood') === '1';
    const raw = Number(url.searchParams.get('since'));
    const since = flood
      ? Date.now() - (CAP + 3) * ARRIVAL_MS
      : Number.isFinite(raw) && raw > 0
        ? raw
        : Date.now() - FIRST_LOAD_UNREAD * ARRIVAL_MS;
    const body = navFragment(since);
    return isHtmx(request)
      ? html(body)
      : page('Unread badge demo', `${body}\n<div id="${PANEL_ID}"></div>`);
  }

  if (method === 'POST' && path === '/read-all') {
    // The normal payload (the re-rendered list / confirmation) plus
    // the zeroed nav fragment out-of-band — the next poll merely
    // confirms it.
    return html(
      `<p class="hc-field__hint">All caught up — 0 unread. New demo
  arrivals land every few seconds, so watch the badge come back.</p>
${navFragment(Date.now(), { oob: true })}`,
    );
  }

  // The nav item's real href — a plain navigation in a real app.
  if (method === 'GET' && path === '/list') {
    return page(
      'Notifications',
      `<p>In a real app this URL is the notifications page; the demo
  fragment's <code>href</code> points here so the no-JS path stays a
  working link.</p>`,
    );
  }

  return null;
}
