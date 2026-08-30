# datagrid-sort — server response contract

Purpose: the sort set as a control — a toolbar button that says what the current sort *is* and opens an ordered, reorderable list of keys (including keys on columns that are not on screen). Header clicks stay the fast path; the wire is unchanged (`?sort=-ship,order`), so a saved view captures the sort like any other condition.

## Why a control and not just headers

Header clicks are fast and stay. What they cannot do:

- **Shift-click for multi-sort is invisible.** Nobody discovers it.
- With thirty columns the sorted one is often **scrolled out of view**,
  so `aria-sort` and `data-sort-index` answer a question the user
  cannot see.
- A key on a **hidden column** has no header at all.
- **Re-ordering keys** means re-clicking headers in the right sequence.

So the sort set gets the same treatment the conditions got: one surface
that is both the read-out and the editor. The trigger's label *is* the
read-out — `Sort (2): Ship date ↓, Order ↑` — rendered by the server
from the applied set.

## Required client markup

- The **trigger** is a `<button popovertarget>` whose label names the
  applied set (count plus the keys in order). It is a real control, not
  a badge.
- The **list** is `[data-hc-sort-list="<param>"]` on a container that is
  also `[data-hc-sortable]`, so `installSortable()` reorders it with
  pointer **and** keyboard. **The order of the rows is the order of the
  keys** — nothing duplicates that state.
- Each **row** carries `data-hc-sort-key="<col>"` (plus
  `data-hc-sortable-id` for the reorder announcements), a
  `data-hc-sortable-handle` button, a **direction control named after
  its key** (`dir-<col>`), and a remove control.
- The **add control** is a `<select name="add">` listing every sortable
  column, *including ones the grid is not showing*.
- The **form** GETs the list URL (`data-hx-get`), targets the grid
  (`data-hx-target`), and **includes the filter form**
  (`data-hx-include="#filters"`) so applying a sort keeps the
  conditions.

## The wire

```text
?sort=-ship,order        ship date descending, then order ascending
```

Ordered, comma-separated, a leading `-` for descending — the same
format the grid's own header sorting mirrors into
`input[data-hc-datagrid-sort]`. One format, two surfaces.

`installSortList()` joins the ordered rows into that single param on the
`formdata` event (the hook htmx and a native submit both fire), in the
position the first direction control held — so the same sort serializes
identically whether or not the behavior ran, which is what lets a saved
view compare querystrings.

**Without JavaScript the per-key controls are the wire.** Form entries
arrive in DOM order, so a native submit sends:

```text
?dir-ship=desc&dir-order=asc
```

which carries the keys, their directions **and their order**. Servers
accept both shapes and canonicalise to `sort=`. That is why each row's
direction control is named after its key instead of sharing one name.

An **empty list sends no `sort` param at all** — no sort is not a sort,
and the server's default ordering returns.

## Endpoints

| Case | Response |
| --- | --- |
| `GET /orders?sort=-ship,order&<conditions>` | `200` + the grid fragment, sorted, with the header cells' `aria-sort` / `data-sort-index` matching the set — plus an OOB re-render of the sort trigger and panel |
| `GET /orders/sort?add=<col>` | `200` + the panel region (`#sort-keys`) with that key **appended** and the column gone from the add list |
| `GET /orders/sort?drop=<col>` | `200` + the panel region without that key, the column back in the add list |
| a key naming an unknown or unsortable column | **ignore that key**, keep the rest, and say so in the panel — never `500`, and never silently reorder by something else |
| no `sort` at all | the server's default ordering; the trigger says so (`Sort: default`) |

Add and remove are **server round trips** because the list of available
columns is the server's knowledge — it changes with permissions, with
the column set, and with the data. The client never invents a row.

## Header clicks and the panel never disagree

Both surfaces render from the same server-side sort set:

- A header click marks the instruction (`aria-sort` + `data-sort-index`)
  and mirrors the wire into `input[data-hc-datagrid-sort]`, then the
  request returns the sorted page **and** the re-rendered trigger/panel.
  Concretely: a hidden `input[data-hc-datagrid-sort]` **outside** the
  panel form (inside it, `installSortList`'s formdata value would fight
  it over the same param), and the grid itself carrying
  `data-hx-get` + `data-hx-trigger="hc:datagridsort"` +
  `data-hx-include` of that input. Without this pair a header click
  cycles `aria-sort` and sorts nothing.
- Applying from the panel returns the grid whose headers carry the
  matching `aria-sort` / `data-sort-index`.

Never render the panel from client state. If the two can drift, the
read-out is worthless.

## Sort belongs to the question, not to the page

A saved view captures the sort (see [saved-views](../saved-views/)),
because "overdue shipments, oldest first" is one question. Paging does
**not** change it, and a sort change **resets to page 1** — page 7 of a
different ordering is a different set of rows.

Sorting is the server's, on the whole result set — never on the page
that happens to be loaded. Client-side sort of one page reorders
forty rows out of five thousand and looks exactly like the real thing.
(The datagrid's `data-sortable="client"` opt-in exists for small,
fully-loaded tables; it is not this.)

## Stable ordering

Ties must break deterministically or paging repeats and drops rows: two
requests for page 2 of a set sorted only by a low-cardinality column can
return different rows. **Append the primary key** as the final,
invisible sort key server-side.

## Progressive enhancement (no JS)

The panel is a plain `<form method="get">`: Apply navigates, the per-key
direction controls carry the order, and remove is a submit button
(`name="drop" value="<col>"` + `formaction`). Reordering by drag needs
`installSortable()`, so offer a keyboard/no-JS path to the same result —
remove and re-add in the order wanted, or a per-row "move up" submit.
Header links (`?sort=…`) remain the zero-JS fast path.

## Accessibility

- The list is a real `<ul>`; each row's handle is a real `<button>` with
  an accessible name that includes the column
  ("Reorder Ship date") — it is the **keyboard** interface, not
  decoration: Space grabs, arrows move, Space drops, Escape cancels.
- Direction controls are labelled per key ("Ship date direction"), so
  the label is unambiguous when read out of context.
- Remove buttons name their key ("Remove Ship date from the sort").
- `installSortable()` announces committed reorders through the shared
  `role="status"` region (i18n keys `sortable.*`).
- The grid keeps `aria-sort` on the header cells — that is what a screen
  reader reads on the table itself.

## Notes

- The trigger label is the cheapest honest read-out there is; render the
  count *in the label* (`Sort (2)`), not as a badge nobody reads.
- Keep the panel's vocabulary the same as the filter panel's: one
  **Apply**, one Cancel.
- Two sorts of the same column (asc and desc at once) is a bug the
  server should reject rather than normalise silently.
