// data-region — recipes/data-region/contract.md
//
//   GET  /items        → 200, the complete <section class="hc-data-region">
//                        fragment (htmx) or a full page (no HX-Request)
//   GET  /items?poll=1 → 200, the polling flavor of the region — same
//                        contract, but the fragment re-arms an
//                        `every 10s` interval instead of listening for
//                        a domain event ("Polling on a schedule" in the
//                        recipe docs)
//   POST /refresh      → 204 + HX-Trigger: {"items:changed":{},
//                        "hc:toast":…} — the multi-event header other
//                        recipes use to invalidate the region
//
// Stateless: the list is canned; the "Rendered at <UTC HH:MM:SS>" line
// is the changing datum that makes each refetch visibly different.
//
// One deliberate deviation from expanded.html: the RE-RENDERED section
// carries `data-hx-trigger="items:changed from:body"` — without the
// `load` part. htmx (2.0.10) fires `load` on every freshly processed
// element, so echoing `load` back in an outerHTML self-swap refetches
// forever (verified empirically: ~30 req/s). The page-side placeholder
// keeps `load, items:changed from:body` for the initial fetch; the
// fragment listens for the event only — the same split the core
// browser-test server uses (packages/core/test-browser/serve.mjs,
// /mock/sse/region). The swap stays idempotent: every fragment carries
// the same attributes as the previous fragment.
//
// The polling region has the same class of loop risk: its page-side
// placeholder carries `load, every 10s` (the docs' polling idiom — one
// fetch on render, then the schedule), but the re-rendered fragment
// carries `every 10s` only. htmx re-arms interval triggers on the
// freshly swapped element — that restart IS the poll; echoing `load`
// back would refetch forever exactly like the event region.

import { DOCS_BASE, escapeHtml, html, hxTrigger, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/data-region`;
const SECTION_ID = 'data-region-demo-items';
const POLL_SECTION_ID = 'data-region-demo-poll';

const ITEMS = ['Anvil', 'Rocket skates', 'Tornado seeds'];

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

/** The polling flavor — interval-only trigger; the interval re-arms
 * on every outerHTML self-swap, which is the intended 10 s poll. */
function pollSectionHtml() {
  return `<section
  id="${POLL_SECTION_ID}"
  class="hc-data-region"
  data-hx-get="${API}/items?poll=1"
  data-hx-trigger="every 10s"
  data-hx-swap="outerHTML"
  data-hx-indicator="closest .hc-data-region"
  aria-busy="false">
  <header class="hc-data-region__header">
    <h2>Polling region</h2>
    <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
  </header>
${listHtml()}
  <p class="hc-field__message">Rendered at ${renderedAt()} UTC</p>
</section>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const poll = url.searchParams.has('poll');
    if (isHtmx(request)) return html(poll ? pollSectionHtml() : sectionHtml());

    // No-JS fallback: a direct navigation gets a readable page — the
    // region simply never refreshes without htmx.
    return page(
      'Data region demo',
      `${listHtml()}\n<p>Rendered at ${renderedAt()} UTC</p>`,
    );
  }

  if (method === 'POST' && path === '/refresh') {
    // "A change happened elsewhere": nothing to swap (204), just the
    // domain event that makes the region refetch, plus a toast. The
    // em dash exercises the \uXXXX ASCII escaping headers need.
    return new Response(null, {
      status: 204,
      headers: {
        'HX-Trigger': hxTrigger({
          'items:changed': {},
          'hc:toast': {
            message: 'Change saved — the region refetches',
            variant: 'success',
          },
        }),
      },
    });
  }

  return null;
}
