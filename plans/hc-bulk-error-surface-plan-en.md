# Where a bulk-error report goes on a full-height list screen

Status: **approved** (2026-08-12). Follows the
[list screen controls plan](hc-list-screen-controls-plan-en.md) and the
[full-height template](../apps/docs/src/content/docs/templates/data-grid-page.mdx).

## The defect

The data-grid page template fixes the chrome and gives the grid
whatever height is left. The `datagrid-bulk-errors` recipe puts its
report **in that chrome**, above the grid — and the report's height
grows with the number of distinct failure reasons.

So a bulk action that fails in fifteen different ways pushes the grid
to zero height on a laptop. The screen answers "what went wrong" by
hiding the thing the answer is about. Worse, this happens exactly when
the user most needs the grid: the rows named in the report are the ones
they have to go and fix.

The recipe already caps *rows per reason*. What nothing caps is the
**number of reasons**, and no cap on a chrome region is the right fix
anyway.

## The rule

> **The chrome is O(1). Anything whose height grows with the data lives
> in the scrolling area, or in an overlay — never in the chrome.**

The chrome is the part that must stay put for the grid to be usable:
title, conditions, toolbar, pager. Its job is to be a constant. A
region that grows with the answer belongs where growth is already
handled — the scrollport — or out of the layout entirely.

This is the same rule the template already states for the grid
(`min-block-size: 0` on the chain); it just was never applied to the
one region that is server-filled with unbounded content.

## What replaces it

Three surfaces, chosen by what the user has to *do* next — not by how
much text there is.

### 1. Best-effort: a one-line summary, and the rows carry the truth

Some rows changed, some did not. The work is in the grid, so the report
should not compete with it:

```html
<div id="bulk-report" aria-live="polite">
  <div class="hc-alert" data-variant="warning">
    <p class="hc-alert__body">
      <strong>12 of 40 rows could not be updated.</strong>
      <a href="/orders?f-last-result=failed">Show only failed</a> ·
      <button class="hc-button" data-size="sm" type="button"
              popovertarget="bulk-detail">Review reasons</button>
    </p>
  </div>
</div>
```

**One line, whatever N is.** The detail is one interaction away, and
the failing rows already say so themselves — `data-attention="error"`
plus their message row, which scrolls with the data because it *is*
the data.

**"Show only failed" is the important one.** It turns the grid into the
report: a real filter URL (`?f-last-result=failed`) that composes with
the conditions bar, export, and saved views, and retrying is then the
ordinary select-all → action loop. At two hundred failures this is the
only shape that works, and it needs no new component.

### 2. The reason list opens in a drawer

When the user wants the grouped breakdown, it opens as an `hc-drawer`
— a side panel takes **horizontal** space, which the layout has, rather
than vertical space, which it does not. The report keeps its shape
(grouped by reason, capped rows per reason, full-list link); only its
home changes.

The drawer is modal (that is what `hc-drawer` is), which is acceptable
because the actions inside it are *navigational*: filter to the failed
rows, download the full list, close. A drawer whose links require the
grid behind it stays wrong — so those links **filter** rather than
scroll.

### 3. Atomic: a modal dialog is correct

Nothing was applied. There is no work in the grid to go and do, and the
user owes the system a decision: run the executable subset, or cancel.
Blocking is honest, and the pre-flight already answers exactly this
fragment:

```text
18 of 20 rows are executable · 2 blocked (by reason)
[ Apply to the 18 ]  [ Cancel ]
```

The same is true of the `409` count-changed refusal: it is a decision,
not a work list.

## One surface, and it is docked — not modal

Standardising on **one** place for "what went wrong" is right: operators
rotate, and a surface that moves depending on the failure mode is
learned twice. The catch is modality.

`hc-drawer` today is `showModal()` only — backdrop, focus trap, the grid
inert behind it. For a best-effort failure that reproduces the original
defect in a different axis: the panel points at rows the user cannot
reach without dismissing the panel.

So the common surface is a **docked side panel**: the same drawer
language, laid out *in* the page rather than over it.

```html
<div class="hc-splitter" data-orientation="horizontal">
  <div class="hc-splitter__panel"><!-- the grid --></div>
  <div class="hc-splitter__handle" role="separator" tabindex="0"
       aria-label="Resize the error panel"></div>
  <div class="hc-splitter__panel" id="bulk-report"><!-- the report --></div>
</div>
```

- The grid loses **width**, which this layout has, not height, which it
  does not — and it keeps its own scrollport, so the report can be as
  long as it likes.
- Both are live at once: click a reason, the rows behind it filter or
  focus, and the user watches it happen. That is the whole job.
