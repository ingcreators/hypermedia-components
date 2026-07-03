# SSE (Server-Sent Events) — recipes + bridge behavior plan

Status: **approved; implementation pending (two PRs, §8).**
Net-new scope. Server-push is the one delivery mode the kit does not
cover — today "live" means polling (`data-hx-trigger="every Ns"`). The
htmx **SSE extension** (`htmx-ext-sse`, vendored pinned like htmx
itself) owns the connection; we bless two recipes on top of it and add
one ~60-line bridge behavior. Baseline: core `0.1.7`-to-be (post-#281).

## 1. Goal

Blessed patterns for **server-pushed UI** over `text/event-stream`:

1. **`sse-updates`** — a region (or datagrid tbody) that receives
   server-rendered fragments as SSE events, including out-of-band
   fragments for multi-target pushes. Pure extension usage; no new JS.
2. **`sse-toast`** — server-pushed notifications: an SSE event carrying
   a JSON payload becomes an `hc:toast` (or any allow-listed DOM event,
   e.g. a [data-region](../recipes/data-region/) invalidation) via one
   new bridge behavior, `installSseDispatch()`.

Non-goals: WebSockets (two-way; different extension, different
trade-offs — revisit on demand), server implementations (the contract
documents the stream; each stack brings its own SSE plumbing), and
client-side reconnection logic beyond what EventSource + the extension
already do.

## 2. Why this shape (alignment with HC principles)

| HC principle | How the SSE recipes honour it |
| --- | --- |
| htmx owns the network | The extension owns the `EventSource`; the bridge behavior never connects, never reconnects, never parses the stream — it only listens to `htmx:sseBeforeMessage`. |
| Markup as wire contract | `data-sse-connect` / `data-sse-swap` declare the stream and the event names in HTML; the server sends named events with HTML (or JSON for the bridge) as data. |
| State in HTML attributes | The event allowlist IS the markup: only events named in `data-sse-swap` ever reach the page. |
| Behaviors stay small | `installSseDispatch()` ≈ 60 lines: cancel the swap, `JSON.parse`, dispatch. |
| Progressive enhancement | The page renders complete server-side; SSE only freshens it. No `EventSource` → the page is simply not live. |
| Composition over invention | `sse-toast` reuses the toast contract's `detail` shape verbatim; region invalidation reuses data-region's existing domain-event contract. |

## 3. What already exists (reused, not built)

- **htmx SSE extension 2.2.3** (BSD, ~2.8 KB min) — verified against
  source: `data-sse-*` attribute variants are in `getSelectors()`;
  `htmx:sseBeforeMessage` is **cancelable** (preventDefault skips the
  swap); swaps go through the standard `api.swap` pipeline (so
  `hx-swap-oob` fragments inside event data are processed); native
  EventSource reconnect + extension backoff on error;
  `sse-close="<event>"` ends the stream; `htmx:sseOpen/sseError/sseClose`
  lifecycle events. Note: the extension's default factory opens
  `EventSource(url, { withCredentials: true })`.
- **Vendoring precedent** — `examples/htmx/vendor/htmx.min.js` (pinned
  2.0.4); test server and examples alias it.
- **`toast` contract** — `hc:toast` is already documented as
  server-triggerable (`HX-Trigger`) *and* client-dispatchable with a
  stable `detail` shape (`message`, `title`, `variant`, `duration`,
  `id`, `action`). The SSE payload reuses that shape unchanged.
- **`data-region` contract** — regions refetch on domain events
  dispatched on `body`; a bridged SSE event is exactly such an event.
- **Test infra** — serve.mjs mock routes + the generic dist-module
  fallback (#280), real-htmx spec pattern, vendored htmx served at
  `/htmx.min.js`.

## 4. Gap analysis (what is actually new)

1. **`installSseDispatch()`** — new `src/js/sse-dispatch.js` (§6).
2. **Vendored `sse.min.js`** in `examples/htmx/vendor/` + aliases in
   the three static servers (examples ×2 have the generic fallback for
   core dist only, so the vendor alias is explicit like htmx.min.js).
3. **Recipes** `recipes/sse-updates/` and `recipes/sse-toast/`.
4. **Docs** — a "Server-sent events" section in the htmx integration
   guide (loading the extension, connection lifecycle, CSP note) and
   the two recipe pages.
5. **Tests** — jsdom unit tests for the bridge (no EventSource needed:
   synthetic `htmx:sseBeforeMessage` events) and a real-htmx +
   real-EventSource browser spec against a streaming mock route.

## 5. Wire contract (the recipes' core)

### Stream

```text
GET /events        (Accept: text/event-stream; EventSource sends cookies —
                    the extension connects withCredentials)
retry: 5000

event: products:row
data: <tr class="hc-datagrid__row">…</tr>

event: hc:toast
data: {"message":"Build finished","variant":"success"}

event: items:changed
data: {}
```

### Client markup — `sse-updates`

```html
<div data-hx-ext="sse" data-sse-connect="/events">
  <section id="activity" class="hc-data-region"
           data-sse-swap="activity:item"
           data-hx-swap="afterbegin">
    …server-rendered initial items…
  </section>
</div>
```

- One `data-sse-connect` scope per stream; `data-sse-swap="<event>"`
  elements receive that event's data as a fragment, honouring the
  element's `data-hx-swap` (`innerHTML` default, `afterbegin` for
  feeds, etc.).
- **Out-of-band variant**: a message's data may contain
  `hx-swap-oob="true"` fragments — one SSE event updates several
  targets (status line + badge + row), same as the pager/bulk OOB
  contract.
- **Datagrid composition**: `data-sse-swap` on the
  `.hc-datagrid__body` tbody with `data-hx-swap="innerHTML"` — the
  same keep-the-tbody rule as datagrid-pager; the grid's observer
  re-applies roles/offsets and re-emits selection (#280).
- Lifecycle: reconnection is native (`retry:` hint respected) plus the
  extension's backoff; `data-sse-close="<event>"` lets the server end
  the stream deliberately ("stream done").

### Client markup — `sse-toast` (the bridge)

```html
<div data-hx-ext="sse" data-sse-connect="/events">
  <span hidden data-hc-sse-dispatch
        data-sse-swap="hc:toast, items:changed"></span>
</div>
```

The bridge element never renders anything. For each SSE event named in
its `data-sse-swap`, `installSseDispatch()` cancels the swap and
re-dispatches the event **into the DOM** as a bubbling `CustomEvent`
named after the SSE event, with the JSON-parsed data as `detail`:

- `event: hc:toast` + toast-shaped JSON → the existing toast behavior
  shows it (`role="status"` / `role="alert"` per variant — unchanged
  contract).
- `event: items:changed` + `{}` → any `data-region` listening for
  `items:changed from:body` refetches. Server pushes invalidation, the
  region pulls the re-render — cache-friendly and idempotent.

**Allowlist property:** only event names the page itself declares in
`data-sse-swap` can ever become DOM events — the server cannot invent
new event names client-side. Payload rules: empty data → `{}`; a JSON
**object** → used as `detail` verbatim; anything else (arrays,
primitives, malformed JSON) → the message is dropped (still cancelled,
nothing dispatched). Strict and predictable.

### Degradation

The page is server-rendered complete; SSE only freshens it. Without JS
(or without the extension) nothing breaks — content is simply as fresh
as the last full render. Recipes state this and recommend rendering
current state into the initial HTML rather than "loading…" shells.

## 6. Behavior design (`src/js/sse-dispatch.js`)

`installSseDispatch(root = document)` — idempotent, returns an
uninstaller; registered in `behaviors.js` auto-init; exported from
`index.js`; added to `bundle-js.mjs` FILES (the test server needs no
alias since #280's generic fallback).

- One delegated `htmx:sseBeforeMessage` listener on the root.
- If `event.target.closest('[data-hc-sse-dispatch]')` matches (the
  swap target IS the bridge element): `event.preventDefault()` —
  always, so the bridge never swaps raw data into the DOM.
- Read the SSE event name and payload from the extension's event
  (`event.detail` carries the underlying MessageEvent: `.type` = SSE
  event name, `.data` = payload string).
- Parse per §5 rules; on success dispatch
  `new CustomEvent(name, { bubbles: true, detail })` from the bridge
  element (bubbles to `body` — matching both toast's and data-region's
  listeners).
- No network, no EventSource, no state. Uninstall removes the listener.

## 7. Public API surface (VERSIONING)

All additive → **patch**:

- New export `installSseDispatch`; new attribute
  `data-hc-sse-dispatch`.
- New recipe contracts `recipes/sse-updates/`, `recipes/sse-toast/`.
- No new events (dispatched names are server/app-defined and
  page-allow-listed; `hc:toast`'s shape is already public), no new CSS,
  no new i18n keys, no deprecations.
- The vendored extension is a pinned dev/example asset, not part of
  the published package.

## 8. PR split (sequential, each off fresh `origin/main`; no stacking)

### PR 1 — `feat(behaviors): SSE→DOM event bridge (installSseDispatch)`

- [ ] `src/js/sse-dispatch.js` + `behaviors.js` + `index.js` +
      `bundle-js.mjs` FILES.
- [ ] `test/sse-dispatch.test.mjs` — synthetic cancelable
      `htmx:sseBeforeMessage` events: cancels + dispatches parsed
      detail; empty data → `{}`; malformed/non-object → cancelled but
      not dispatched; non-bridge targets untouched; idempotent;
      uninstall.
- [ ] Docs: "Server-sent events" section in
      `integrations/htmx.mdx` (extension setup + lifecycle + the
      bridge) and the behavior row in the htmx-events table.
- [ ] CHANGELOG (Unreleased / Added); update this plan's Status line.

### PR 2 — `docs(recipes): bless SSE live updates and server-push toasts` (after PR 1)

- [ ] Vendor `examples/htmx/vendor/sse.min.js` (htmx-ext-sse 2.2.3,
      pinned) + `/sse.min.js` aliases in `examples/htmx/server.mjs`,
      `examples/plain-html/serve.mjs`, `packages/core/test-browser/serve.mjs`;
      note it in `examples/htmx/README.md` + the htmx example page.
- [ ] `recipes/sse-updates/` + `recipes/sse-toast/`
      (recipe/expanded/contract, `Purpose:` lines) + `recipes/README.md`
      index rows.
- [ ] Docs pages `recipes/sse-updates.mdx`, `recipes/sse-toast.mdx`.
- [ ] Browser test: `/mock/sse` streaming route in serve.mjs
      (scenario-scripted, deterministic), fixture, and
      `test-browser/sse.spec.mjs` — fragment swap arrives; `afterbegin`
      feed grows; **OOB fragment updates a second target** (pins the
      §3 assumption); `hc:toast` appears via the bridge;
      `items:changed` refetches a live data-region; malformed payload
      dispatches nothing; axe scan.
- [ ] CHANGELOG; update this plan's Status line to shipped.

## 9. Test plan

Unit (jsdom, no EventSource): PR 1 list above.

Browser (real htmx + real EventSource + streaming mock):

1. Connect → named fragment event swaps into the region (and the
   `afterbegin` feed prepends).
2. One event whose data contains an `hx-swap-oob` fragment updates
   both the region and an out-of-band status target.
3. `hc:toast` SSE event → toast appears with the pushed message; the
   bridge element stays empty.
4. `items:changed` SSE event → a data-region refetches from the mock
   and re-renders.
5. Malformed JSON on a bridged event → no toast, no crash, bridge
   still works for the next event.
6. Axe scan with the live region updated and a toast visible.

## 10. Risks / notes

- **OOB inside SSE swaps** is read from the extension source, not its
  docs — pinned by browser test §9.2 before the contract blesses it.
- **Streaming through the mock server**: Node `http` supports
  incremental writes natively; the route must disable buffering
  (`Content-Type: text/event-stream`, `Cache-Control: no-store`,
  flush per event) and end deliberately (`sse-close` scenario) so
  Playwright teardown doesn't hang on an open socket.
- **`withCredentials: true`** (extension default) is a note in the
  contract: cookies ride along; CORS streams need
  `Access-Control-Allow-Credentials`. Same-origin recipes are
  unaffected.
- **jsdom has no EventSource** — unit tests stay synthetic by design;
  everything EventSource-real lives in the browser spec.
- The dispatched-event allowlist (§5) is the security stance: the
  server cannot mint arbitrary DOM event names; payloads are inert
  data (`CustomEvent.detail`), never markup, never eval.

## 11. Recipe DoD mapping (v0.4 plan §17.4)

For each of the two recipes: 1. basic HTML — recipe.html. 2. htmx —
`data-hx-ext` / `data-sse-*` throughout. 3. `data-hc-*` behavior —
`data-hc-sse-dispatch` (sse-toast). 4. macro — none (allowed).
5. expanded HTML. 6. server contract — the stream format (§5).
7. progressive enhancement — complete initial render, SSE freshens.
8. accessibility — toast roles per variant; live regions update
without focus theft; axe in the spec. 9. tests — §9.
