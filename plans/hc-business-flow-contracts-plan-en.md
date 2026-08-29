# business-flow contracts — five wire contracts LOB apps keep reinventing

Status: **plan — PR 1 (this doc), then one recipe PR each, in order:
PR 2 `async-job`, PR 3 `line-items`, PR 4 `reference-lookup`,
PR 5 `workflow-actions`, PR 6 `idempotency-key`.**

Sequel to [`hc-result-cap-snapshot-plan-en.md`](hc-result-cap-snapshot-plan-en.md)
(2026-08-29): the same lens — *a place every business app must pass
through, whose server contract nobody writes down* — applied to the
remaining gaps in the 46-recipe set. All five are zero-new-JS,
zero-new-CSS contract recipes; every UI part they need
(`hc-progress`, `hc-dialog`, `hc-stepper`, `hc-badge`, `hc-alert`,
`hc-table`) already ships.

| Recipe | Concern | Closes a loop opened by |
| --- | --- | --- |
| `async-job` | 202 + job token + self-polling progress → terminal states | `result-cap`'s "export to CSV" escape hatch |
| `line-items` | header + N detail rows: add/remove/recalc as server round trips | `templates/data-entry` (flat forms only) |
| `reference-lookup` | code field + search-dialog picker over a master table | `postal-address` (lookup, but one-way), `remote-dialog` |
| `workflow-actions` | state-derived action buttons, transition POSTs, 409 on stale state | `datagrid-snapshot-pager` (the queue's detail-side twin) |
| `idempotency-key` | server-side duplicate-submit defence: token + response replay | `mutating-form` (client-side guard only) |

## 1. async-job

**Goal.** One contract for CSV export, PDF rendering, batch imports,
recalculation jobs — anything that outlives a request.

```html
<!-- Kick off -->
<form method="post" action="/exports">
  <button class="hc-button" data-hx-post="/exports"
          data-hx-target="#job" data-hx-swap="innerHTML"
          data-hx-disabled-elt="this">Export CSV</button>
</form>
<div id="job"></div>

<!-- 202 response: the job card polls ITSELF -->
<div class="hc-card" data-hc-job
     data-hx-get="/exports/j_8f3k" data-hx-trigger="every 2s"
     data-hx-target="this" data-hx-swap="outerHTML">
  <p>Preparing export… <progress class="hc-progress" max="100" value="40"></progress></p>
  <p aria-live="polite">40% — 12,000 / 30,000 rows</p>
</div>
```

Contract points:

- **Kick-off returns `202`** with the job fragment (htmx swaps 2xx;
  202 is still the honest status) carrying the job URL. The job id is
  an opaque token; re-GET is always safe.
- **Progress fragment replaces itself** (`data-hx-target="this"`,
  `outerHTML`) — the polling attribute set travels WITH the fragment,
  so reaching a terminal state stops polling simply by not including
  the trigger. No JS lifecycle management. (The self-swapping-trigger
  rule from the live-demo work applies: the terminal fragment must not
  echo `load`/`every` triggers.)
- **Terminal states are enumerated**: `done` (result link — a plain
  `<a download>`, since the artifact GET is idempotent), `failed`
  (reason + retry button re-POSTing the kick-off), `cancelled`. A
  cancel button POSTs `/exports/j_x/cancel`; cancel of a finished job
  is a no-op `200`, not an error.
- **Progress announces politely** (`aria-live="polite"` on the text,
  never on the whole card) and the poll interval honours
  `Retry-After` when the server sends one (documented as the server's
  throttle; htmx `every` stays the client floor).
- **An expired/unknown job id renders a tombstone card** ("This job
  has expired — start again"), `200`, mirroring the snapshot-pager
  tombstone stance: staleness is a state, not an error.
- SSE variant: point the card at an `sse-updates` stream instead of
  `every` — referenced, not specified.

## 2. line-items

**Goal.** The order/quote/invoice detail table: N editable rows inside
one form, where **the server owns arithmetic** (rounding is business
truth) and row structure changes are server round trips.

```html
<form method="post" action="/quotes/42/recalc" id="quote">
  <table class="hc-table" id="items">
    <!-- one row: -->
    <tr>
      <td><input class="hc-input" name="item" value="Widget"></td>
      <td><input class="hc-input" name="qty" value="3"
                 data-hx-post="/quotes/42/recalc" data-hx-trigger="change"
                 data-hx-target="#quote" data-hx-swap="outerHTML"></td>
      <td><input class="hc-input" name="price" value="1200" …same wiring…></td>
      <td data-cell="line-total">¥3,600</td>
      <td><button name="remove" value="2" …same wiring…>Remove</button></td>
    </tr>
  </table>
  <button name="add" value="1" …same wiring…>Add row</button>
  <p id="totals">Subtotal ¥… · Tax ¥… · Total ¥…</p>
</form>
```

Contract points:

- **Positional alignment by repeated names** (`item`/`qty`/`price`
  repeat per row; tree-order serialization aligns them — the
  guarantee `sortable` and `datagrid-snapshot-pager` already document).
  No `items[0].qty` index bookkeeping, so no renumbering problem.
- **Every mutation is the same request**: POST the whole form; the
  server re-renders the whole form (`outerHTML` swap of the form —
  the `transfer` recipe's whole-form-swap shape). `add`/`remove`
  arrive as the pressed button's name/value; a change event presses no
  button and just recalculates. One endpoint, four verbs, zero JS.
- **The server computes every derived number** — line totals,
  subtotal, tax, grand total. The client never does arithmetic; the
  response is the only calculator. Totals are in the re-rendered form,
  so no OOB is needed in the base shape.
- **Focus note**: a whole-form swap after `change` loses focus at tab
  time; the docs page shows the `data-hx-select`-narrowed variant
  (swap only `#totals` + the edited row's line-total) as the
  keyboard-friendly upgrade, and names its trade-off (two sources of
  truth per keystroke vs one per submit).
- **422** re-renders the form with `field-errors`-style row-scoped
  errors (`aria-invalid` on the bad input, message cell in the row).
- Draft persistence composes with `autosave`; dirty state with
  `unsaved-changes`; the printable quote with `hc.print.css`.

## 3. reference-lookup

**Goal.** The master-reference field (customer, item, cost centre —
SAP's F4): direct code entry for the users who know the code, a
search dialog for those who don't, and one truth for what the field
holds: an id + a display name.

```html
<div class="hc-field" data-hc-lookup>
  <label class="hc-field__label" for="customer-code">Customer</label>
  <div class="hc-input-group">
    <input class="hc-input" id="customer-code" name="customer_code"
           value="C-1041" data-hx-get="/customers/resolve"
           data-hx-trigger="change" data-hx-target="closest .hc-field"
           data-hx-swap="outerHTML">
    <button class="hc-button" type="button" aria-haspopup="dialog"
            data-hx-get="/customers/lookup"
            data-hx-target="#lookup-dialog" data-hx-swap="innerHTML">🔍</button>
  </div>
  <p class="hc-field__hint" data-lookup-name>Acme Trading K.K.</p>
  <input type="hidden" name="customer_id" value="cus_9f2">
</div>
<dialog class="hc-dialog" id="lookup-dialog"></dialog>
```

Contract points:

- **Two fields, one truth**: the visible `*_code` input (what users
  type/see) and the hidden `*_id` (what the form submits as identity —
  an opaque token, per the snapshot-pager rule). The display name is
  presentation, never submitted.
- **Direct entry validates on change**: GET `/resolve?code=…` returns
  the whole field re-rendered — resolved (name in the hint, id filled)
  or unresolved (`aria-invalid`, empty id, message per
  `field-errors`). **An unresolved code must clear the id** — the
  classic defect is a stale id riding under a corrected code.
- **The dialog is remote-dialog + live-search composed**, with one
  addition: each result row is a button whose click response
  re-renders the field `outerHTML` **out-of-band** and closes the
  dialog (`data-hc-close-dialog-on-success`). The dialog returns a
  fragment, never navigates.
- **Inactive/blocked master rows** render in results as
  non-selectable (`aria-disabled` + reason) — visible-but-refused
  beats silently missing, same stance as result-cap's banner.
- No-JS path: the field is a plain input; the server re-validates
  `*_code` on submit anyway (it must — the id is client-supplied),
  so JS-off degrades to submit-time validation. The 🔍 button is
  `type="button"` and simply inert without htmx.

## 4. workflow-actions

**Goal.** The document-detail twin of the approval queue: a record
with a lifecycle (`draft → submitted → approved / returned / withdrawn`),
where **the server renders only the legal transitions** and stale
actions collide loudly.

```html
<div id="doc-actions" data-hc-workflow>
  <input type="hidden" name="version" value="7" form="doc-form">
  <ol class="hc-stepper">…Draft → Submitted → <b aria-current="step">Approval</b> → Done…</ol>
  <div class="hc-toolbar" role="toolbar" aria-label="Actions">
    <button class="hc-button" data-variant="primary" name="transition" value="approve"
            form="doc-form" data-hx-post="/docs/42/transition" …>Approve</button>
    <button class="hc-button" name="transition" value="return"
            form="doc-form" data-hx-post="/docs/42/transition" …>Return</button>
  </div>
</div>
```

Contract points:

- **The action set IS the state, server-rendered.** No client-side
  role/state logic: a viewer gets no buttons, an approver on an
  approved doc gets none either. Hide what the user can never do;
  render `aria-disabled` + a reason for what they could do but not
  *now* (the two cases read differently and the contract says which
  is which).
- **One endpoint, `transition` verb + `version`.** An illegal or
  stale transition (someone else approved first) returns **409** with
  the re-rendered actions region — current state, current stepper,
  current buttons — plus a toast saying who won. The edit-conflict
  stance applied to state: never apply, never silently refresh.
- **Comment-required transitions** (return/reject) 422 into the
  region with the comment field marked required — the comment box is
  server-rendered only for transitions that need it.
- The stepper is presentation of the same truth (`aria-current="step"`),
  updated in the same swap — one region, one truth.
- Composes with `datagrid-snapshot-pager` (queue side),
  `confirm-action` (dangerous transitions), `idempotency-key`
  (approve double-click).

## 5. idempotency-key

**Goal.** Server-side duplicate-submit defence. `mutating-form`'s
`data-hx-disabled-elt` is a client courtesy; the wire contract is a
token: every rendered form carries one, and the server answers a
replayed token with **the original response, not an error**.

```html
<form method="post" action="/orders">
  <input type="hidden" name="idempotency_key" value="ik_7d1f…">
  …fields…
  <button class="hc-button" data-variant="primary"
          data-hx-post="/orders" data-hx-disabled-elt="this">Place order</button>
</form>
```

Contract points:

- **One key per rendered form** (fresh on every render, opaque,
  unguessable). The server stores `key → response` on first commit
  and **replays the stored response** for the same key — success,
  redirect, or 422 alike. A retry after a timeout, a double-click
  that slipped the client guard, and a `session-expiry` replay all
  become safe by the same mechanism.
- **Replay ≠ error.** Answering a duplicate with 409 punishes the
  user for the network; the contract's whole point is that the second
  answer is indistinguishable from the first.
- **Scope + TTL are the server's declared policy** (per form × user;
  hours, not forever) and the recipe documents the storage row
  (`key, user, request-hash, response, created_at`) plus the
  request-hash check: same key + *different* payload is a real
  conflict → `422`, because that's a bug, not a retry.
- 303-redirect composition: the stored "response" for the PRG pattern
  is the redirect — replaying it lands on the same receipt page,
  which is exactly the right UX for "did my order go through?".

## 6. Shared demo-API notes (stateless tricks, per recipe)

- `async-job`: the job token encodes its start timestamp; progress is
  a function of elapsed wall-clock (done ≈ 8 s; a `?fail=1` flavour
  token takes the failed branch). Cancel returns the cancelled card
  for any token.
- `line-items`: naturally stateless — the rows ARE the request.
- `reference-lookup`: a fixed in-module master list, like live-search.
- `workflow-actions`: state + version thread through hidden inputs
  (the bulk-actions demo's `state` trick); a "simulate someone else
  approving" button bumps the version so the next action 409s.
- `idempotency-key`: the first response OOB-writes a `receipt` hidden
  equal to the key; a resubmit carrying `receipt == key` renders the
  replayed-response branch. (A real server uses storage; the demo
  threads the "already seen" bit through the form.)

## 7. Deliverables per recipe PR

The standard kit (identical to the result-cap/snapshot PRs):
`recipes/<name>/` 4-files · demo API handler + registration + tests ·
`<Name>Demo.astro` live demo · docs page EN + ja twin · index rows
(`recipes/README.md`, docs recipe index EN + ja) · CHANGELOG Unreleased
entry. checks.json sketches:

- `async-job`: self-swap rule (`[data-hc-job][data-hx-trigger*="every"]`
  must target `this` / swap `outerHTML`, error); polite progress text
  exists (warn).
- `line-items`: mutation controls POST (error); server-owns-arithmetic
  is prose, not machine-checkable — the detect is the form, rules keep
  buttons `type=submit` with name/value (error).
- `reference-lookup`: hidden id input exists next to the code input
  (error); dialog trigger `aria-haspopup="dialog"` (warn); resolve
  wiring `data-hx-trigger="change"` (error).
- `workflow-actions`: version rides the transition form (error, the
  edit-conflict rule); toolbar is `role="toolbar"` labelled (warn).
- `idempotency-key`: the key input is hidden + non-empty (error —
  the edit-conflict `version-value` shape).

## 8. Out of scope

- No new behaviors/CSS/tokens anywhere in the five.
- `confirm-page`, `unread-badge`, `network-retry`, `audit-trail` —
  named in the gap analysis, deferred (the first is templates
  material, the last is a fundamentals guide).
- Real job queues, real idempotency storage, websocket transports —
  the contracts name the server obligations; infrastructure is the
  consumer's.
