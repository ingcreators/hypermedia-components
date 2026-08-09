# datagrid-edit-errors — server response contract

Purpose: the 422 wire for datagrid inline editing — the optimistic commit's feedback loop. Each row is its own record `<tbody>` (the swap unit), so a rejection re-renders row + error message atomically and the next success removes the error just as atomically.

## Required client markup

- **One `<tbody class="hc-datagrid__record">` per row** with a stable
  id — the swap unit. It carries the persistence wiring:
  `data-hx-patch` (the row URL),
  `data-hx-trigger="hc:datagridedit"` (the tbody hears only its own
  descendants’ bubbled edits — scoping is free),
  `data-hx-vals="js:{ col: event.detail.col, value: event.detail.value }"`,
  `data-hx-swap="outerHTML"`.
- The grid wrapper opts into the saving state with
  **`data-hc-datagrid-pending`** — the commit marks the cell
  `data-pending` + `aria-busy` until this contract's re-render
  replaces it.
- Allow 422 swaps once, globally (the
  [field-errors](../field-errors/) allowance):

```js
document.body.addEventListener('htmx:beforeSwap', (event) => {
  if (event.detail.xhr.status === 422) {
    event.detail.shouldSwap = true;
    event.detail.isError = false;
  }
});
```

- Strict-CSP alternative to `js:` vals: mirror `col`/`value` into
  hidden inputs from a small listener, or persist whole rows with
  `data-hx-include="closest tbody"` — the response contract is
  identical either way.

## Persist — `PATCH /items/:id` (`col`, `value`)

| Case | Response |
| --- | --- |
| accepted | `200` + the record `<tbody>` re-rendered — the row alone, the cell showing the **server's formatting** of the accepted value (`data-value` updated). This confirms the optimistic commit, clears `data-pending`, and atomically removes any previous error row |
| rejected | **`422`** + the record `<tbody>` re-rendered — the cell back on the **server's current value**, marked `data-invalid` + `aria-invalid="true"` + `aria-describedby="<error id>"`, followed inside the same record by `<tr class="hc-datagrid__error-row"><td class="hc-datagrid__error" colspan="…"><span role="alert" id="<error id>">…</span></td></tr>` — the message **names the rejected input** so nothing typed is silently lost |
| **needs confirmation** | **`200`** + the record `<tbody>` re-rendered in the *confirm-pending* state — see below. Nothing is committed |
| unknown column / row | `404` — nothing swaps; the standard `HX-Trigger` toast covers it |

Cancel needs one more route: **`GET /items/:id`** → the stored record,
exactly as it was. Nothing was written, so there is nothing to undo.

## Confirmable warnings

Some values are **acceptable but unusual**: a ship date in the future,
a discount above policy, a quantity ten times the usual. They are not
errors — `422` would be a lie — and only the server knows the rule, so
a client-side confirm (`installConfirm`) cannot express it: the rule is
discovered *on the way in*, after the user has already committed.

`200` is the honest answer. Nothing failed and nothing was rejected;
the server is continuing the conversation. It also needs no
`htmx:beforeSwap` allowance.

The confirm-pending record:

- the edited cell shows the **proposed** value — the user cannot
  confirm what they cannot see — marked `data-attention="warning"` and
  pointing at the message with `aria-describedby`;
- the record carries `data-attention="warning"`, so the row reads as
  needing the user whatever tint is painted over it;
- **not** `data-pending`: nothing is in flight. That state means
  "waiting for the server" and draws a spinner; here the server is
  waiting for the *user*;
- a message row directly below (the `__error-row` slot with
  `data-tone="warning"` on its cell) carries `role="alert"` on an inner
  element, plus **Confirm** and **Cancel**.

```html
<tr class="hc-datagrid__error-row">
  <td class="hc-datagrid__error" data-tone="warning" colspan="3">
    <span role="alert" id="r7-note">2027-01-01 is in the future. Confirm to ship Chai on that date.</span>
    <button class="hc-button" data-variant="primary" type="button"
            data-hx-patch="/items/7"
            data-hx-vals='{"col":"ship","value":"2027-01-01","confirm":"9f2c1a"}'
            data-hx-target="closest tbody" data-hx-swap="outerHTML">Confirm</button>
    <button class="hc-button" type="button"
            data-hx-get="/items/7"
            data-hx-target="closest tbody" data-hx-swap="outerHTML">Cancel</button>
  </td>
</tr>
```

**Bind the token to the value.** `confirm` is a single-use token issued
for one `(row, column, value)` — and in a versioned store, one
`version` too. Without that binding, a confirmation obtained for one
value could commit a different one, and the `409` version guard is
bypassed by replay. A server that only checks `confirm=1` has built a
confused-deputy, not a confirmation.

The buttons are `data-hx-vals` with **static JSON**, not `js:` — the
value being confirmed is pinned at render time, so it cannot drift, and
it stays CSP-safe.

The message row is not a `__row`, so it sits outside the navigation
matrix and its buttons keep their natural tab order (the behavior only
takes widgets inside matrix cells out of it).

## Rules

- **The record tbody is the atom.** Row and error row always travel
  together — no OOB bookkeeping, no stale error rows, stateless
  server.
- The cell always shows a value the server vouches for. The rejected
  input lives in the error message (and the user can press
  <kbd>Enter</kbd> to re-edit); the editor is **not** reopened
  automatically.
- `role="alert"` sits on an **inner element** of the error cell (the
  cell itself is a `gridcell` — the behavior applies the roles), so
  the message announces without stealing focus; keyboard navigation
  skips the error row entirely.
- Multi-cell rows repeat the same contract per column — `col` in the
  payload says which cell is being judged.
- **A warning is not an error.** Do not fold the confirmable branch
  into `422`: the user's value is fine, and a rejection tells them to
  change something that needs no changing. Do not fold it into a
  success either — a silent commit of an unusual value is exactly what
  the confirmation exists to prevent.
- **Bulk operations already have this shape.** The
  [datagrid-bulk-errors](../datagrid-bulk-errors/) pre-flight ("18 can
  proceed, 2 cannot") is the same conversation for many rows at once;
  no separate mechanism is needed.

## Progressive enhancement (no JS)

Inline cell editing is itself a JavaScript enhancement; the no-JS path
is the [inline-edit](../inline-edit/) recipe's page-level form (or a
row edit page). The grid renders and reads fine without any script.

## Accessibility

- The error announces via `role="alert"`; the rejected cell is
  programmatically linked (`aria-invalid` + `aria-describedby`).
- The saving state is `aria-busy` on the cell, not a blocked UI — the
  rest of the grid stays operable.
- Focus survives the swap: the active-cell slot is re-clamped after
  the record re-render, so <kbd>Enter</kbd> re-edits without a mouse
  trip.

## Notes

- Pair with the datagrid's native constraint validation (`required` /
  `pattern` on the editor template) — the client gate catches format
  errors before the wire; this contract owns everything only the
  server can know.
- Version conflicts (409) are the
  [datagrid-edit-conflict](../datagrid-edit-conflict/) recipe.
- Network death / 500 stay with the standard error toast — this
  contract covers the *addressed* rejection.
