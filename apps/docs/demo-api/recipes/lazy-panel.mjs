// lazy-panel — recipes/lazy-panel/contract.md
//
//   GET /panels/usage     → 200, "Usage" card       (intersect once)
//   GET /panels/advanced  → 200, "Advanced" card    (<details> toggle)
//   GET /panels/overview  → 200, "Overview" card    (tabs, load)
//   GET /panels/revenue   → 200, "Revenue" card     (tabs, hc:tabactivated once)
//   GET /panels/flaky     → 503 + `HX-Reswap: innerHTML` + alert body
//                           + `HX-Trigger: {"hc:toast": …}` (error branch)
//
// Each card ends with a "Loaded at <UTC time>" line so readers can see
// *when* the deferred fetch actually ran. A 400ms artificial delay
// keeps the loading indicators visible (fine on Workers and in dev).
// `Cache-Control: no-store` so the browser never replays a stale
// timestamp. Stateless.
//
// On the flaky branch the API stays contract-faithful: 503 with
// `HX-Reswap: innerHTML` and the alert fragment as the body, exactly
// as recipes/lazy-panel/contract.md documents. Note that htmx 2's
// default `responseHandling` does NOT swap 5xx responses, and
// `HX-Reswap` alone only picks the swap *style* — it does not force a
// swap. So whether the alert body lands in the panel depends on the
// page's htmx error configuration (the docs DemoFrame only allows 422
// swaps, deliberately — that hook belongs to the field-errors family
// of contracts). To make the demo react visibly everywhere, the same
// response also carries an `HX-Trigger` error toast; the recipe page
// prose spells out both outcomes.

import { html, hxTrigger, isHtmx, page } from '../html.mjs';

const DELAY_MS = 400;

const PANELS = {
  usage: {
    title: 'Usage',
    line: '4,812 requests this week — up 12% over last week.',
  },
  advanced: {
    title: 'Advanced settings',
    line: 'Danger-zone flags stay hidden until this panel is opened.',
  },
  overview: {
    title: 'Overview',
    line: 'All systems normal — 3 reports ready for review.',
  },
  revenue: {
    title: 'Revenue',
    line: '$12,340 MTD, +8% versus the same period last month.',
  },
};

function loadedAt() {
  return `${new Date().toISOString().slice(11, 19)} UTC`;
}

function cardHtml({ title, line }) {
  return `<div class="hc-card">
  <header class="hc-card__header">${title}</header>
  <div class="hc-card__body">
    <p>${line}</p>
    <p class="hc-field__message">Loaded at ${loadedAt()}</p>
  </div>
</div>`;
}

const FLAKY_ALERT =
  '<p class="hc-alert" data-variant="error" role="alert">Reports are temporarily unavailable. Refresh in a minute.</p>';

export async function handle({ method, path, request }) {
  if (method !== 'GET') return null;

  if (path === '/panels/flaky') {
    // No delay here: an unavailable dependency answers fast; keeping
    // the error branch snappy also keeps the test suite snappy.
    return html(FLAKY_ALERT, {
      status: 503,
      headers: {
        'HX-Reswap': 'innerHTML',
        'HX-Trigger': hxTrigger({
          'hc:toast': {
            message: 'Reports are temporarily unavailable',
            variant: 'error',
          },
        }),
        'cache-control': 'no-store',
      },
    });
  }

  const match = path.match(/^\/panels\/([^/]+)$/);
  if (match) {
    const panel = PANELS[match[1]];
    if (!panel) return null;
    await new Promise((r) => setTimeout(r, DELAY_MS));
    const card = cardHtml(panel);
    if (isHtmx(request)) return html(card, { headers: { 'cache-control': 'no-store' } });

    // No-JS fallback: a direct navigation gets a readable page (the
    // lazy triggers need htmx; the content itself is just HTML).
    return page('Lazy panel demo', card, {
      headers: { 'cache-control': 'no-store' },
    });
  }

  return null;
}
