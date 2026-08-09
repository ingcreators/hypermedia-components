# datagrid-tree — server response contract

Purpose: hierarchy as lazy hypermedia inside hc-datagrid — rows carry `aria-level`, an expandable row fires `hc:datagridtreeload` once on first expand, and the server answers the child `<tr>` batch inserted right after it (`afterend`).

## Required client markup

- Every body row carries **`aria-level`** (roots = `1`). A row with
  children carries **`aria-expanded`** (`"false"` to start collapsed)
  and a `data-hc-datagrid-tree` toggle in its lead cell
  (`aria-hidden` + `tabindex="-1"` — the ROW announces the state;
  `installDatagrid()` upgrades the table to `role="treegrid"`).
- A **lazy** expandable row also carries `data-lazy` and the htmx
  wiring: `data-hx-get` (its children URL),
  `data-hx-trigger="hc:datagridtreeload"`, and
  `data-hx-swap="afterend"` — the behavior dispatches the event once
  (then marks `data-loaded`); htmx does the fetch.
- Collapse / re-expand of loaded subtrees is client-side visibility —
  no request, no state on the server.

## Children — `GET /items/:id/children`

| Case | Response (200) |
| --- | --- |
| children exist | the child `<tr class="hc-datagrid__row">` batch, each **one level deeper** (`aria-level="n+1"`); a child with its own children carries its own toggle + `aria-expanded` (+ lazy wiring); leaf rows carry `aria-level` only |
| empty | one empty-state row — a single `colspan` cell at `aria-level="n+1"` with polite text (e.g. "No entries") — **never** an empty body: the arriving row is also what clears the parent's `aria-busy` |
| unknown id | `404` — htmx leaves the grid untouched; surface it via the standard error toast (`HX-Trigger`) |

## Tree rules

- The batch is inserted after the PARENT row (`afterend`), so deeper
  levels must arrive **already ordered** — the server renders the
  subtree's direct children only; grandchildren load from their own
  parents.
- `aria-level` is the wire format of the hierarchy — the behavior walks
  it for collapse/expand and indents levels 2–4
  (`--hc-datagrid-indent`).
- Re-sorting / re-filtering / paging re-render the whole grid fragment
  — loaded subtrees are gone by design (the server decides which nodes
  exist on the new page).
- Expanding emits **`hc:datagridtreetoggle`** `{ row, expanded }`
  after the visibility change (and after the load event on first
  expand).

## Progressive enhancement (no JS)

Render the tree pre-expanded to a sensible depth (the rows are plain
`<tr>`s — `aria-level` costs nothing), or link the lead cell to a
drill-down page (`/items/docs`) — the hierarchy is navigable as pages
without any script.

## Accessibility

- `installDatagrid()` sets `role="treegrid"` when tree toggles exist —
  the role under which row-level `aria-level` / `aria-expanded` are
  valid and announced.
- The lead-cell toggle stays `aria-hidden` (mouse affordance only);
  keyboard users toggle with <kbd>Enter</kbd> on the lead cell, and the
  row's state is what assistive tech reads.
- The empty-state row keeps the grid honest — "nothing here" is
  rendered, not implied by silence.

## Notes

- This is the [lazy-tree](../lazy-tree/) recipe, table-shaped — same
  one-request-per-node economics, same server-owned hierarchy.
- Pair with [datagrid-filter](../datagrid-filter/) /
  [saved-views](../saved-views/): a filtered tree is the server's
  render choice (it may flatten to matches + ancestors).
