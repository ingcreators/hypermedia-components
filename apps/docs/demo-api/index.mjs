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
import * as liveSearch from './recipes/live-search.mjs';

const RECIPES = new Map([
  ['live-search', liveSearch],
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