- `installSplitter()` already ships the handle, the ARIA and the
  keyboard resize; the panel collapses when there is nothing to report.
- Below the shell's breakpoint the split stacks and the panel becomes
  an overlay — on a phone there is no width to give.

**The modal stays for atomic only**, where blocking *is* the message:
nothing was applied, and the user owes a decision before anything can
happen. Two surfaces, chosen by one question — "is there work in the
grid?" — not by taste.

## Rows get a number, and the number is a locator

A business grid is discussed out loud and over the phone: "row 137 is
the one that failed". Today the screen has no such handle — only the
record id, which is right for the system and wrong for the sentence.

Add an ordinal column, with two rules that keep it honest:

- **The ordinal is a locator; the id is the identity.** Ordinals change
  the moment the sort or the conditions change, so a report that *names*
  an ordinal goes stale between rendering and reading. The report names
  the id and *displays* the ordinal: `SO-4903 (row 137)`.
- **The ordinal counts the result set, not the page.** Row 12 of page 2
  is row 52; a number that restarts every page is worse than no number.

The standards mapping is exact, and the grid is already `role="grid"`:

```html
<table class="hc-datagrid__table" aria-rowcount="5000">
  …
  <tr class="hc-datagrid__row" id="row-4903" aria-rowindex="137">
    <th class="hc-datagrid__cell" data-row-no scope="row">137</th>
```

`aria-rowcount` / `aria-rowindex` are what a screen reader needs on a
**paged** grid — without them it announces "row 3 of 40" on page four,
which is a lie the kit has been telling. The visible column is the same
fact, rendered.

## Moving from error to error

With numbers on screen, the summary line becomes a navigator — and it
stays O(1) however many rows failed:

```html
<p class="hc-alert__body">
  <strong>12 of 40 rows could not be updated.</strong>
  <a class="hc-button" data-size="sm" href="#row-4903">Previous</a>
  <span>Error 3 of 12 — row 137</span>
  <a class="hc-button" data-size="sm" href="#row-5012">Next</a>
  · <a href="/orders?f-last-result=failed">Show only failed</a>
</p>
```

- They are **real `<a href="#row-<id>">` links**, so Back works, the
  keyboard works, and no JavaScript is required to move. `installDatagrid()`
  already lands the active cell on the row a fragment names
  (`focusHashRow()`), which is exactly the focus move being asked for.
- The counter and the two hrefs are **server-rendered** from the same
  failure list the report shows — no client state, and no drift between
  the panel and the line.
- A **Go to row** control (a number input submitting `?goto=137`)
  covers the "somebody read me a number" case; the server resolves the
  ordinal to the page and the anchor, because only it knows where row
  137 currently is.
- Failed rows already carry `data-attention="error"`, so the landing row
  is visibly the right one.

## The backstop

Rules get missed, and a server can always render something taller than
expected. So the region is **bounded in CSS as well**:

```css
#bulk-report {
  max-block-size: min(30vh, 16rem);
  overflow: auto;
}
```

A page that renders the old, full report still works — it scrolls
inside its own box instead of eating the grid. The template ships this,
and the contract requires an equivalent for any in-chrome region the
server fills.

## Work items

| # | Content |
| --- | --- |
| 1 | The rule in the template (`chrome is O(1)`), the bounded `#bulk-report` region, and the one-line summary + row marks in the demo |
| 2 | The **docked** report panel (`hc-splitter` beside the grid, collapsing when empty, overlaying below the breakpoint) — the common surface |
| 3 | `datagrid-bulk-errors`: two surfaces by semantics (docked panel for best-effort, modal for atomic), "show only failed" promoted to the primary affordance, and the height rule in *Required client markup* |
| 4 | Row ordinals: `aria-rowcount` / `aria-rowindex` on the paged grid + the optional `data-row-no` column, with the locator-vs-identity rule |
| 5 | Error-to-error navigation: server-rendered prev / next `#row-<id>` links + the counter in the summary line, and a **Go to row** control |
| 6 | A regression spec: with 15 reasons rendered, the grid still has usable height and the page itself does not scroll; the prev/next links move the active cell |

## Out of scope

- A new component. The splitter, drawer, alert, filterbar and datagrid
  states all exist; this is composition and a rule.
- Client-side ordinals. The server knows the sort, the conditions and
  the page; the browser knows forty rows out of five thousand.
- Client-side pagination of the report. The cap plus the full-list link
  already covers it.
- Changing the report's *content* contract (grouped by reason, capped,
  linked) — only where it is rendered.
