# datagrid-edit-conflict — server response contract

Purpose: the 409 wire for datagrid inline editing — optimistic locking per row. A stale version re-renders the record as a conflict presentation (theirs in the cells, yours in the message, overwrite/discard actions); the row is the merge UI.

## Required client markup

- The [datagrid-edit-errors](../datagrid-edit-errors/) record layout,
  with **`data-version`** on each record tbody and the version included
  in the PATCH:
  `data-hx-vals="js:{ col: event.detail.col, value: event.detail.value, version: event.target.closest('tbody').dataset.version }"`
  (`hc:datagridedit` bubbles from the edited cell, so `event.target`
  resolves the record).
- Allow 409 swaps with the same one-time `htmx:beforeSwap` allowance
  the [field-errors](../field-errors/) contract documents for 422 —
  add `409` to the status list.

## Persist — `PATCH /items/:id` (`col`, `value`, `version`)

| Case | Response |
| --- | --- |
| version matches, value accepted | `200` + the record re-rendered — the row alone, server formatting, **incremented `data-version`** |
| version matches, value rejected | `422` — exactly the [datagrid-edit-errors](../datagrid-edit-errors/) branch (keep the current `data-version`) |
| **stale version** | **`409`** + the record re-rendered as the **conflict presentation** (below) |
| unknown row / column | `404` — nothing swaps; the standard error toast covers it |

### The 409 conflict presentation

The record tbody, containing:

- the row with **the server's current values** in the cells and
  `data-attention="error"` on the `<tr>` — what the user sees is always
  vouched for by the server;
- the **fresh `data-version`** on the tbody — the next ordinary edit
  is already un-stale;
- a conflict `__error-row` whose `role="alert"` message names **both
  values** ("another user saved *theirs* … your value: *yours*") and
  carries two actions:
  - **Overwrite** — a button re-submitting *your* value against the
    fresh version: static
    `data-hx-vals='{"col":"…","value":"<yours>","version":"<fresh>"}'`
    (server-rendered — no `js:` needed), `data-hx-patch` to the same
    URL, `data-hx-target="closest tbody"`, `outerHTML`. It goes
    through this same contract — a second conflict just re-presents
    with newer values;
  - **Discard** — a button `data-hx-get`-ting the row URL
    (`closest tbody` / `outerHTML`): the cells already show theirs,
    so this simply clears the conflict presentation.

## Read — `GET /items/:id`

`200` + the record re-rendered plain (current values, current
`data-version`) — the Discard target, also useful as a row refresh.

## Rules

- **The row is the merge UI.** No client-side diffing, no modal: the
  grid keeps scrolling, the conflict is exactly one record tall, and
  every path out of it is one more round trip through this contract.
- Overwrite is **last-writer-wins by explicit consent** — the user has
  seen theirs before choosing. Field-level merges are a server render
  choice (present more columns in the conflict row), not a client
  feature.
- The version travels as an opaque string (a number, an ETag, a
  timestamp — the server's business).

## Progressive enhancement (no JS)

Optimistic locking degrades with the editing itself: the no-JS path is
the [edit-conflict](../edit-conflict/) recipe's full-form 409 page.

## Accessibility

- The conflict announces via `role="alert"`; both resolutions are real
  buttons inside the message cell, reachable with <kbd>Tab</kbd>.
- `data-attention="error"` marks the row visually **and** the message names
  the values — never color alone.
- After either resolution the record re-renders and the active-cell
  slot re-clamps; keyboard users continue in place.

## Notes

- This is the [edit-conflict](../edit-conflict/) recipe, grid-shaped —
  same 409 philosophy, one record instead of one form.
- Pair with [sse-updates](../sse-updates/) to *reduce* conflicts (rows
  refresh live), not to replace this contract — a race can always slip
  through.
