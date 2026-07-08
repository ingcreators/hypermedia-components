# Live recipe demos — demo API on the docs Worker

Status: **approved** (2026-07-08). Implementation PRs land in sequence;
see §7 for the breakdown.

## 1. Motivation

The docs site documents 25 recipes, but every recipe page shows static
markup only: the htmx attributes are visible, yet nothing on the page
actually issues a request. Readers cannot *feel* the pattern — the
debounced search, the 422 field-error distribution, the SSE stream, the
undo grace window — without cloning `examples/htmx` locally.

The docs site already runs on a Cloudflare Worker
([`worker.mjs`](../worker.mjs), Static Assets binding). The same Worker
can serve a small **demo API** implementing each recipe's server
response contract, so every recipe page gains a *working* live demo —
on production, on PR previews, and in local `docs:dev`.

This is docs-site infrastructure only. Nothing here ships in
`@hypermedia-components/core`; no public API surface changes.

## 2. Design principles

1. **The contract is the spec.** Each endpoint implements the
   corresponding `recipes/<name>/contract.md` response shape —
   fragments, status codes (200/204/303/422/503), `HX-Trigger` /
   `HX-Retarget` / `HX-Reswap` headers, SSE event names. The demo API
   is a reference implementation of the contracts; if the two disagree,
   the contract wins.
2. **Stateless by construction.** Workers isolates are ephemeral and
   shared across visitors, so no endpoint stores server-side state.
   Every response is derived from the request alone. Where a recipe
   nominally needs state, the demo threads it through the markup it
   returns (the same trick the multi-step-form contract blesses for
   drafts):
   - *undo-delete* — the tombstone's restore URL carries
     `?name=…&deletedAt=…`; grace expiry is a timestamp comparison.
   - *transfer* — the re-rendered form's `data-hx-post` URL carries the
     current membership (`?assigned=1,2`); each POST derives both panes
     from it.
   - *inline-edit* — display/edit fragment URLs carry the current value
     (`?v=…`), so Save→Cancel round-trips keep the edited value.
   - *multi-step-form* — accumulated draft rides as hidden inputs in
     each step fragment (contract-blessed).
   - *chat/streaming* — the placeholder's `data-sse-connect` URL
     carries the prompt.
   No KV, no Durable Objects, no cookies.
3. **Namespaced per recipe.** Contracts reuse paths with incompatible
   shapes (`GET /items` is claimed by live-search, data-region *and*
   filter-popover). Demo endpoints live under
   `/api/recipes/<recipe>/…`, e.g.
   `GET /api/recipes/live-search/items?q=`. Docs pages keep showing the
   canonical contract paths in code blocks; only the live demo markup
   uses the namespaced path.
4. **One handler, two hosts.** A framework-free
   `handleDemoApi(request)` module (web `Request` → `Response`) is
   consumed by both [`worker.mjs`](../worker.mjs) (production/preview)
   and a small Vite dev-server middleware wired through
   `apps/docs/astro.config.mjs` (local `docs:dev`). Same code path
   everywhere htmx points at `<base>/api/recipes/…`.
5. **Demos are shared components.** Each recipe gets one
   `apps/docs/src/components/recipe-demos/<Name>Demo.astro` rendering
   the live markup inside the existing `.hc-preview` frame. The `en`
   and `ja` recipe pages import the same component under a
   "Live demo" / 「ライブデモ」 section, so the two locales cannot
   drift.
