# datagrid-enrichment — spreadsheet-grade interaction depth

Status: **plan approved 2026-08-09 — implementation PRs follow, one theme
per PR, sequential (no stacking).**

Follow-up to the business-app release (0.2.1): the datagrid now has an
*operations* layer (columns / views / import / infinite), but its
*interaction* layer still trails the spreadsheet-grade grids business
users compare it against — IME-hostile type-to-edit, no range
clipboard, no aggregate footer, no trailing freeze, single-column sort
only, no per-column filter entry point, no grouping/tree rows, no
conditional formatting hooks, no edit validation, no width/order
persistence. This plan closes those gaps **without** crossing the
standing doctrine: server-paged data, no client-side data layer,
behaviors never touch the network — every data operation is a
hypermedia round trip; the client only *renders, navigates and
instructs*.

## 0. Doctrine check (what stays out)

- **No virtual scroll / client data engine** — `datagrid-infinite` and
  `datagrid-pager` are the answers (v0.6 depth plan holds).
- **No client filter/group/aggregate computation** — the server
  renders group rows, footers and filtered pages; the client toggles
  visibility and issues requests.
- **No spreadsheet file export/print engine** — CSV stays
  `<a href="/items.csv?…">`; printing is `hc.print.css`.
- **No undo/redo stack** — the undo-delete tombstone pattern covers
  destructive flows.
- **No cell-merge engine** — native `rowspan`/`colspan` already
  navigate correctly.

## 1. Themes

### 1.1 IME-safe type-to-edit (fix)

`onKeydown` currently seeds the editor with `event.key` and calls
`preventDefault()` for any printable key — during CJK composition the
first keydown arrives with `isComposing === true` (or
`key === 'Process'`), so composition is swallowed and the cell gets a
raw latin seed. Fix: when `event.isComposing || event.key === 'Process'`,
open the editor **unseeded and without preventDefault**, focus the
input, and let the IME re-target composition into it. A
`compositionstart` listener on the grid covers engines that fire it
before any keydown reaches us. Unit-testable with synthesized
`keydown {isComposing: true}`.

### 1.2 Range selection + clipboard copy

Spreadsheet muscle memory, read-only, zero network:

- **Anchor + extend**: `Shift+Arrow` / `Shift+Click` extends a
  rectangular range from the active cell (the anchor); the visual
  matrix (already rowspan/colspan-aware) supplies the geometry. Cells
  in range get `data-in-range`; the range paints with the existing
  selected tint (gradient, frozen-safe). `Escape` clears.
- **Copy**: `Ctrl/Cmd+C` with a range (or none — active cell only)
  writes TSV (`\t` cells, `\n` rows, cell `textContent` trimmed;
  spanned cells contribute once, at their origin slot) via
  `navigator.clipboard.writeText`, then emits **`hc:datagridcopy`**
  `{text, rows, cols}` (cancelable → app substitutes richer payloads).
- **`Ctrl/Cmd+A`** in a grid with selection checkboxes checks every
  row on the page (the select-all path), not the browser's
  whole-document selection.

New attribute `data-in-range` (transient, behavior-owned), new event
`hc:datagridcopy`. No new tokens.

### 1.3 Freeze surfaces: sticky footer + trailing frozen columns

- **`.hc-datagrid__foot`** — a server-rendered `<tfoot>` pinned with
  `position: sticky; inset-block-end: 0`, opaque `head-bg`, top border
  + upward freeze shadow. Aggregates are computed by the server
  (page-level or query-level — the contract note says which, the cell
  says which via its text, e.g. "Σ page"). Multi-row footers stack the
  same way header levels do (measured `--hc-datagrid-foot-1-h`).
- **`data-frozen-end`** — the mirror of `data-frozen`:
  `inset-inline-end` sticky (RTL-aware for free via logical
  properties), measured cumulative `--hc-datagrid-right` per cell,
  `data-frozen-end-edge` carries the flipped freeze shadow. The
  classic use is the row-actions column. Corner cells (header ∩
  frozen-end) get the z-index-3 treatment the start side already has.

New CSS class `__foot`, new attributes `data-frozen-end`,
`data-frozen-end-edge`, new non-token knob `--hc-datagrid-right`
(behavior-written). Token additions: none (reuses `head-*`).

