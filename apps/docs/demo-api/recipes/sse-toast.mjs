// sse-toast — recipes/sse-toast/contract.md
//
//   GET /events → text/event-stream of named events with JSON
//                 payloads. The demo plays ONE ~15 s scripted sequence
//                 and then terminates itself (every demo stream must —
//                 Workers wall-clock hygiene). Reload to replay.
//   GET /items  → 200, the complete <section class="hc-data-region">
//                 fragment (htmx) or a full page (no HX-Request) — the
//                 region the stream's `items:changed` push invalidates.
//
// The scripted sequence (times from connect):
//
//   ~0.5 s  hc:toast       sticky "Build #42 started" (duration 0, so
//                          the in-place update below stays visible)
//   ~4 s    hc:toast       same id → "Build #42 finished" (success) —
//                          the contract's update-by-`id` pattern
//   ~7 s    items:changed  {} — the region refetches GET /items
//   ~12 s   hc:toast       "Nightly export completed" (info)
//   ~15 s   demo:done      {} — named in the demo markup's
//                          data-sse-close; the client closes, then the
//                          stream ends server-side too
//
// `?fast=1` divides every sleep by 50 (see sse.mjs) so the vitest
// suite can `await response.text()` the full body in < 1 s.
//
// Same deliberate deviation as data-region.mjs: the re-rendered
// section's trigger is `items:changed from:body` WITHOUT `load` —
// htmx fires `load` on freshly processed elements, so echoing it back
// in an outerHTML self-swap refetches forever. The page-side
// placeholder keeps `load, items:changed from:body`.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';
import { demoSpeed, sseResponse } from '../sse.mjs';

const API = `${DOCS_BASE}/api/recipes/sse-toast`;
const SECTION_ID = 'sse-toast-demo-items';

// [delay-before-send (ms), SSE event name, JSON payload]. Payloads are
// objects — per the sse-dispatch contract only object payloads are
// dispatched — and serialize to a single ASCII line.
const SCRIPT = [
  [
    500,
    'hc:toast',
    { id: 'sse-toast-demo-build', message: 'Build #42 started', variant: 'info', duration: 0 },
  ],
  [
    3500,
    'hc:toast',
    {
      id: 'sse-toast-demo-build',
      message: 'Build #42 finished',
      variant: 'success',
      duration: 4000,
    },
  ],
  [3000, 'items:changed', {}],
  [5000, 'hc:toast', { message: 'Nightly export completed', variant: 'info' }],
  [3000, 'demo:done', {}],
];

const ITEMS = ['Export bundle', 'Build log', 'Artifact manifest'];

/** UTC wall-clock time, HH:MM:SS. */
function renderedAt() {
  return new Date().toISOString().slice(11, 19);
}

function listHtml() {
  const lis = ITEMS.map((name) => `    <li>${escapeHtml(name)}</li>`).join('\n');
  return `  <ul>\n${lis}\n  </ul>`;
}

/** The complete region — the outerHTML swap unit. */
function sectionHtml() {
  return `<section
  id="${SECTION_ID}"
  class="hc-data-region"
  data-hx-get="${API}/items"
  data-hx-trigger="items:changed from:body"
  data-hx-swap="outerHTML"
  data-hx-indicator="closest .hc-data-region"
  aria-busy="false">
  <header class="hc-data-region__header">
    <h2>Items</h2>
    <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
  </header>
${listHtml()}
  <p class="hc-field__message">Rendered at ${renderedAt()} UTC</p>
</section>`;
}

/**
 * The whole SSE scope, fresh — mirrors SseToastDemo.astro's initial
 * markup. Swapping it in tears down the old EventSource (the SSE
 * extension cleans up with its element) and connects a new one, so
 * the docs demo's Replay button can re-run the scripted stream: the
 * sequence is ~15 s and one-shot, and a reader who scrolls to the
 * demo after it finished would otherwise meet a dead demo.
 */
function scopeHtml() {
  return `<div id="sse-toast-demo-scope"
     data-hx-ext="sse"
     data-sse-connect="${API}/events"
     data-sse-close="demo:done">
  <span hidden data-hc-sse-dispatch data-sse-swap="hc:toast, items:changed"></span>
  <section id="sse-toast-demo-items" class="hc-data-region"
           data-hx-get="${API}/items"
           data-hx-trigger="load, items:changed from:body"
           data-hx-swap="outerHTML"
           data-hx-indicator="closest .hc-data-region"
           aria-busy="false">
    <header class="hc-data-region__header">
      <h2>Items</h2>
      <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
    </header>
  </section>
</div>`;
}

export function handle({ method, path, request, url }) {
  if (method === 'GET' && path === '/scope') {
    if (isHtmx(request)) return html(scopeHtml());
    return page('SSE toast demo', scopeHtml());
  }

  if (method === 'GET' && path === '/events') {
    // No isHtmx() branch: EventSource requests carry no HX-Request
    // header — the stream is the only shape this endpoint has.
    return sseResponse(
      async (send, sleep, isCancelled) => {
        for (const [delay, event, payload] of SCRIPT) {
          await sleep(delay);
          if (isCancelled()) return;
          send(event, JSON.stringify(payload));
        }
      },
      { speed: demoSpeed(url) },
    );
  }

  if (method === 'GET' && path === '/items') {
    if (isHtmx(request)) return html(sectionHtml());

    // No-JS fallback: a direct navigation gets a readable page — the
    // region simply never refreshes without htmx.
    return page(
      'SSE toast demo',
      `${listHtml()}\n<p>Rendered at ${renderedAt()} UTC</p>`,
    );
  }

  return null;
}
