# Datagrid state clarity — layering, attention, zebra, confirmable warnings

Status: **approved** (2026-08-09). Four PRs, in the order below.

Follow-up to the datagrid enrichment / edit-feedback / bulk-errors /
editability work (PRs #487–#513). Those shipped the *states*; this plan
fixes what happens when several of them land on the same cell at once,
and adds the one edit outcome the contract still lacks.

## The defect

Every datagrid state paints the **same property** — a
`background-image` gradient on the cell (the technique that keeps
frozen columns opaque). They therefore never compose: exactly one
rule wins, and today the winner is decided by an accidental mix of
specificity and source order.

| Rule | Line (pre-fix) | Specificity |
| --- | --- | --- |
| `.hc-datagrid__body > .hc-datagrid__row:hover > .hc-datagrid__cell` | 261 | 0,4,0 |
| `.hc-datagrid__row[aria-selected="true"] > .hc-datagrid__cell` | 268 | 0,3,0 |
| `.hc-datagrid__row[data-tone="…"] > .hc-datagrid__cell` | 329 | 0,3,0 |
| `.hc-datagrid__row:target > .hc-datagrid__cell` | 343 | 0,3,0 |
| `[data-in-range]` / `[data-highlight]` / `[data-pending]` / `[data-invalid]` | 277–652 | 0,2,0 |

Three user-visible consequences:

1. **Hover erases everything.** Moving the pointer over a failed row
   hides the failure tint.
2. **Selection erases a rejected cell.** `aria-selected` (0,3,0) beats
   `[data-invalid]` (0,2,0); the 2 px outline and corner flag survive,
   but both are drawn in `status.error.border` (`red.100`) — invisible
   against the row.
3. **A toned row cannot show that it is selected.** Row-level
   `data-tone` ties with selection on specificity and comes *later*, so
   it wins. The user selects failed rows to retry them and gets no
   feedback that anything is selected. This is the worst of the three.

## The model: two channels

The fix is not a re-ordering. It is a separation.

**Background channel** — one tint, mutually exclusive, priority
ordered. Everything that is *decoration or transient interaction*
lives here: zebra, conditional formatting (`data-tone`), hover,
range, selection, fragment landing.

**Attention channel** — never a background. Everything that means
*this row/cell needs you and must not be lost*: the rejected-cell
outline and corner flag, the row edge bar, the pending spinner. Drawn
with outlines, `box-shadow: inset` and pseudo-elements, so no
background tint can overwrite it and no layout is disturbed.

A selected failed row then reads as **both**: selection tint on the
background, error bar and flag on top.

### Priority ladder (background channel)

Bottom to top; the later assignment wins:

1. `[data-alt]` — zebra (PR-3)
2. `[data-tone]` — server-evaluated conditional formatting of the value
3. `:hover`
4. `[data-pending]`
5. `[data-in-range]`
6. `[aria-selected="true"]`
7. `:target` — fragment landing

Selection outranks conditional formatting because selection is the
state the user is actively manipulating; formatting describes the data,
which is still legible through the tint.

### Making the order authoritative

One paint rule, fed by one custom property:

```css
.hc-datagrid__cell {
  background-color: var(--hc-datagrid-bg);        /* opaque base */
  background-image: linear-gradient(
    var(--hc-datagrid-cell-tint, transparent),
    var(--hc-datagrid-cell-tint, transparent)
  );
}
```

Each state only **assigns** `--hc-datagrid-cell-tint`, and every
assignment is specificity-normalised to `(0,1,0)` with `:where()`:

```css
:where(.hc-datagrid__body > .hc-datagrid__row:hover) > .hc-datagrid__cell { … }
:where(.hc-datagrid__row[aria-selected="true"]) > .hc-datagrid__cell     { … }
.hc-datagrid__cell:where([data-in-range])                                { … }
```

With specificity equal across the ladder, **source order alone**
decides, so the ladder above is readable straight from the file.

Nested cascade layers were considered and rejected: rules sitting
directly in `@layer hc.components` outrank any layer nested inside it,
so the rest of `hc-datagrid.css` would silently beat the ladder.
`:where()` has no such trap and needs no restructuring.

### Vocabulary

| Attribute | Channel | Means |
| --- | --- | --- |
| `data-tone="info\|success\|warning\|error"` | background | the **value** is notable (conditional formatting) |
| `data-attention="error\|warning"` (**new**, row / cell / head cell) | attention | this row needs the user; survives every tint |
| `data-invalid` (existing, cell) | attention | the server **rejected** this cell; implies error attention |

`data-invalid` keeps its current meaning and markup. `data-attention`
is the row-level and warning-capable form, which `data-invalid` alone
could not express — `aria-invalid` would be a lie for a row that is
merely awaiting confirmation (PR-4).

Bulk-failure rows move from `data-tone="error"` to
`data-attention="error"`, which is exactly what frees the background
for the selection tint in defect 3.

---

## PR-1 — state layering + attention channel + column identification

Closes the three defects above, plus the follow-up the user raised
during the bulk-errors review: *inside a failed row, which column is at
fault is not identifiable.*

**CSS (`hc-datagrid.css`)**

- Rewrite the state block as the ladder above (`--hc-datagrid-cell-tint`
  + `:where()`), with the priority list as a comment. Same tints, same
  tokens — no visual change for a cell in a single state.
- Attention channel:
  - Row bar: `.hc-datagrid__row[data-attention="error"] >
    .hc-datagrid__cell:first-child { box-shadow: inset 3px 0 0 0 … }`,
    sign-flipped under `:dir(rtl)`. `box-shadow: inset` is used rather
    than a `::before` because group rows already own
    `:first-child::before`, and rather than a border because a border
    would move the column edge.
  - Rejected cell: raise the outline and corner flag from
    `status.error.border` (`red.100`) to the new
    `--hc-datagrid-attention-error-bg` (`status.error.fg`, `red.800`) so
    they read on any tint.
  - Head cell: `data-attention` on a `.hc-datagrid__headcell` draws a
    block-end bar, so the offending column is findable when the failed
    row is scrolled away.
- New tokens `datagrid.attention-error-bg` → `{semantic.color.status.error.fg}`
  and `datagrid.attention-warning-bg` → `{semantic.color.status.warning.fg}`.
- `hc.a11y.css`: forced-colors fallback for `data-attention`
  (solid `Highlight` inset bar; the existing dotted/dashed vocabulary
  for tone / target stays distinct).

**Behavior (`datagrid.js`)**

- `focusHashRow()` also resolves a **cell** id (`#cell-101-ship-date`),
  making it the active cell. `setActive()` already does
  `scrollIntoView({ inline: 'nearest' })`, so an off-screen column is
  brought into view — this is what makes a report link land on the
  column, not just the row.
- `rebuild()` leaves `data-attention` untouched (server-owned, like
  `data-tone`).

**Contract / docs**

- `datagrid-bulk-errors` and `datagrid-edit-errors`: the failure message
  **names the column**, and the report links to the cell id where the
  failure is column-specific. Failed rows use `data-attention="error"`;
  the "mark an arbitrary cell" fallback is dropped.
- `components/datagrid.mdx` (+ ja): new "State layering" section — the
  two channels, the ladder, the vocabulary table, and the trap
  (*don't add a background to `<tr>`; the cells are opaque*).

**Tests**

- Vitest: cell-id hash navigation; `data-attention` preserved across
  rebuild.
- Browser: compose selection × attention × hover on one row and assert
  *both* the selection tint (computed `background-image`) and the bar
  (computed `box-shadow` ≠ `none`); axe.
- VRT: a state-matrix fixture (every combination in the ladder).

## PR-2 — a partial failure leaves the retry set selected

`apps/docs/demo-api/recipes/datagrid-bulk-errors.mjs` re-renders the
best-effort result without `checked`, so a partial failure clears the
selection: the actions bar disappears and the user must re-select the
failed rows by hand to retry.

- Failed rows come back `checked`; succeeded rows come back unchecked.
  Re-pressing the action then retries exactly the failures.
- Rows that failed for a non-retryable reason (permission, wrong state)
  stay unchecked — re-submitting them would only reproduce the error.
  The report says so.
- Contract documents the rule; `checks.json` asserts it. Demo-api
  Vitest covers partial failure → selection state.

## PR-3 — zebra striping

Opt-in `data-hc-zebra` on the grid.

- `rebuild()` assigns `data-alt` over **visible** rows. `:nth-child()`
  counts collapsed rows and mis-stripes after a group collapse, and
  cannot alternate per *record* `<tbody>` at all.
- Records alternate as a unit (all rows of one record share the stripe),
  which is what makes grouped data readable.
- New token `datagrid.row-alt-bg`; frozen columns get the stripe through
  the same ladder (the tint sits over `frozen-bg`, so they stay opaque).
- Bottom of the ladder: hover, selection and attention all remain
  visible over a striped row.
- Docs section including the `<tr>` trap; VRT screenshot with
  collapse + frozen columns.

## PR-4 — confirmable warnings in inline editing

The edit contract has three outcomes (accepted / `422` rejected /
`409` conflict) and lacks a fourth that business apps need: the value is
**acceptable but unusual**, and only the server knows it needs
confirmation — a ship date in the future, a discount above policy, a
quantity beyond the usual range.

This cannot be a client-side confirm (`installConfirm` gates operations
known to be destructive *before* sending); the rule is discovered by
the server mid-flight.

**Wire contract** — `PATCH /items/:id` gains one branch:

| Outcome | Response |
| --- | --- |
| accepted | `200` + record (committed) |
| **needs confirmation** | **`200`** + record in a confirm-pending state |
| rejected | `422` + record + error row (existing) |
| conflict | `409` + record (existing) |

`200` is correct: nothing failed and nothing was rejected — the server
is continuing the conversation. It also needs no `htmx:beforeSwap`
allowance.

**Confirm-pending state**

- The edited cell shows the **proposed** value (the user cannot confirm
  what they cannot see) carrying `data-pending` — it is genuinely
  unresolved — and the row carries `data-attention="warning"`.
- A warning row directly below states the reason and offers
  〔Confirm〕 / 〔Cancel〕. Cancel re-renders the record with the stored
  value; nothing else changes.
- The confirm request carries a **single-use token bound to (row,
  column, value, version)**. Without that binding, a confirmation
  obtained for one value could commit a different one, and the `409`
  version guard would be bypassed.
- The warning row sits outside the navigation matrix (like
  `__error-row` / `__detail-row`), so its buttons keep their natural tab
  order — `installDatagrid()` only sets `tabindex="-1"` on widgets
  inside matrix cells. `role="alert"` announces without stealing focus.

**Bulk operations already cover this**: the pre-flight branch
("18 can proceed, 2 cannot") is the same shape as "18 will ship with a
future date — proceed?". No new bulk work.

**Deliverables**: `datagrid-edit-errors` contract + recipe gain the
branch, docs-site demo endpoint implements it, `components/datagrid.mdx`
documents the confirm-pending state (+ ja twins), Vitest + browser specs
for confirm and cancel round-trips.

## Out of scope

- Client-side validation rules in the behavior. The server stays the
  authority; the behavior only renders what it is told.
- A modal confirmation variant. `hc-dialog` + `confirm-action` already
  covers that; inline keeps the row context and scales when several rows
  warn at once.
