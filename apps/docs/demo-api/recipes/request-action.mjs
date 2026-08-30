// request-action — recipes/request-action/contract.md
//
//   GET  /items            → 200, the initial demo region (empty list
//                            + the Add button carrying ?count=0)
//   POST /items?count=<n>  → 200, the full replacement region with
//                            n+1 items + `HX-Trigger: {"hc:toast": …}`
//   POST /items?count=12   → 200, the full (capped) region with a
//                            "list is full" note + an info toast
//
// Stateless counter threading: the region the server returns carries
// the NEXT count in the Add button's URL (`?count=<items shown>`), so
// each response fully determines the next request.

import { DOCS_BASE, html, hxTrigger, isHtmx, page } from '../html.mjs';

const MAX_ITEMS = 12;

/** The full demo region for `count` visible items (contract: the
 * response replaces the target's outerHTML, so it includes the
 * region element itself). */
function regionHtml(count) {
  const lis = Array.from({ length: count }, (_, i) => `  <li>Item ${i + 1}</li>`).join('\n');
  const list =
    count === 0
      ? '<p class="hc-field__message">No items yet — click the button.</p>'
      : `<ul>\n${lis}\n</ul>`;

  const action =
    count >= MAX_ITEMS
      ? '<p class="hc-field__message">Demo list is full — reload the page to reset.</p>'
      : `<span class="hc-action"><button class="hc-button" type="button" data-hx-post="${DOCS_BASE}/api/recipes/request-action/items?count=${count}" data-hx-target="#request-action-demo-items" data-hx-swap="outerHTML" data-hx-disabled-elt="this" data-hx-indicator="closest .hc-action">Add item</button><span class="hc-spinner htmx-indicator" aria-hidden="true"></span></span>`;

  return `<div id="request-action-demo-items">
${list}
${action}
</div>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const region = regionHtml(0);
    if (isHtmx(request)) return html(region);

    // No-JS fallback for direct navigations. The button needs htmx,
    // so just show the initial region.
    return page('Request action demo', region);
  }

  if (method === 'POST' && path === '/items') {
    const raw = Number.parseInt(url.searchParams.get('count') ?? '0', 10);
    const count = Math.min(Math.max(Number.isNaN(raw) ? 0 : raw, 0), MAX_ITEMS);

    if (count >= MAX_ITEMS) {
      return html(regionHtml(MAX_ITEMS), {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: 'Demo list is full', variant: 'info' },
          }),
        },
      });
    }

    const next = count + 1;
    return html(regionHtml(next), {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': { message: `Item ${next} added`, variant: 'success' },
        }),
      },
    });
  }

  return null;
}
