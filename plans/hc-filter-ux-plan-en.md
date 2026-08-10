# Filter UX — applied conditions, multi-value, sort, saved views

Status: **approved** (2026-08-10). Six PRs, in the order below.

A design review of how a business list screen expresses *what it is
showing*: the conditions currently applied, how they are edited, and how
a set of them is named, recalled and kept. The `data-grid-page`
template (#521, #522) built the frame; this plan is about the controls
above the grid.

## What already holds up

The wire is in better shape than the UI:

- **The querystring is the view.** `saved-views` stores a name and the
  filter pairs, applying is a plain `GET` link, and the apply response
  re-renders the filter form with its controls filled — so a saved view
  is never an opaque server blob. That is the right foundation and none
  of the work below changes it.
- **Multi-value is already the contract.** `datagrid-filter` serializes
  **repeated** `f-<col>` params (that is how its checkbox lists work).
- **Sort already has a querystring form**: `?sort=name,-price`, leading
  `-` for descending, order significant.

## What does not

| # | Finding | Why it matters |
| --- | --- | --- |
| 1 | Applied conditions have no component. `hc-chip` is documented as presentational ("a chip with a trailing remove control is the multicombobox tag's job") and `hc-chips` wraps | A condition bar is a single line that scrolls, and each chip is a control: open this condition, drop this condition |
| 2 | No way to edit one condition in place | Today the only entry point is the column's own filter popover — unreachable when the column is scrolled away, and absent entirely for conditions that aren't columns |
| 3 | Multi-value entry has no control | The wire takes repeats; nothing lets a user paste 200 codes out of a spreadsheet |
| 4 | Sort is not saved with a view | `saved-views` includes `#filters`' fields; sort arrives from the grid's own event wiring, so it is outside the form and outside the save |
| 5 | Our own sort wire format is stated two ways | The datagrid page says `?sort=name,-price`, then wires `{ sort: col, dir: direction }` — single-column only. A saved view needs the whole ordered set |
| 6 | Saved views have no **modified** state | Apply a view, change one condition, and nothing says you have diverged. The user either loses the tweak or believes they are looking at the saved view |
| 7 | Saving is save-as only | Same name answers `422 duplicate`, so iterating means delete-and-recreate, or "Overdue 2" |
| 8 | No default view | The daily-first-thing filter has to be re-applied every morning |
| 9 | The strip does not scale or order | Comfortable at five views, unusable at thirty |
| 10 | Applied conditions and saved views look identical | Both render as `hc-chips`, but one is a set of removable conditions and the other a list of named sets that apply on click |
| 11 | "Views are per user by definition" | Business teams share a department-standard view; silently editing a colleague's is an accident waiting to happen |

## Two rules the work follows

**What belongs in a saved view: what you would want tomorrow, not where
you were.**

| In | Out |
| --- | --- |
| filter conditions | page number |
| sort (ordered, multi-column) | row selection |
| column set / order / width | scroll position |
| page size, grouping | expanded rows |

Page number is the dangerous one: "page 7 of yesterday's data" means
nothing, and a shared link lands the recipient somewhere else entirely.

**A filter must never fail open.** If a condition cannot be resolved —
an expired condition-set id, an unknown saved view — answer `404` or
re-ask. Silently dropping it shows the user *more* data than they asked
for, which in a business app is a safety problem, not a cosmetic one.

---

## PR-1 — `hc-filterbar`: the applied-conditions bar

A new, small component. `hc-chip` stays presentational; this is the
interactive sibling, so the two read differently at a glance — which is
finding 10.

- `.hc-filterbar` — one line, `overflow-inline: auto`, never wraps.
  Chips are `flex-shrink: 0` so they keep their shape and the bar
  scrolls instead.
- `.hc-filterbar__chip` — a `<button popovertarget>`; opening it is how
  a condition is edited (finding 2). Parts: `__label` (the field),
  `__op` (the operator, quiet), `__value`.
- `.hc-filterbar__remove` — a real link (`href` = the same URL minus
  that `f-<col>`), so dropping a condition works without JavaScript and
  is a normal history entry.
- `.hc-filterbar__clear` — drop everything; pinned to the trailing edge
  so it does not scroll away.
- Multi-value chips summarise: **"Buyer code: 3 values"**, never three
  chips and never a 200-character one (PR-3).
- Tokens `filterbar.*`; forced-colors fallback; the bar is a real list
  so it announces as "list, N items", and each remove control names its
  condition ("Remove Buyer code filter") rather than being a bare ×.

Not in scope: putting the bar *inside* a search input. That is the
multicombobox tag-input pattern and it fights click-to-edit — the bar
sits next to the search control, not inside it.

## PR-2 — `datagrid-filter`: the applied-conditions contract

The server owns what the bar says, because only it knows the labels, the
operators and how many values a condition holds.

- Response gains the bar fragment alongside the grid: one chip per
  applied condition, each with its editor popover pre-filled, each with
  a remove href.
- The chip's editor submits the same `f-<col>` shape the column popover
  already uses, so there is one filter wire, two entry points.
- Empty result: the response offers to relax the newest condition. The
  bar is right there, so the offer is a link that drops it.
- `checks.json` gains the rules; docs get the round trip end to end.

## PR-3 — multi-value conditions

- `installMultiValue()` / `data-hc-multi="lines"` on a `<textarea>`:
  each non-empty line becomes its own entry on the **`formdata` event**
  — the hook `installFormat()` already uses, so htmx's
  `new FormData(form)` and a native submit both go through it. The
  server also accepts the newline-joined single value, which keeps the
  no-JS path honest.
- The contract states the ceiling plainly: repeats are fine into the
  low hundreds; beyond that a querystring stops fitting through
  proxies and servers (~2 KB in the wild, 8 KB typical default).
- The escape hatch is a **condition-set resource**: `POST` the list
  once, filter with `?buyer-set=<id>`. The id lives in the querystring,
  so sharing, bookmarking and saved views keep working. An expired or
  unknown id **must not fail open** (see the rule above).
- When to use which control — textarea for pasteable, open-ended sets;
  `hc-multicombobox` for a small known set with suggestions.

## PR-4 — sort travels with the view

- `installDatagrid()` mirrors the committed sort set into a hidden
  `name="sort"` input **before** dispatching `hc:datagridsort` — exactly
  what `datagrid-prefs` already does for column widths. One line of
  markup then makes sort part of the filter form, so it survives an
  Apply *and* is saved with a view for free.
- Unify the wire format on `?sort=name,-price` (ordered, multi-column)
  and fix the single-column `{ sort, dir }` example that contradicts it
  (finding 5).
- Additive: grids that do not render the hidden input are unaffected.

## PR-5 — saved views, revised

- **Modified state** (finding 6): the server compares the incoming
  querystring with the stored one and renders the current view as
  modified, offering **Update**, **Save as new** and **Reset to saved**.
- **Update in place** (7): `PUT /views/<name>`. `422 duplicate` stays,
  but only for a genuinely new name that collides.
- **Default view** (8): a default flag; the bare list URL answers `303`
  to the default view's URL, so the address bar always shows the real
  conditions — a default must never be a hidden filter. A one-click
  "show everything" sits in the bar.
- **Scale and order** (9): pinned and recently-used first, the rest
  behind a menu.
- **Scope** (11): the contract stops asserting per-user. The server owns
  scope; the strip labels shared views, and editing one is a distinct,
  visible action.
- **What a view captures** (the rule above) is written into the
  contract, page number explicitly excluded.

## PR-6 — the template adopts all of it

`templates/data-grid-page` swaps its illustrative chips for the real
bar, adds the multi-value condition, shows sort travelling with the
view, and demonstrates the modified/update/default flow. The wiring map
gains the new rows.

## Out of scope

- A query builder (nested AND/OR groups). Business screens want a flat
  set of conditions; nesting is a different product.
- Client-side filtering. The server stays the schema and the filter.
