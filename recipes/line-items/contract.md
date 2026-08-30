# line-items — server response contract

Purpose: edit an order/quote/invoice detail table — N rows in one form — where the server owns all arithmetic and every structural change (add, remove, recalculate) is the same whole-form round trip.

## Required client markup

- **One `<form method="post" action="…/recalc" data-hc-line-items>`**
  wrapping the items table, the totals, and the mutation buttons.
  `data-hc-line-items` is a **contract marker only** — no behavior
  attaches.
- **Rows align positionally by repeated names**: each row contributes
  one `item`, one `qty`, one `price` (extend with your columns).
  Tree-order serialization keeps the triples aligned — the same spec
  guarantee [sortable](../sortable/) and
  [datagrid-snapshot-pager](../datagrid-snapshot-pager/) rest on. No
  `items[0].qty` indexing, therefore no renumbering when rows come
  and go.
- **Every mutation is the same request.** All controls POST the whole
  form to one endpoint and swap the whole form back
  (`data-hx-target="#quote"`, **`outerHTML`**):
  - `qty` / `price` inputs: `data-hx-trigger="change"` — recalculate.
  - Add: `<button type="submit" name="add" value="1">`.
  - Remove: `<button type="submit" name="remove-row" value="<1-based row>">`.
  The pressed button's name/value is the verb; a change event presses
  no button. The native submit does the same with JS off.
  **Never name the button `remove`** (or any other form DOM API):
  named controls shadow the form's methods — `form.remove` becomes
  the button — and htmx calls `target.remove()` when it outerHTML-
  swaps the form, so the old form throws and stays in the page,
  duplicating the table on every action. What decides whether a
  shadowed name bites is who reads the property: `remove` (htmx
  swaps) and `elements` (this kit's format / mask / multi-value
  behaviors) are fatal; `action` / `method` are read only as content
  attributes by htmx and this kit (the bulk-action recipes'
  `name="action"` is safe) but shadow `form.action` for any script
  of your own.
- **The client never computes a number.** Line totals, subtotal, tax,
  grand total — all rendered by the server. Rounding is business
  truth and must have exactly one implementation.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| POST | `/quotes/42/recalc` | **200** + the whole form re-rendered (or **422**, below) |
| POST | `/quotes/42` (Save — the button's `formaction`) | validates like recalc → **422** same shape; success per [mutating-form](../mutating-form/) (redirect or success swap) |

## The request

```text
POST /quotes/42/recalc
item=Widget&qty=3&price=1200&item=Gasket&qty=5&price=800&add=1
```

Server steps: zip `item[i]`/`qty[i]`/`price[i]` positionally → apply
the verb (`add` appends an empty row; `remove-row=N` drops the Nth row;
neither = plain recalc) → validate → recompute → render the whole
form.

## Validation (422)

Numbers are validated **per field**; the response is the same
re-rendered form with:

- the bad **raw value echoed back** into the input (never silently
  coerced — the user must see what the server saw),
- `aria-invalid="true"` on the input and the message in the row
  (`hc-field__message`, the [field-errors](../field-errors/) look),
- totals rendered as **"—"** while any row is invalid — never a stale
  or partial number.

Status `422` (htmx ≥ 2 needs the standard one-line `beforeSwap`
allowance for 4xx fragments, as in mutating-form).

## Focus (the one real trade-off)

A whole-form `outerHTML` swap after `change` re-renders the input the
user just left — fine for mouse users, but a keyboard user tabbing to
the next field loses focus at swap time. Two positions:

1. **Base shape (this contract): accept it.** `change` fires on blur,
   the swap is fast, and one-source-of-truth beats focus preservation
   in most entry screens.
2. **Narrowed variant**: keep the same response but let the *inputs*
   swap only the derived cells out of it —
   `data-hx-select-oob="#totals"` (plus the row's line-total cell by
   id) instead of the whole-form target. Focus survives; the cost is
   ids on every derived cell and a response that must keep matching
   them. Reach for it when the screen is keyboard-heavy (and consider
   [datagrid-edit-errors](../datagrid-edit-errors/)' grid instead).

## Progressive enhancement

All mutation controls are native submits with name/value; without
htmx the form POSTs to `action` and the server renders the full page
with the same re-rendered form. Save's `formaction` keeps the two
endpoints honest with JS off.

## Accessibility

- Inputs carry `aria-label`s (the column headers label the columns,
  not the controls).
- Error messages live in the row, adjacent to the input they name,
  with `aria-invalid` on the input.
- The remove button names its row for screen readers when rows have
  identity ("Remove Widget"), or falls back to position.

## Notes

- **Drafts**: compose with [autosave](../autosave/) (POST the same
  form shape to a draft endpoint) and
  [unsaved-changes](../unsaved-changes/) for the dirty guard.
- **Reordering rows** is [sortable](../sortable/) applied to the
  `<tbody>` — moving a row moves its inputs, and the positional
  contract picks the new order up for free.
- **Currency/format**: render formatted numbers in *display* cells
  (line totals, footer) and raw editable values in inputs;
  [installFormat](../../packages/core/src/js/format.js) can prettify
  inputs without touching the wire values.
- **Concurrency**: a quote edited by two people wants
  [edit-conflict](../edit-conflict/)'s hidden `version` riding this
  same form.
