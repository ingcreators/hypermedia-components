# datagrid-edit-feedback — the missing half of inline editing

Status: **shipped in full 2026-08-09 — plan #500, cell edit lifecycle
states #501, datagrid-edit-errors #502 (two enabling core fixes rode
along: `hc:datagridedit` now dispatches from the edited CELL and
bubbles — it used to fire on the grid element, so per-record wiring
could never hear it; and the behavior now also observes the table's
children so record-tbody swaps rebuild roles/matrix/editing),
datagrid-edit-conflict #503. Note: htmx has no `from:this` extended
selector — the record tbody hears its own descendants' bubbles, so a
bare `data-hx-trigger="hc:datagridedit"` is both correct and scoped.**

Follow-up to the [datagrid-enrichment plan](hc-datagrid-enrichment-plan-en.md)
(#487–#499). Enrichment finished the *input* half of inline editing —
IME-safe activation, native constraint validation gating the commit —
but the *feedback* half is still unowned: today's commit is
**optimistic** (the cell shows the new value before the server has said
anything), and when the server answers 422 or 409 there is no blessed
cell state, no message slot, and no conflict presentation. Apps are
left to improvise the most delicate moment of the whole grid.

This plan closes that gap without moving an inch of doctrine: the
server stays the source of truth, htmx owns every request, and the
behavior only marks states and re-renders arrive as fragments.

## 0. The lifecycle being blessed

```
edit → native validation → commit (optimistic) → data-pending
                                     │
                     200: row re-render (server truth; pending gone)
                     422: row re-render — cell data-invalid +
                          error row with the message (pending gone)
                     409: row re-render — conflict presentation:
                          server's values + yours, resolve actions
```

The row `outerHTML` re-render is the load-bearing move in every branch:
it is what confirms, corrects, or contests the optimistic value — and
what clears `data-pending` for free.

## 1. Themes

### 1.1 Cell edit lifecycle states (feat)

- **`data-pending`** — set by `installDatagrid()` on the edited cell at
  commit time (value changed), together with `aria-busy="true"`.
  **Opt-in** via `data-hc-datagrid-pending` on the grid wrapper: the
  state only makes sense when the app wires persistence with the row
  re-render contract (without the opt-in, nothing would ever clear it).
  The tbody observer clears any leftover `[data-pending]` on mutation
  as a belt-and-braces (a row swap replaces the cell anyway). CSS: a
  subtle busy tint + inline spinner dot; forced-colors fallback.
- **`data-invalid`** — server-rendered on the rejected cell in the 422
  re-render, alongside `aria-invalid="true"` and `aria-describedby`
  pointing at the error row's message. CSS: error ring
  (`--hc-color-status-error-*`) + the tone-error tint; forced-colors
  outline.
- **`.hc-datagrid__error-row` / `.hc-datagrid__error`** — the message
  slot: a server-rendered `<tr>` directly under the row (one `colspan`
  cell, `role="alert"`, tone-error styling, small close affordance is
  the app's choice). Not a `.hc-datagrid__row`, so it stays out of the
  navigation matrix — exactly like `__detail-row`.
- No auto-reopen of the editor on `data-invalid` (predictable, no
  loops): the cell shows the **server's value**, the error row says
  what was wrong with the submitted one, and Enter re-edits. The
  rejected input is preserved in the error row's text (the contract
  renders it), so nothing the user typed is silently lost.

### 1.2 `datagrid-edit-errors` — the 422 wire (recipe, zero new JS)

Persistence wiring on the row:
`data-hx-patch="/items/:id" data-hx-trigger="hc:datagridedit"
data-hx-vals='js:{ col: event.detail.col, value: event.detail.value }'
data-hx-swap="outerHTML"` (the `js:` vals form is the component docs'
existing blessing; the contract notes the hidden-input alternative for
strict CSP).

| Case | Response |
| --- | --- |
| valid | `200` + the row `outerHTML` re-rendered with the server's formatting of the accepted value (confirms the optimistic commit; clears pending) |
| invalid | **`422`** + the row re-rendered with the **original server value** in the cell, `data-invalid` + `aria-invalid` + `aria-describedby` on it, followed by the `__error-row` naming the rejected input and the reason (the documented `beforeSwap` allowance swaps 422s, as field-errors does) |
| non-htmx | native fallback is the inline-edit recipe's page-level path |

### 1.3 `datagrid-edit-conflict` — the 409 wire (recipe, zero new JS)

Rows carry `data-version`; the PATCH includes it
(`js:{ …, version: event.target.closest('tr').dataset.version }`).

| Case | Response |
| --- | --- |
| version matches | as 1.2 (200 / 422) |
| stale version | **`409`** + the row re-rendered as a **conflict presentation**: the server's current values in the cells, `data-tone="error"` on the row, a conflict `__error-row` showing *your* submitted value next to *theirs*, and two actions — **上書き** (re-submit yours against the new `data-version`) and **破棄** (dismiss; the row already shows theirs) |

The overwrite button is a normal htmx PATCH with the fresh version —
one more round trip through the same contract, so a second conflict
just re-presents. No client merge UI; the row is the merge UI.

## 2. Public API surface (additive → patch)

- Attributes: `data-pending` (behavior-written), `data-invalid`
  (server-rendered), `data-hc-datagrid-pending` (grid opt-in),
  `data-version` (recipe convention).
- Classes: `.hc-datagrid__error-row`, `.hc-datagrid__error`.
- Events: none new (`hc:datagridedit` unchanged).
- Recipes: `datagrid-edit-errors`, `datagrid-edit-conflict`.
- Tokens: none (reuses `--hc-color-status-error-*` / tone tokens).

## 3. PR split (sequential, no stacking)

1. `chore(plans)`: this document.
2. `feat(datagrid)`: cell edit lifecycle states (§1.1) — CSS + behavior
   + a11y + docs (en/ja) + unit/browser tests.
3. `docs(recipes)`: bless datagrid-edit-errors (§1.2) — scaffolds +
   contract + demo-api + live demo + mocks + specs.
4. `docs(recipes)`: bless datagrid-edit-conflict (§1.3) — same shape.

## 4. Risks / notes

- **Pending must not strand**: opt-in + observer sweep; the docs say
  plainly that `data-hc-datagrid-pending` assumes the re-render
  contract.
- **422 swap allowance**: htmx skips swapping error statuses by
  default; the recipes carry the same documented `beforeSwap` snippet
  field-errors blessed.
- **Focus after the swap**: the active-cell slot survives a row
  `outerHTML` swap via the rebuild clamp; the error row is announced
  via `role="alert"` so focus does not need to move into it.
- **Toast stays for row-detached failures** (network death, 500):
  these recipes cover the *addressed* errors; the standard HX-Trigger
  toast remains the catch-all.
