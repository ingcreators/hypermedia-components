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
| unknown column / row | `404` — nothing swaps; the standard `HX-Trigger` toast covers it |

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