### 1.4 Multi-column sort

`Shift+Click` / `Shift+Enter` on a `data-sortable` header **adds** the
column to the sort set instead of replacing it; plain click still
resets to single-column. Each sorted header keeps `aria-sort` and
gains `data-sort-index="1…n"` (rendered as a small ordinal after the
arrow when n > 1). `hc:datagridsort` detail gains
`sorts: [{col, direction}]` (ordered); the existing `col`/`direction`
fields stay (first entry) — additive per VERSIONING.md. The server
contract convention is `?sort=name,-price` (leading `-` = desc),
documented in the datagrid-pager recipe note.

### 1.5 `datagrid-filter` — per-column filter entry (recipe, zero JS)

A filter button in the header cell opens a
[filter-popover](../recipes/filter-popover/) anchored to it; the form
GETs the grid URL with that column's params; the server re-renders
the grid fragment + the button marked `data-filtered` (a dot indicator
via CSS). Composes with saved-views (name the resulting querystring).

| Case | Response |
| --- | --- |
| apply | grid fragment re-rendered with the filter; the header button re-rendered with `data-filtered` and an `aria-label` naming the active filter |
| clear | grid fragment without the filter; button loses `data-filtered` |
| distinct-values list | the popover content is server-rendered (checkbox list / range / text — the server picks per column type) |

checks: popover form GETs the grid target (**error**); button carries
`aria-expanded` wiring per filter-popover (**error**, inherited).

### 1.6 Grouped rows (server-rendered, client-toggled)

The server interleaves **`.hc-datagrid__grouprow`** rows —
`<tr class="hc-datagrid__grouprow" data-group-level="1" aria-expanded="true">`
with one `colspan` cell holding the group label **and any aggregates
the server chose to render**. The behavior makes the row's toggle
focusable, and collapse simply `hidden`s every following row until the
next group row of the same-or-higher level (pure visibility — the rows
are already on the page; paging happens *within* the server's
rendering choice). Emits **`hc:datagridgrouptoggle`**
`{row, expanded}`. Keyboard nav skips hidden rows (the matrix already
rebuilds on mutation).

### 1.7 Tree rows + `datagrid-tree` recipe

Hierarchy as lazy hypermedia (the lazy-tree recipe, table-shaped):
rows carry `aria-level`; a lead-cell expander
(`data-hc-datagrid-toggle` + `data-tree` + `data-lazy`) triggers an
htmx GET that inserts the child `<tr aria-level="n+1">` batch after
the row (`afterend`). Collapse hides loaded descendants
(client-side, `hidden`); re-expand shows them without refetch
(`data-loaded`). Indent = `calc(level × indent)` on the lead cell.

| Case | Response |
| --- | --- |
| `GET /items/:id/children` | the child `<tr>` batch, each `aria-level` one deeper; children with children carry their own expander |
| leaf | no expander in the lead cell |
| empty children | an empty state row (one `colspan` cell, `aria-live` text) |

### 1.8 Conditional formatting: `data-tone`

`data-tone="success | warning | danger | info"` on `__cell` /
`__record` / `__row` (and on `.hc-table` cells) paints a tokenized
tint (gradient, frozen-safe) + optional stronger `-fg`. The *rules*
live on the server — it renders the attribute; the client renders the
color. Tokens: `datagrid.tone.<tone>.bg/fg` referencing the existing
status ramps, themed light/dark, forced-colors fallback in
`hc.a11y.css`.

### 1.9 Inline-edit validation

Editor templates may carry native constraints (`required`, `pattern`,
`min`, `max`, `maxlength`). On commit (Enter/blur), if
`!ctrl.checkValidity()` the behavior calls `reportValidity()`, keeps
the editor open, and does **not** emit `hc:datagridedit`; Escape still
cancels. Server-side rejection stays the inline-edit recipe's 422
contract. No new attributes — the constraints *are* the API.

### 1.10 Column prefs persistence (+ `datagrid-prefs` recipe)

- **Widths**: after a resize, the behavior mirrors the width into any
  `input[type="hidden"][data-hc-datagrid-width="<col>"]` inside the
  grid's wrapper form — declarative, no fetch; the autosave recipe (or
  a debounced `data-hx-trigger="hc:datagridcolumnresize from:body"`)
  persists it. The server renders remembered widths back as inline
  `--hc-datagrid-col-w` / `data-resized` (or simply `style` widths) —
  contract, not client state.
