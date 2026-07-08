// confirm-action — recipes/confirm-action/contract.md
//
//   GET    /items       → 200, the demo table's tbody rows (three
//                         canned items, each with a confirm-gated
//                         Delete button)
//   DELETE /items/<id>  → 200 + empty body (the row's outerHTML swap
//                         removes it) + `HX-Trigger: {"hc:toast": …}`
//                         naming the deleted item
//   DELETE unknown id   → 404
//
// Stateless on purpose: deleting is a client-visual effect (the row
// disappears via the swap); the demo's Reset button just refetches
// GET /items.

import {
  DOCS_BASE,
  escapeHtml,
  html,
  hxTrigger,
  isHtmx,
  notFound,
  page,
} from '../html.mjs';

const ITEMS = { 1: 'Anvil', 2: 'Sprocket', 3: 'Widget' };

/** One table row, mirroring recipes/confirm-action/expanded.html. */
function rowHtml(id, name) {
  const url = `${DOCS_BASE}/api/recipes/confirm-action/items/${id}`;
  return `<tr><td>${escapeHtml(name)}</td><td><span class="hc-action"><button class="hc-button" data-size="sm" data-variant="error" type="button" data-hc-confirm="Delete ${escapeHtml(name)}?" data-hx-delete="${url}" data-hx-trigger="hc:confirmed" data-hx-target="closest tr" data-hx-swap="outerHTML" data-hx-disabled-elt="this" data-hx-indicator="closest .hc-action">Delete</button><span class="hc-spinner htmx-indicator" aria-hidden="true"></span></span></td></tr>`;
}

function rowsFragment() {
  return Object.entries(ITEMS)
    .map(([id, name]) => rowHtml(id, name))
    .join('\n');
}

export function handle({ method, path, request }) {
  if (method === 'GET' && path === '/items') {
    const rows = rowsFragment();
    if (isHtmx(request)) return html(rows);

    // No-JS fallback: a direct navigation gets a readable page. The
    // buttons need htmx + installConfirm, so just show the data.
    return page(
      'Confirm action demo',
      `<table>
  <thead><tr><th>Item</th><th>Actions</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`,
    );
  }

  const match = method === 'DELETE' && path.match(/^\/items\/([^/]+)$/);
  if (match) {
    const name = ITEMS[match[1]];
    if (!name) return notFound();
    // Empty 200 body: the button targets `closest tr` with an
    // outerHTML swap, so the row disappears; the toast confirms it.
    return html('', {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': { message: `"${name}" deleted`, variant: 'success' },
        }),
      },
    });
  }

  return null;
}
