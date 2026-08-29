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
import * as autosave from './recipes/autosave.mjs';
import * as cascadingSelect from './recipes/cascading-select.mjs';
import * as chart from './recipes/chart.mjs';
import * as chatMessages from './recipes/chat-messages.mjs';
import * as confirmAction from './recipes/confirm-action.mjs';
import * as csvImport from './recipes/csv-import.mjs';
import * as dataRegion from './recipes/data-region.mjs';
import * as datagridBulkActions from './recipes/datagrid-bulk-actions.mjs';
import * as datagridBulkErrors from './recipes/datagrid-bulk-errors.mjs';
import * as datagridColumns from './recipes/datagrid-columns.mjs';
import * as datagridEditConflict from './recipes/datagrid-edit-conflict.mjs';
import * as datagridEditErrors from './recipes/datagrid-edit-errors.mjs';
import * as datagridFilter from './recipes/datagrid-filter.mjs';
import * as datagridInfinite from './recipes/datagrid-infinite.mjs';
import * as datagridTree from './recipes/datagrid-tree.mjs';
import * as datagridPager from './recipes/datagrid-pager.mjs';
import * as datagridPrefs from './recipes/datagrid-prefs.mjs';
import * as editConflict from './recipes/edit-conflict.mjs';
import * as fieldErrors from './recipes/field-errors.mjs';
import * as fileUpload from './recipes/file-upload.mjs';
import * as filterPopover from './recipes/filter-popover.mjs';
import * as inlineEdit from './recipes/inline-edit.mjs';
import * as lazyPanel from './recipes/lazy-panel.mjs';
import * as lazyTree from './recipes/lazy-tree.mjs';
import * as liveSearch from './recipes/live-search.mjs';
import * as multiStepForm from './recipes/multi-step-form.mjs';
import * as mutatingForm from './recipes/mutating-form.mjs';
import * as postalAddress from './recipes/postal-address.mjs';
import * as datagridSnapshotPager from './recipes/datagrid-snapshot-pager.mjs';
import * as datagridSort from './recipes/datagrid-sort.mjs';
import * as dataGridPage from './recipes/data-grid-page.mjs';
import * as rowDetail from './recipes/row-detail.mjs';
import * as savedViews from './recipes/saved-views.mjs';
import * as sessionExpiry from './recipes/session-expiry.mjs';
import * as remoteDialog from './recipes/remote-dialog.mjs';
import * as requestAction from './recipes/request-action.mjs';
import * as resultCap from './recipes/result-cap.mjs';
import * as sseToast from './recipes/sse-toast.mjs';
import * as sseUpdates from './recipes/sse-updates.mjs';
import * as toast from './recipes/toast.mjs';
import * as transfer from './recipes/transfer.mjs';
import * as undoDelete from './recipes/undo-delete.mjs';

const RECIPES = new Map([
  ['autosave', autosave],
  ['cascading-select', cascadingSelect],
  ['chart', chart],
  ['chat-messages', chatMessages],
  ['confirm-action', confirmAction],
  ['csv-import', csvImport],
  ['data-region', dataRegion],
  ['datagrid-bulk-actions', datagridBulkActions],
  ['datagrid-bulk-errors', datagridBulkErrors],
  ['datagrid-columns', datagridColumns],
  ['datagrid-edit-conflict', datagridEditConflict],
  ['datagrid-edit-errors', datagridEditErrors],
  ['datagrid-filter', datagridFilter],
  ['datagrid-infinite', datagridInfinite],
  ['datagrid-tree', datagridTree],
  ['datagrid-pager', datagridPager],
  ['datagrid-prefs', datagridPrefs],
  ['edit-conflict', editConflict],
  ['field-errors', fieldErrors],
  ['file-upload', fileUpload],
  ['filter-popover', filterPopover],
  ['inline-edit', inlineEdit],
  ['lazy-panel', lazyPanel],
  ['lazy-tree', lazyTree],
  ['live-search', liveSearch],
  ['multi-step-form', multiStepForm],
  ['mutating-form', mutatingForm],
  ['postal-address', postalAddress],
  ['datagrid-snapshot-pager', datagridSnapshotPager],
  ['datagrid-sort', datagridSort],
  ['data-grid-page', dataGridPage],
  ['row-detail', rowDetail],
  ['saved-views', savedViews],
  ['session-expiry', sessionExpiry],
  ['remote-dialog', remoteDialog],
  ['request-action', requestAction],
  ['result-cap', resultCap],
  ['sse-toast', sseToast],
  ['sse-updates', sseUpdates],
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
