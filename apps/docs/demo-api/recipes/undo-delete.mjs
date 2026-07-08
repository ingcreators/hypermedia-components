// undo-delete — recipes/undo-delete/contract.md
//
//   GET    /items                → 200, the demo table's tbody rows
//                                  (three canned items with plain
//                                  Delete buttons — no data-hc-confirm)
//   DELETE /items/<id>           → 200 + the hidden tombstone row +
//                                  `HX-Trigger: {"hc:toast": …}` with
//                                  an Undo action button
//   DELETE unknown id            → 404
//   POST   /items/<id>/restore?deletedAt=<ts>
//                                → 200 always (200-with-truth):
//                                  within grace → the normal row +
//                                  success toast; expired (or missing/
//                                  invalid ts) → the tombstone again +
//                                  "Too late" error toast
//   POST   restore unknown id    → 404
//
// Stateless: the soft-delete grace period is threaded through the
// tombstone's restore URL as a `deletedAt` timestamp instead of server
// state. The pairing key `undo-delete-demo-item-<id>:restore` appears
// in exactly two places — the toast's action.event and the tombstone's
// data-hx-trigger.

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

/** Grace period for undo, in milliseconds (the toast shows for 10 s). */
export const GRACE_MS = 30_000;

const API = `${DOCS_BASE}/api/recipes/undo-delete`;

/** One normal row — contract.md state 1 (also what restore returns). */
function rowHtml(id, name) {
  return `<tr id="undo-delete-demo-item-${id}"><td>${escapeHtml(name)}</td><td><button class="hc-button" data-size="sm" type="button" data-hx-delete="${API}/items/${id}" data-hx-target="closest tr" data-hx-swap="outerHTML" data-hx-disabled-elt="this">Delete</button></td></tr>`;
}

/** The hidden tombstone — contract.md state 2, position-preserving. */
function tombstoneHtml(id, deletedAt) {
  return `<tr id="undo-delete-demo-item-${id}" hidden data-hx-post="${API}/items/${id}/restore?deletedAt=${deletedAt}" data-hx-trigger="undo-delete-demo-item-${id}:restore from:body" data-hx-swap="outerHTML"></tr>`;
}

function rowsFragment() {
  return Object.entries(ITEMS)
    .map(([id, name]) => rowHtml(id, name))
    .join('\n');
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const rows = rowsFragment();
    if (isHtmx(request)) return html(rows);

    // No-JS fallback: a direct navigation gets a readable page. The
    // buttons need htmx + installToast, so just show the data.
    return page(
      'Undo delete demo',
      `<table>
  <thead><tr><th>Item</th><th>Actions</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`,
    );
  }

  const deleteMatch = method === 'DELETE' && path.match(/^\/items\/([^/]+)$/);
  if (deleteMatch) {
    const id = deleteMatch[1];
    const name = ITEMS[id];
    if (!name) return notFound();
    // Soft delete: the tombstone keeps the DOM slot and carries the
    // restore wiring; the grace clock travels in its restore URL.
    return html(tombstoneHtml(id, Date.now()), {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': {
            id: `undo-delete-demo-item-${id}`,
            message: `"${name}" deleted`,
            variant: 'info',
            duration: 10000,
            action: {
              label: 'Undo',
              event: `undo-delete-demo-item-${id}:restore`,
            },
          },
        }),
      },
    });
  }

  const restoreMatch =
    method === 'POST' && path.match(/^\/items\/([^/]+)\/restore$/);
  if (restoreMatch) {
    const id = restoreMatch[1];
    const name = ITEMS[id];
    if (!name) return notFound();

    const deletedAt = Number(url.searchParams.get('deletedAt'));
    // Missing / invalid timestamp counts as expired — never guess in
    // favor of restoring.
    const withinGrace =
      Number.isFinite(deletedAt) && Date.now() - deletedAt <= GRACE_MS;

    if (withinGrace) {
      // 200 + the normal row: outerHTML replaces the tombstone, so the
      // item reappears at its original position. Reusing the toast id
      // updates the undo toast in place. Idempotent: restoring a row
      // that was never deleted just re-renders it.
      return html(rowHtml(id, name), {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': {
              id: `undo-delete-demo-item-${id}`,
              message: `"${name}" restored`,
              variant: 'success',
              duration: 3000,
            },
          }),
        },
      });
    }

    // Expired: 200-with-truth — the tombstone again (same deletedAt,
    // the slot stays empty) plus an error toast. The em dash rides the
    // header as a \u2014 escape (hxTrigger keeps headers pure ASCII).
    return html(tombstoneHtml(id, url.searchParams.get('deletedAt') ?? 0), {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': {
            id: `undo-delete-demo-item-${id}`,
            message: `Too late — "${name}" was permanently deleted`,
            variant: 'error',
          },
        }),
      },
    });
  }

  return null;
}
