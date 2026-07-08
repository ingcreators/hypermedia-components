// Demo API for the recipe docs — router.
//
// Implements each recipe's server response contract
// (recipes/<name>/contract.md) so the live demos on the docs site have
// something real to talk to. Consumed by two hosts:
//
//   - worker.mjs (Cloudflare Worker) routes
//     /hypermedia-components/api/recipes/* here after stripping the
//     base path, and
//   - vite-plugin.mjs mounts the same handler in `docs:dev` /
//     `docs:preview`.
//
// Design rules (plans/hc-live-recipe-demos-plan-en.md):
//   - stateless: every response is derived from the request alone —
//     Workers isolates are ephemeral and shared across visitors;
//   - namespaced: each recipe owns /api/recipes/<recipe>/…, because
//     the contracts reuse paths (three different `GET /items` shapes);
//   - the contract is the spec: fragments, status codes and HX-*
//     headers follow recipes/<name>/contract.md.

import { notFound } from './html.mjs';
import * as cascadingSelect from './recipes/cascading-select.mjs';
import * as chart from './recipes/chart.mjs';
import * as confirmAction from './recipes/confirm-action.mjs';
import * as dataRegion from './recipes/data-region.mjs';
import * as datagridBulkActions from './recipes/datagrid-bulk-actions.mjs';
import * as datagridPager from './recipes/datagrid-pager.mjs';
import * as fieldErrors from './recipes/field-errors.mjs';
import * as filterPopover from './recipes/filter-popover.mjs';
import * as inlineEdit from './recipes/inline-edit.mjs';
import * as lazyPanel from './recipes/lazy-panel.mjs';
import * as lazyTree from './recipes/lazy-tree.mjs';
import * as liveSearch from './recipes/live-search.mjs';
import * as multiStepForm from './recipes/multi-step-form.mjs';
import * as mutatingForm from './recipes/mutating-form.mjs';
import * as remoteDialog from './recipes/remote-dialog.mjs';
import * as requestAction from './recipes/request-action.mjs';
import * as toast from './recipes/toast.mjs';
import * as transfer from './recipes/transfer.mjs';
import * as undoDelete from './recipes/undo-delete.mjs';

const RECIPES = new Map([
  ['cascading-select', cascadingSelect],
  ['chart', chart],
  ['confirm-action', confirmAction],
  ['data-region', dataRegion],
  ['datagrid-bulk-actions', datagridBulkActions],
  ['datagrid-pager', datagridPager],
  ['field-errors', fieldErrors],
  ['filter-popover', filterPopover],
  ['inline-edit', inlineEdit],
  ['lazy-panel', lazyPanel],
  ['lazy-tree', lazyTree],
  ['live-search', liveSearch],
  ['multi-step-form', multiStepForm],
  ['mutating-form', mutatingForm],
  ['remote-dialog', remoteDialog],
  ['request-action', requestAction],
  ['toast', toast],
  ['transfer', transfer],
  ['undo-delete', undoDelete],
]);

/**
 * Handle a demo API request. `request.url`'s path must already be
 * base-stripped (i.e. start with `/api/recipes/`).
 *
 * @param {Request} request
 * @returns {Promise<Response | null>} `null` when the URL is not a
 *   demo API path at all (callers fall through to their next handler).
 */
export async function handleDemoApi(request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/recipes\/([a-z0-9-]+)(\/.*)?$/);
  if (!match) return null;

  const recipe = RECIPES.get(match[1]);
  const path = match[2] || '/';
  let response = recipe
    ? await recipe.handle({ request, url, method: request.method, path })
    : null;
  if (!response) response = notFound();

  // Demo responses must never be cached — they are request-derived
  // and the fragments carry per-interaction state in their URLs.
  const headers = new Headers(response.headers);
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.status === 204 ? null : response.body, {
    status: response.status,
    headers,
  });
}
