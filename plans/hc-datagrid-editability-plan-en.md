# datagrid-editability — telling the three cell states apart

Status: **plan approved 2026-08-09 — implementation PRs follow, one theme
per PR, sequential (no stacking).**

A user looking at a business grid needs to know three things about a
cell before touching it: **can I edit this**, **must it have a value**,
and **is it locked**. Today the grid answers none of them.

- `data-editable` has **no visual affordance** — an editable cell is
  pixel-identical to a read-only one until you double-click it.
- **Required-ness lives in the editor `<template>`** (the `required`
  attribute that gates the commit since #495), so the user discovers it
  only after typing and pressing Enter.
- The behavior applies `role="gridcell"` but never `aria-readonly` or
  `aria-required`, so assistive tech is told nothing either — even
  though ARIA supports **both** on `gridcell`.

Row-state-dependent editability (unshipped rows editable, shipped rows
locked) is the normal case in business apps, and it is where this
architecture should shine: the rule stays on the server and arrives as
per-cell markup, instead of a client-evaluated column callback that
needs the business rule shipped to the browser.

## 1. Themes

### 1.1 Derived ARIA (feat)

Nothing new for authors to write — the states are **derived from what
already exists**:

| State | Non-visual channel | Derived from |
| --- | --- | --- |
| editable + required | `aria-required="true"` | the column editor template's control carrying `required` |
| editable + optional | neither attribute | `data-editable` + a matching template |
| not editable | `aria-readonly="true"` | the absence of `data-editable` |

Rules that keep it honest:

- **Per-cell explicit wins.** A server-rendered `aria-required` /
  `aria-readonly` on the cell is never overwritten — conditional
  requiredness ("required only when status = X") is a server rule.
- **Whole-grid read-only is expressed once.** When no cell is
  editable, put `aria-readonly="true"` on the **grid**, not on every
  cell — per-cell noise for a uniform fact helps nobody.
- Re-derivation happens in `rebuild()`, so a swapped row (state change,
  SSE update, pager) gets the right ARIA for free.

### 1.2 Affordance: mark the exception, not the rule (feat)

Which of "editable" and "read-only" is the exception differs per app,
so both directions ship as **opt-in on the grid**, plus a discovery
affordance that costs nothing at rest:

- `data-hc-editable-hint="editable"` — mark the editable cells (for
  mostly read-only grids);
- `data-hc-editable-hint="readonly"` — sink the read-only cells (muted,
  for mostly editable grids);
- **hover / focus affordance by default** on editable cells (cursor +
  a subtle inset border) — discoverable exactly when the user is
  looking at the cell, invisible otherwise. No permanent per-cell
  noise at 200 rows.

Required-ness placement follows uniformity, and the **server decides**
because only it knows:

- **uniform for the column** → a header marker (`*` + an accessible
  "(required)" text, print-safe, said once);
- **varies by row** → the cell carries it. Per-cell markers are
  justified here: correctness beats quiet.

Colour is never the only channel (existing rule); the header marker is
text, and the cell state is exposed through ARIA regardless.

### 1.3 The mid-edit swap defect (fix)

Found while reasoning about row-state changes, confirmed in the source:
`editingCell` is cleared only by `endEdit()`. A row replaced **while
its editor is open** (SSE update, another user's change, a pager
refresh) leaves `editingCell` pointing at a detached node — and
`onKeydown` starts with `if (editingCell) return`, so **the grid's
keyboard navigation stops responding** until an edit is started and
finished again. `commitEdit()` on that detached cell would also write
into nothing and dispatch from outside the document.

Fix: when the observer rebuilds, if the editing cell is no longer in
the document, drop the editing state (clear the flag and the stashed
value) so navigation resumes. The user's uncommitted text is gone
either way — the row was replaced — so say so: the behavior emits
nothing, but the docs tell apps to pair remote row updates with the
edit-conflict contract if silent loss is unacceptable.

Regression test: open an editor, swap the row, assert arrows move
again.

## 2. Public API surface (additive → patch)

- Attributes read: `aria-required` / `aria-readonly` (server override).
- Attributes written by the behavior: `aria-required`, `aria-readonly`
  (cell or grid).
- New authored attribute: `data-hc-editable-hint` (`editable` |
  `readonly`) on the grid.
- CSS: `[data-editable]` hover/focus affordance; the two hint modes;
  a header `*` marker convention (documented, not a new class).
- No new exports, events or tokens.

## 3. PR split (sequential, no stacking)

1. `chore(plans)`: this document.
2. `feat(datagrid)`: derived ARIA + the affordance modes (§1.1, §1.2)
   — behavior + CSS + docs (en/ja) + unit/browser tests.
3. `fix(datagrid)`: the mid-edit swap defect (§1.3) + regression test.

## 4. Risks / notes

- **Do not announce every read-only cell in a read-only grid** — the
  grid-level expression exists precisely to avoid that.
- The derived `aria-required` must not fight a server-rendered one;
  the precedence rule is part of the contract, not an implementation
  detail.
- The hover affordance must not imply editability on a locked row —
  it keys off `data-editable`, so a server that stops rendering the
  attribute stops the affordance in the same breath.
- "Required but empty" is a *row error*, not a column property: it
  belongs to the server's `data-tone` / `data-invalid` vocabulary from
  the edit-feedback plan, and this theme does not invent a second way
  to say it.
