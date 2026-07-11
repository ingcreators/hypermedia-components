// datagrid-bulk-actions — recipes/datagrid-bulk-actions/contract.md
//
//   GET  /products/rows?state=  → 200, the current rows (the tbody's
//                                 innerHTML) for the demo's load trigger
//   POST /products/bulk         → htmx: always 200 + re-rendered rows +
//                                 OOB status + OOB state input +
//                                 HX-Trigger toast (success / warning /
//                                 info — no status-code choreography);
//                                 no HX-Request: 303 + Location (PRG)
//   GET  /products              → the 303 landing page (no-JS note)
//
// Stateless: the grid state rides in a hidden `state` input the server
// re-renders out-of-band on every POST (`archived:102,104;deleted:105`)
// — the form serializes it back on the next submit. Six canned
// products; id 101 ("Anvil") is protected — archive/delete always
// fails for it, which is how the demo reaches the contract's
// partial-failure `warning` toast.

import { DOCS_BASE, escapeHtml, html, hxTrigger, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-bulk-actions`;
const ROWS_ID = 'datagrid-bulk-actions-demo-rows';
const STATUS_ID = 'datagrid-bulk-actions-demo-rows-status';
const STATE_ID = 'datagrid-bulk-actions-demo-state';
const PROTECTED_ID = '101';

const PRODUCTS = new Map([
  ['101', 'Anvil'],
  ['102', 'Rocket skates'],
  ['103', 'Dynamite kit'],
  ['104', 'Giant magnet'],
  ['105', 'Jet-propelled pogo stick'],
  ['106', 'Tornado seeds'],
]);

const byId = (a, b) => Number(a) - Number(b);

/** Parse `archived:102,104;deleted:105` defensively into two Sets. */
function parseState(raw) {
  const state = { archived: new Set(), deleted: new Set() };
  for (const part of String(raw ?? '').split(';')) {
    const [key, ids = ''] = part.split(':');
    if (key !== 'archived' && key !== 'deleted') continue;
    for (const id of ids.split(',')) {
      const trimmed = id.trim();
      if (PRODUCTS.has(trimmed)) state[key].add(trimmed);
    }
  }
  return state;
}

function serializeState(state) {
  const parts = [];
  if (state.archived.size > 0) parts.push(`archived:${[...state.archived].sort(byId).join(',')}`);
  if (state.deleted.size > 0) parts.push(`deleted:${[...state.deleted].sort(byId).join(',')}`);
  return parts.join(';');
}

function rowHtml(id, state) {
  const name = PRODUCTS.get(id);
  const status = state.archived.has(id) ? 'Archived' : 'Active';
  return `<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" name="ids" value="${id}" aria-label="Select ${escapeHtml(name)}"></td>
  <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">${id}</th>
  <td class="hc-datagrid__cell">${escapeHtml(name)}</td>
  <td class="hc-datagrid__cell">${status}</td>
</tr>`;
}

function remainingIds(state) {
  return [...PRODUCTS.keys()].filter((id) => !state.deleted.has(id));
}

function rowsHtml(state) {
  return remainingIds(state)
    .map((id) => rowHtml(id, state))
    .join('\n');
}

function statusHtml(state) {
  const n = remainingIds(state).length;
  return `<p id="${STATUS_ID}" data-hx-swap-oob="true" aria-live="polite">${n} product${n === 1 ? '' : 's'}</p>`;
}

function stateInputHtml(state) {
  return `<input type="hidden" id="${STATE_ID}" name="state" data-hx-swap-oob="true" value="${serializeState(state)}">`;
}

export async function handle({ request, url, method, path }) {
  if (method === 'GET' && path === '/products/rows') {
    // The demo tbody's load-trigger fetch (state param optional).
    const state = parseState(url.searchParams.get('state'));
    return html(rowsHtml(state));
  }

  if (method === 'GET' && path === '/products') {
    // The 303 landing for the no-JS path. The demo server is
    // stateless, so this page shows the pristine catalog.
    const state = parseState('');
    return page(
      'Datagrid bulk actions demo',
      `<p>In a real app this page would re-render the full grid after the
bulk action — the no-JS post/redirect/get path. This stateless demo
lands on the pristine catalog instead.</p>
<table>
  <thead><tr><th></th><th>ID</th><th>Product</th><th>Status</th></tr></thead>
  <tbody>${rowsHtml(state)}</tbody>
</table>`,
    );
  }

  if (method === 'POST' && path === '/products/bulk') {
    if (!isHtmx(request)) {
      // Native (no-JS) post → classic post/redirect/get.
      return new Response(null, {
        status: 303,
        headers: { Location: `${API}/products` },
      });
    }

    const form = await request.formData();
    const action = form.get('action');
    const state = parseState(form.get('state'));
    const verb = action === 'delete' ? 'deleted' : 'archived';

    // Re-validate server-side: unknown and already-deleted (stale)
    // ids never count, whatever the client sent.
    const requested =
      action === 'archive' || action === 'delete'
        ? [...new Set(form.getAll('ids').map((id) => String(id).trim()))].filter(
            (id) => PRODUCTS.has(id) && !state.deleted.has(id),
          )
        : [];

    let toast;
    if (requested.length === 0) {
      // Empty or stale selection → no-op, current rows unchanged.
      toast = { message: 'Nothing to do', variant: 'info' };
    } else {
      const applied = requested.filter((id) => id !== PROTECTED_ID);
      const failed = requested.length - applied.length;
      for (const id of applied) {
        if (action === 'delete') {
          state.deleted.add(id);
          state.archived.delete(id);
        } else {
          state.archived.add(id);
        }
      }
      toast = failed > 0
        ? { message: `${applied.length} ${verb}, ${failed} failed`, variant: 'warning' }
        : { message: `${applied.length} ${verb}`, variant: 'success' };
    }

    // Always 200 — the response is the page's truth: the current rows,
    // the OOB status line, and the OOB state input the next submit
    // serializes back.
    return html(
      `${rowsHtml(state)}
${statusHtml(state)}
${stateInputHtml(state)}`,
      { headers: { 'HX-Trigger': hxTrigger({ 'hc:toast': toast }) } },
    );
  }

  return null;
}
