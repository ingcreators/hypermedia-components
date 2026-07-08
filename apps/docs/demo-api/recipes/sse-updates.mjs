// sse-updates — recipes/sse-updates/contract.md
//
//   GET /events → text/event-stream of named events whose data is a
//                 server-rendered fragment on ONE line. The demo plays
//                 a single ~20 s scripted sequence and then terminates
//                 itself (every demo stream must — Workers wall-clock
//                 hygiene). Reload to replay.
//
// The scripted sequence (times from connect):
//
//   ~1 s     activity:item  <li> Deploy #128 started
//   ~3.5 s   activity:item  <li> Deploy #128 checks passed
//   ~6 s     status:panel   "Deploy #128 rolling out…"
//   ~8.5 s   activity:item  <li> Deploy #128 finished
//   ~11 s    activity:item  <li> Deploy #129 started
//   ~13.5 s  status:panel   "All systems normal" + the hx-swap-oob
//                           alert-badge fragment (one event, two
//                           targets — the contract's OOB composition)
//   ~16 s    activity:item  <li> Cache warmed in 3 regions
//   ~18.5 s  activity:item  <li> Deploy #129 finished
//   ~20 s    status:panel   visible end marker ("Stream ended —
//                           reload to replay."). This must be a
//                           regular status:panel push: the close
//                           event's own payload is never swapped by
//                           the SSE extension.
//   ~20.5 s  stream:done    named in the demo markup's data-sse-close;
//                           the client closes deliberately, then the
//                           stream ends server-side too
//
// Activity items carry an HH:MM:SS UTC timestamp so replays are
// visibly fresh. `?fast=1` divides every sleep by 50 (see sse.mjs) so
// the vitest suite can `await response.text()` the full body in < 1 s.

import { escapeHtml } from '../html.mjs';
import { demoSpeed, sseResponse } from '../sse.mjs';

const BADGE_ID = 'sse-updates-demo-alert-badge';

/** UTC wall-clock time, HH:MM:SS. */
function stamp() {
  return new Date().toISOString().slice(11, 19);
}

/** One feed entry — a single-line fragment for the afterbegin swap. */
function item(text) {
  return `<li class="hc-item">${stamp()} — ${escapeHtml(text)}</li>`;
}

// [delay-before-send (ms), SSE event name, payload thunk]. Thunks so
// the timestamps are minted when the event is sent, not at connect.
const SCRIPT = [
  [1000, 'activity:item', () => item('Deploy #128 started')],
  [2500, 'activity:item', () => item('Deploy #128 checks passed')],
  [2500, 'status:panel', () => '<p>Deploy #128 rolling out…</p>'],
  [2500, 'activity:item', () => item('Deploy #128 finished')],
  [2500, 'activity:item', () => item('Deploy #129 started')],
  [
    2500,
    'status:panel',
    () =>
      `<p>All systems normal</p><span class="hc-badge" id="${BADGE_ID}" hx-swap-oob="true">1</span>`,
  ],
  [2500, 'activity:item', () => item('Cache warmed in 3 regions')],
  [2500, 'activity:item', () => item('Deploy #129 finished')],
  [
    1500,
    'status:panel',
    () => '<p class="hc-field__message">Stream ended — reload to replay.</p>',
  ],
  [500, 'stream:done', () => ''],
];

export function handle({ method, path, url }) {
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