- **Order**: the datagrid-columns chooser list becomes an
  `installSortable()` list; the `cols=` repeated params carry the
  chosen *order* (the contract already says server order wins — this
  PR upgrades the contract: order = submission order).

Recipe `datagrid-prefs` documents both wires.

### 1.11 Small cuts

- **Auto-size**: double-click (or `Enter`) on a column resizer sets
  the column to its widest rendered cell (measurement only; emits the
  existing `hc:datagridcolumnresize`).
- **Client page sort (opt-in)**: `data-sortable="client"` sorts the
  *already-rendered* page rows in the DOM (string/`data-value`
  numeric compare) instead of emitting a server instruction —
  explicitly allowed by the v0.6 depth plan for small, fully-loaded
  tables. Default (bare `data-sortable`) stays server-instructed.

## 2. Public API surface (all additive → patch/minor)

- Attributes: `data-in-range`, `data-frozen-end`,
  `data-frozen-end-edge`, `data-sort-index`, `data-group-level`,
  `data-tree`, `data-tone`, `data-filtered`,
  `data-hc-datagrid-width`, `data-sortable="client"` value.
- Classes: `.hc-datagrid__foot`, `.hc-datagrid__grouprow`.
- Events: `hc:datagridcopy`, `hc:datagridgrouptoggle`; extended detail
  on `hc:datagridsort` (`sorts`).
- Custom properties: `--hc-datagrid-foot-1-h`, `--hc-datagrid-right`,
  `--hc-datagrid-indent`, `--hc-datagrid-tone-*` (token-backed).
- Recipes: `datagrid-filter`, `datagrid-tree`, `datagrid-prefs`.
- Exports: none new (all inside `installDatagrid()`); no macro.

## 3. PR split (sequential, no stacking)

1. `chore(plans)`: this document.
2. `fix(datagrid)`: IME-safe type-to-edit (§1.1).
3. `feat(datagrid)`: range selection + clipboard copy + Ctrl+A (§1.2).
4. `feat(datagrid)`: sticky footer + trailing frozen columns (§1.3).
5. `feat(datagrid)`: multi-column sort (§1.4).
6. `docs(recipes)`: bless datagrid-filter (§1.5).
7. `feat(datagrid)`: grouped rows (§1.6).
8. `feat(datagrid)`: tree rows + datagrid-tree recipe (§1.7).
9. `feat(css)`: `data-tone` conditional formatting (§1.8).
10. `feat(datagrid)`: inline-edit native validation (§1.9).
11. `feat(datagrid)`: column prefs persistence + datagrid-prefs (§1.10).
12. `feat(datagrid)`: auto-size + client page sort (§1.11).

Every feature PR: unit + browser specs, docs (en **and** `/ja/` twin —
the parity guard fires otherwise), CHANGELOG under Unreleased,
`hc validate` checks for recipe PRs. VRT: existing sheets must not
change; new visuals get demo coverage, not new baselines, unless a
sheet already shows the surface.

## 4. Risks / notes

- **IME**: engines disagree on whether `keydown` (isComposing) or
  `compositionstart` arrives first — handle both; the browser specs
  can only approximate composition, so the unit tests carry the
  matrix and a manual note goes in the docs' accessibility section.
- **Range × multi-row records**: ranges span *visual* rows; the
  matrix already models this — tests must cover a range crossing a
  `rowspan`.
- **Frozen-end × resize**: resizing a frozen-end column must
  re-measure `--hc-datagrid-right` for cells to its start side (the
  measure pass already re-runs on `hc:datagridcolumnresize`).
- **Group rows × selection**: select-all counts only real record rows
  (group rows carry no checkbox); the actions-bar count is unaffected.
- **Client page sort × htmx swaps**: a tbody `innerHTML` swap resets
  DOM order — that is correct (the server's order wins after any
  round trip); document it.
- **Sort-set reset**: applying a filter or view resets nothing
  client-side — `aria-sort` markers are server-rendered truth after
  every grid re-render (the pager recipe's OOB rules apply).
