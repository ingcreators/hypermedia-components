// sse-updates — recipes/sse-updates/contract.md
//
//   GET /events → text/event-stream of named events whose data is a
//                 server-rendered fragment on ONE line. The demo plays
//                 a single ~23.5 s scripted sequence and then
//                 terminates itself (every demo stream must — Workers
//                 wall-clock hygiene). Reload to replay.
//
// The scripted sequence (times from connect):
//
//   ~1 s     activity:item  <li> Deploy #128 started
//   ~3.5 s   activity:item  <li> Deploy #128 checks passed
//   ~6 s     status:panel   "Deploy #128 rolling out…"
//   ~7.5 s   products:rows  3 <tr> rows — a full tbody page (the
//                           datagrid composition: innerHTML on the
//                           kept tbody, the datagrid-pager rule)
//   ~10 s    activity:item  <li> Deploy #128 finished
//   ~12.5 s  activity:item  <li> Deploy #129 started
//   ~15 s    status:panel   "All systems normal" + the data-hx-swap-oob
//                           alert-badge fragment (one event, two
//                           targets — the contract's OOB composition)
//   ~17.5 s  activity:item  <li> Cache warmed in 3 regions
//   ~19 s    products:rows  3 <tr> rows again, different ids/statuses
//                           and fresh timestamps — the swap is visible
//   ~21.5 s  activity:item  <li> Deploy #129 finished
//   ~23 s    status:panel   visible end marker ("Stream ended —
//                           reload to replay."). This must be a
//                           regular status:panel push: the close
//                           event's own payload is never swapped by
//                           the SSE extension.
//   ~23.5 s  stream:done    named in the demo markup's data-sse-close;
//                           the client closes deliberately, then the
//                           stream ends server-side too
//
// Activity items carry an HH:MM:SS UTC timestamp so replays are
// visibly fresh. `?fast=1` divides every sleep by 50 (see sse.mjs) so
// the vitest suite can `await response.text()` the full body in < 1 s.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';
import { demoSpeed, sseResponse } from '../sse.mjs';

const API = `${DOCS_BASE}/api/recipes/sse-updates`;

const BADGE_ID = 'sse-updates-demo-alert-badge';

/** UTC wall-clock time, HH:MM:SS. */
function stamp() {
  return new Date().toISOString().slice(11, 19);
}

/** One feed entry — a single-line fragment for the afterbegin swap. */
function item(text) {
  return `<li class="hc-item">${stamp()} — ${escapeHtml(text)}</li>`;
}

/** One compact datagrid row (id / status / updated-at). */
function row([id, status]) {
  return `<tr class="hc-datagrid__row"><th class="hc-datagrid__cell" scope="row">${id}</th><td class="hc-datagrid__cell">${escapeHtml(status)}</td><td class="hc-datagrid__cell">${stamp()}</td></tr>`;
}

/** A full page of rows — the tbody's innerHTML on ONE line. */
function rowsPage(entries) {
  return entries.map(row).join('');
}

// [delay-before-send (ms), SSE event name, payload thunk]. Thunks so
// the timestamps are minted when the event is sent, not at connect.
const SCRIPT = [
  [1000, 'activity:item', () => item('Deploy #128 started')],
  [2500, 'activity:item', () => item('Deploy #128 checks passed')],
  [2500, 'status:panel', () => '<p>Deploy #128 rolling out…</p>'],
  [
    1500,
    'products:rows',
    () => rowsPage([[101, 'Active'], [102, 'Syncing'], [103, 'Queued']]),
  ],
  [2500, 'activity:item', () => item('Deploy #128 finished')],
  [2500, 'activity:item', () => item('Deploy #129 started')],
  [
    2500,
    'status:panel',
    () =>
      `<p>All systems normal</p><span class="hc-badge" id="${BADGE_ID}" data-hx-swap-oob="true">1</span>`,
  ],
  [2500, 'activity:item', () => item('Cache warmed in 3 regions')],
  [
    1500,
    'products:rows',
    () => rowsPage([[101, 'Active'], [102, 'Active'], [104, 'Deploying']]),
  ],
  [2500, 'activity:item', () => item('Deploy #129 finished')],
  [
    1500,
    'status:panel',
    () => '<p class="hc-field__message">Stream ended — press Replay to run it again.</p>',
  ],
  [500, 'stream:done', () => ''],
];

/**
 * The whole SSE scope, fresh — mirrors SseUpdatesDemo.astro's initial
 * markup. Swapping it in tears down the old EventSource (the SSE
 * extension cleans up with its element) and connects a new one, so
 * the docs demo's Replay button can re-run the ~23 s one-shot stream
 * for readers who reach the demo after it ended.
 */
function scopeHtml() {
  return `<div id="sse-updates-demo-scope"
     data-hx-ext="sse"
     data-sse-connect="${API}/events"
     data-sse-close="stream:done">
  <section id="sse-updates-demo-status" aria-live="polite" data-sse-swap="status:panel">
    <p>Waiting for updates…</p>
  </section>

  <p>
    Alerts:
    <span class="hc-badge" id="sse-updates-demo-alert-badge">0</span>
  </p>

  <ul id="sse-updates-demo-activity" data-sse-swap="activity:item" data-hx-swap="afterbegin"></ul>

  <div class="hc-datagrid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell" scope="col">ID</th>
            <th class="hc-datagrid__headcell" scope="col">Status</th>
            <th class="hc-datagrid__headcell" scope="col">Updated</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__body" id="sse-updates-demo-rows"
               data-sse-swap="products:rows" data-hx-swap="innerHTML">
          <tr class="hc-datagrid__row">
            <th class="hc-datagrid__cell" scope="row">—</th>
            <td class="hc-datagrid__cell">Waiting for pushed rows…</td>
            <td class="hc-datagrid__cell">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/scope') {
    if (isHtmx(request)) return html(scopeHtml());
    return page('SSE live updates demo', scopeHtml());
  }

  if (method === 'GET' && path === '/events') {
    // No isHtmx() branch: EventSource requests carry no HX-Request
    // header — the stream is the only shape this endpoint has.
    return sseResponse(
      async (send, sleep, isCancelled) => {
        for (const [delay, event, data] of SCRIPT) {
          await sleep(delay);
          if (isCancelled()) return;
          send(event, data());
        }
      },
      { speed: demoSpeed(url) },
    );
  }

  return null;
}