6. **htmx is a docs dependency, not a core one.** `htmx.org@^2` (+
   `htmx-ext-sse`) are `apps/docs` devDependencies, bundled by Vite
   through a shared demo bootstrap script (loaded once per page via
   Astro's script dedup). Core stays zero-runtime-deps. The bootstrap
   also applies the two documented client conventions: the one-time
   `htmx:beforeSwap` 422 allowance and `htmx.config.selfRequestsOnly`.
7. **CSP-safe and same-origin.** No inline JS in demo markup, no CDN.
   API responses set `Cache-Control: no-store`. SSE streams close
   themselves (a `done`-style final event or a hard cap ≈ 30–45 s) so
   demo connections never dangle.

## 3. Routing

```text
Worker (worker.mjs)
  /                                → 301 /hypermedia-components/
  /hypermedia-components/api/recipes/*  → handleDemoApi()   ← NEW
  /hypermedia-components/*         → env.ASSETS.fetch()  (unchanged)
```

Only the `api/recipes/` subtree is intercepted. The existing static
`api/manifest.json` (kit manifest, PR #357) keeps resolving through
the assets binding untouched.

In dev, a Vite middleware matches the same
`/hypermedia-components/api/recipes/` prefix, adapts Node req/res to
web `Request`/`Response` (streaming both ways — multipart uploads in,
SSE out), and delegates to the same handler.

## 4. Module layout

```text
apps/docs/demo-api/
  index.mjs            # route table: (method, /api/recipes/<recipe>/…) → handler
  html.mjs             # escape(), hxTrigger() with \uXXXX ASCII escaping, fragment helpers
  recipes/<name>.mjs   # one module per recipe, exports its routes
  node-adapter.mjs     # Node req/res ↔ web Request/Response (dev middleware)
  test/*.test.mjs      # Vitest (node env) — status, headers, fragment shape per contract
apps/docs/src/components/recipe-demos/
  DemoFrame.astro      # shared frame: .hc-preview + htmx bootstrap script
  <Name>Demo.astro     # one per recipe
```

`worker.mjs` imports `apps/docs/demo-api/index.mjs` relatively;
wrangler's bundler resolves it. The docs app gains a `test` script
(`vitest run`) and CI's `unit` job gains one step:
`pnpm --filter @hypermedia-components/docs test`.

## 5. Recipe coverage

| Recipe | Endpoints (under `/api/recipes/<name>`) | Notes |
| --- | --- | --- |
| live-search | `GET /items?q=` | results list + empty state |
| field-errors | `POST /members` | 422 + canonical alert fragment |
| mutating-form | `POST /members`, `GET /members/:id` | 303/`HX-Redirect` success branch, 422 failure |
| inline-edit | `GET /items/42/name`, `GET …/edit`, `PUT …/name` | value threaded via `?v=` |
| multi-step-form | `GET/POST /signup/1..3` | draft as hidden inputs; 422 retarget |
| cascading-select | `GET /areas/cities?prefecture=`, `GET /areas/wards?city=` | OOB deep resets |
| confirm-action | `DELETE /items/:id` | empty body + toast header |
| request-action | `POST /items` | fragment + toast header |
| toast | `POST /save` | `204` + `HX-Trigger` (header-driven) |
| transfer | `POST /roles/42/members` | membership via query, 422 empty-selection |
| data-region | `GET /items`, `POST /items` | full `<section>` re-render; `items:changed` invalidation |
| datagrid-pager | `GET /products?page=&size=` | rows + OOB pager + status |
| datagrid-bulk-actions | `POST /products/bulk` | rows + OOB status + toast variants |
| filter-popover | `GET /items?status=&q=` | close-popover-on-success path |
| lazy-panel | `GET /panels/usage`, `…/advanced`, `…/overview`, `…/revenue`, `…/flaky` | includes 503 + `HX-Reswap` error demo |
| lazy-tree | `GET /nodes/:id/children` | static recursive tree |
| remote-dialog | `GET /items/123/edit`, `POST /items/123` | dialog fragment; close-on-success |
| undo-delete | `DELETE /items/:id`, `POST /items/:id/restore` | grace via `?deletedAt=`; em-dash header escaping |
| chart | `GET /reports/sales?region=` | swap a `<figure class="hc-chart">` |
| copy | — | client-only (no endpoint; live demo already exists) |
| file-upload | `POST /files` | multipart; 422 type validation; OOB fresh form |
| chat-messages | `POST /chat/messages` | user `<li>` + aria-busy placeholder + OOB composer; 422 |
| streaming-response | `GET /chat/messages/:id/stream`, `POST …/stop` | SSE `chunk`/`done`/`error` |
| sse-toast | `GET /events` (toast flavor) | JSON-payload events, self-terminating |
| sse-updates | `GET /events` (updates flavor) | HTML-payload events + OOB + `stream:done` |

## 6. Definition of Done (per recipe)

- Endpoint(s) return the contract's fragment shapes, status codes and
  headers (`HX-Trigger` ASCII-escaped).
- Vitest coverage: happy path + the contract's error branch (422/503/
  grace-expired/…).
- Live demo section on **both** `en` and `ja` recipe pages via the
  shared component; demo works with JS enabled, and no-JS fallback
  paths (plain form GET/POST, 303 PRG) respond sensibly.
- `docs:build` green (links validator), CI green.

## 7. PR breakdown

1. **PR-0 (this document)** — `chore(plans)`.
2. **PR-A foundation** — `handleDemoApi` skeleton + worker routing +
   dev middleware + htmx bootstrap + `DemoFrame.astro` + **live-search**
   end-to-end + Vitest wiring + CI unit step + CHANGELOG.
3. **PR-B forms & actions** — field-errors, mutating-form, inline-edit,
   multi-step-form, cascading-select, confirm-action, request-action,
   toast, transfer.
4. **PR-C collections & overlays** — data-region, datagrid-pager,
   datagrid-bulk-actions, filter-popover, lazy-panel, lazy-tree,
   remote-dialog, undo-delete, chart (+ copy page note).
5. **PR-D streaming & upload** — file-upload, chat-messages,
   streaming-response, sse-toast, sse-updates; DEPLOYMENT.md smoke-check
   additions; recipes index blurbs.

Sequenced (each merges before the next starts) — no stacked PRs.

## 8. Risks / limits

- **Worker wall-clock**: SSE demos cap themselves (≤ ~45 s, then a
  terminal event). Upload demo relies on client-side `xhr.upload`
  progress; Workers accept the multipart body without buffering
  concerns at demo sizes (reject > 1 MiB with the contract's 422).
- **Shared `GET /items` shapes** — solved by namespacing (§3).
- **VRT**: core visual suites screenshot core test pages, not docs —
  unaffected. Docs pages change only by an added section.
- **llms.txt / pagefind**: demo sections are normal page content;
  nothing to exclude.
