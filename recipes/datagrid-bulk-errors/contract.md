# datagrid-bulk-errors — server response contract

Purpose: bulk-action failures at scale. Makes the **execution semantics** explicit (best-effort vs atomic), reports failures **grouped by reason** instead of by toast, and links every named row back to the grid.

Builds on [datagrid-bulk-actions](../datagrid-bulk-actions/) — that
contract's form shape, id serialization, CSRF and no-JS rules apply
unchanged. This one adds what happens when things go wrong.

## Required client markup

- The datagrid-bulk-actions form (one `<form>` around the grid and the
  bar; `name="ids"` checkboxes; unnamed select-all).
- **Rows carry a stable `id`** (`row-<id>`) — the report links to them,
  and `installDatagrid()` moves the active cell to the landing row.
- A **summary region** above the grid:
  `<div id="bulk-report" aria-live="polite">`, filled by the response
  (out of band alongside the rows, or as the direct target for the
  pre-flight). **It is bounded** —
  `max-block-size: min(25vh, 12rem); overflow: auto` — because the
  chrome is what a full-height grid's height is subtracted from. See
  *Where the report goes* below; the bound is the backstop, not the
  design.
- Atomic actions additionally declare the **pre-flight**: a
  `type="button"` carrying `data-hx-get="…/preflight?action=…"`,
  `data-hx-include="closest form"` (the selected ids), targeting the
  report region.
- Allow the refusal status to swap, once, globally — the
  [field-errors](../field-errors/) allowance with `409` added.

## Choose the execution semantics

The server picks per action. The two branches are not interchangeable
and their copy is part of the contract.

| | **best-effort** | **atomic** |
| --- | --- | --- |
| Fits | independent items (archive, tag, notify) | invariants (postings, transfers, permissions) |
| Success | `200` + rows + report + `success` toast | `200` + rows + `success` toast |
| Failure | `200` + rows **reflecting what happened** + report + `warning` toast | **`409`** (state conflict) or **`422`** (input) + rows **unchanged** + report + `error` toast |
| Failed rows | marked `data-attention="error"`, reason via `aria-describedby` | **statuses unchanged**, but the blocked rows are marked the same way — see below |
| Copy | "113 succeeded / 87 failed" | "**Nothing was executed** (2 rows do not qualify)" |
| Selection | **the retry set stays selected** — re-render *retryable* failures `checked` | **preserved** — re-render the checkboxes `checked` |
| Recovery | press the action again (it now applies to the failures alone) | fix the blockers, or exclude them and re-run |

**Selection preservation is mandatory in the atomic branch.** The base
recipe's "the selection clears by construction" holds only when the
action ran. A refusal that also wipes 200 hand-picked rows is a data
loss the user cannot undo. The checkboxes *are* the selection truth, so
rendering them `checked` is the whole fix.

**Mark the blocked rows in the atomic branch too.** The rule used to
be "never mark in the atomic branch — nothing changed, so marking would
lie". What would lie is a claim that the row *failed*; the mark says
something else: **this row cannot proceed**. That is equally true
before the action runs (pre-flight), when it refuses (`409`), and after
it failed (best-effort) — because it is a fact about the **row**, not
about the attempt. It also does not go stale when the selection
changes: "already shipped" stays true whether or not the row is ticked.

Without it the report's row links land on a row that looks like every
other row, which wastes the one affordance the report has.

The pre-flight answers a report, not rows, so it carries the marks as
**out-of-band row updates** wrapped in `<template>` (the same escape as
below — a bare `<tr>` in a response targeting a `<div>` is dropped by
the parser). Render them `checked`: the user is about to act on that
selection.

What must still never happen in the atomic branch is a **status
change**. Nothing ran, so nothing is Posted, Archived or Deleted.

## Severity: what does the row need?

`data-attention` takes the severity from what the row requires, not
from when it was discovered — otherwise the same unchanged row is
`warning` before the button and `error` after it.

| Severity | Means | Examples |
| --- | --- | --- |
| `error` | **something must change** before this can proceed | required value missing, invalid input, wrong state ("already shipped"), not permitted |
| `warning` | **someone must decide**; the value itself is fine | a ship date in the future, a discount above policy — the [confirmable-warning](../datagrid-edit-errors/) branch |

So a required-field check is `error` wherever it surfaces, and a
pre-flight blocker is `error` too — it is not "not yet an error", it is
a row that cannot proceed.

**A partial failure must leave the retry set selected.** Re-rendering
every row unchecked is what "the selection clears by construction"
used to mean, and it is wrong the moment anything failed: the actions
bar disappears (it hides at zero), and the user has to hand-pick the
failures out of a full grid to try again — precisely the rows the
server already knows. Render **retryable** failures `checked` and the
retry is one press of the same button.

Retryable is the server's judgement, not the client's:

| Failure | Checked after? | Why |
| --- | --- | --- |
| transient (lock held, upstream timeout, rate limit) | **yes** | the same request can succeed |
| succeeded | no | nothing left to do |
| permanent (wrong state, not permitted, invalid data) | no | re-submitting reproduces the error; the fix is elsewhere |

Say so in the report when the two differ ("3 can be retried; 2 need a
change first") — otherwise a partially-checked grid reads as a bug.

## Acting on everything that matches

Ticking rows stops working before the data does. When 4,873 rows match,
the operation the user wants is "archive **all of them**" — and 4,873
ids fit in neither a querystring nor a form post, let alone through a
proxy.

So the action may be expressed as **the query itself**. The client sends
the conditions it is looking at instead of a list of ids:

```html
<form method="post" action="/products/bulk">
  <!-- The conditions currently applied, server-rendered. Exactly the
       ones the filter bar is showing. -->
  <input type="hidden" name="f-status" value="open">
  <input type="hidden" name="f-ship-from" value="@week-start">
  <input type="hidden" name="scope" value="matching">
  <input type="hidden" name="count-token" value="ct_9f2c1a">
  <button class="hc-button" type="submit" name="action" value="archive">
    Archive all 4,873 matching
  </button>
</form>
```

| Field | Meaning |
| --- | --- |
| `scope=matching` | act on the query, not on `ids` — the two are mutually exclusive, and a request carrying both is a client bug worth a `400` |
| the `f-*` params | the conditions, in exactly the form the list URL uses |
| `count-token` | pins the count the user was shown |

### The count is part of the confirmation

"Archive all matching" is not a safe thing to press blind, so the button
**says the number** and the server re-counts before executing. If the
count has moved — someone else's edit, a relative date that rolled over
at midnight — do not silently act on the new set:

| Case | Response |
| --- | --- |
| count matches the token | execute; report as usual |
| count has changed | **`409`** + the report saying the old and new counts, and a button carrying a fresh token |
| token missing or unknown | `409` — re-count and re-confirm; never fall back to acting on whatever matches now |

The token is what makes this honest. Without it "archive all 4,873"
executes against however many rows exist at execution time, which is a
different operation from the one the user agreed to.

### Everything else is unchanged

Pre-flight, best-effort vs atomic, the reason-grouped report and the
retry rules all apply as written — the only thing that changed is how
the set was named. A query-scoped run cannot mark individual rows
`checked` on the way back, so its report leans on the filter link
("filter to the failed rows") rather than on selection.

Two limits worth stating out loud: a query-scoped action must be
**re-authorised** like any other (the conditions may include something
the user may no longer read), and above some size it belongs in an
async job with progress rather than a synchronous POST — the same
boundary the base recipe already names.

## Pre-flight — `GET /products/bulk/preflight?ids=…&action=…`

Atomic actions validate before they execute; error prevention beats
error reporting.

| Case | Response (200) |
| --- | --- |
| all executable | the confirm fragment: "20 rows will be executed" + the submit that runs the action |
| some blocked | the report fragment: "**18 of 20 rows are executable**; 2 are blocked (by reason)" + **two** affordances — a submit carrying **only the executable ids** (server-rendered hidden inputs) and cancel |
| none executable | the report with the reasons and **no submit** — a dead end must be visible, not a disabled mystery |

"Exclude and run" keeps the atomic guarantee intact: the scope shrank
by explicit user consent before anything was attempted.

## Where the report goes

On a [full-height list page](../../apps/docs/src/content/docs/templates/data-grid-page.mdx)
the chrome is fixed and the grid takes what is left, so a region whose
height grows with the number of failure reasons squeezes the grid to
nothing — on the exact screen whose rows the report is telling the user
to go and fix.

> **The chrome is O(1).** Anything whose height grows with the data
> lives in the scrolling area, or in an overlay — never in the chrome.

Two surfaces, chosen by one question — *is there work in the grid?*

### Best-effort → a one-line summary, and the rows carry the truth

```html
<div id="bulk-report" aria-live="polite">
  <div class="hc-alert" data-variant="warning" role="status">
    <p class="hc-alert__body">
      <strong>12 of 40 rows could not be updated.</strong>
      <a href="/orders?f-last-result=failed">Show only failed (12)</a> ·
      <a href="/orders/bulk/report">Review reasons</a>
    </p>
  </div>
</div>
```

One line, whatever N is. The failing rows already say so themselves
(`data-attention="error"` plus their message row), and those scroll —
because they *are* the data.

**"Show only failed" is the important affordance.** It turns the grid
into the report: a real filter URL composing with
[datagrid-filter](../datagrid-filter/) and
[saved-views](../saved-views/), after which retrying is the ordinary
select-all → action loop. At two hundred failures it is the only shape
that works.

### The summary is also the navigator

Twelve failures scattered through five thousand rows is a *queue*, so
the summary carries the moves — and stays O(1) doing it:

```html
<p class="hc-alert__body">
  <strong>12 of 40 rows could not be updated.</strong>
  <a href="#row-4903">Previous</a>
  <span>Error 3 of 12 — row 137</span>
  <a href="#row-5012">Next</a> ·
  <a href="/orders?f-last-result=failed">Show only failed (12)</a>
</p>
```

- They are **real `<a href="#row-<id>">` links**, so Back works, the
  keyboard works, and no JavaScript is required to move.
  `installDatagrid()` lands the **active cell** on the row a fragment
  names, which is the focus move the user wanted.
- The counter and both hrefs are **server-rendered** from the same
  failure list the report shows, so the line and the panel cannot
  drift, and there is no client state to lose on a swap.
- Name rows by **id**, and show the ordinal
  ([`data-row-no`](../../apps/docs/src/content/docs/components/datagrid.mdx))
  beside it: `row 137` is how the failure gets discussed, but the
  ordinal moves when the sort or the conditions change and the id does
  not.
- A **Go to row** control (a number input submitting `?goto=137`)
  covers the number somebody read out loud. The **server** resolves the
  ordinal to the page that contains it and answers with the row anchor
  — only it knows where row 137 currently is.

### The grouped breakdown → a docked panel

The reason table opens beside the grid, not above it: a side panel
spends **horizontal** space, which this layout has.

```html
<div class="hc-splitter" data-orientation="horizontal">
  <div class="hc-splitter__panel"><!-- the grid --></div>
  <div class="hc-splitter__handle" role="separator" tabindex="0"
       aria-label="Resize the error panel"></div>
  <div class="hc-splitter__panel" id="bulk-report-detail"><!-- the report --></div>
</div>
```

Both are live at once, which is the whole job: click a reason, watch
the rows behind it filter or focus. A **modal** drawer would reproduce
the original defect in a different axis — the panel pointing at rows
the user must dismiss it to reach.

**Collapsed is the default, and collapsed still shows.** A panel that is
always open taxes every screen, every day, for something that happens
rarely; a panel that disappears when closed is a dead end. So it
collapses to a **rail carrying the count** (`Reasons (5)`) and the way
back in, and **the response does not open it**: the summary already
said what happened, and giving away the grid's width is a decision for
the person reading the rows. A screen whose *job* is triage may start
open — that is a property of the screen, not of the report.

Whether it is open is **workspace state**: remember it per user, not in
the URL (see the filter UX plan's state rule).

### Atomic → a modal dialog is correct

Nothing was applied. There is no work in the grid, and the user owes a
decision: run the executable subset, or cancel. Blocking *is* the
message, and the pre-flight fragment already answers exactly that. The
same holds for the `409` count-changed refusal.

## The report fragment

One region, reused by every branch. Shape (the
[csv-import](../csv-import/) validation report, generalized):

- a **summary line** ("113 succeeded / 87 failed, of 200 selected");
- a real `<table>` **grouped by reason** — `Reason / Count / Rows` — with
  `scope` on the header cells and the reason as each row's
  `scope="row"` header. At scale the reason is the actionable unit; a
  flat list of 87 rows is not reviewable;
- **a hard cap** on named rows per reason (10 is a good default),
  then "and N more" **and a full-list link** (a page or a CSV — an
  ordinary `<a href>`, no recipe needed). An uncapped report of 10 000
  failures is a broken page, so the cap and the escape hatch ship
  together;
- best-effort only: **"Filter to the failed rows"** — a plain filter URL
  (`?f-last-result=failed`) composing with
  [datagrid-filter](../datagrid-filter/) /
  [saved-views](../saved-views/). Retrying is then the ordinary
  select-all → action loop, with no new client state.

### Riding along with a tbody swap

The rows land in the `<tbody>`, so htmx parses the whole response **in
a table context** — where a bare `<div>` is not legal content. The
browser foster-parents it and mangles the report's nested `<table>`.
**Wrap the out-of-band report in `<template>`**:

```html
<tr class="hc-datagrid__row" id="row-101" data-attention="error">…</tr>
…
<template>
  <div id="bulk-report" aria-live="polite" data-hx-swap-oob="innerHTML">…</div>
</template>
```

htmx unwraps the template before applying the OOB swap; the same
escape applies to any non-row fragment riding a row response.

## Row links

Each named row is an anchor whose text identifies the row
(`101 Anvil` — never "here"):

| Where the row is | Link |
| --- | --- |
| this page | `#row-101` |
| another page | `/products?focus=101#row-101` — the server renders the page containing it |

`installDatagrid()` moves the active cell to the landing row and
focuses it, `:target` emphasises it, and the measured header offsets
keep it clear of the sticky header. The row links back with
`<a href="#bulk-report">Details</a>`, so the trip closes in both
directions.

## Per-row detail

A failed row's reason is rendered **once** as an `hc-tooltip` inside
the relevant cell, which points at it with `aria-describedby`, and the
cell carries `data-invalid` so the grid draws its corner marker (add
`aria-invalid="true"` when the cell's own value is at fault).

**Do not add an inline "details" link to a data cell.** The grid's
table is `max-content` sized and its cells do not wrap, so inline
additions widen the whole column — and a `data-resized` column clips
them away instead. The marker and the tooltip cost no layout; the way
back to the report is the browser's Back button (the report's row link
made a history entry), or an explicit link in a dedicated column. The grid
suppresses its overflow tooltip on such cells, so one gesture carries
one meaning. Tooltips are for inspecting a row you noticed — the
report stays the reviewable surface, so **never put a reason only in a
tooltip**.

## Toast

The toast is the headline, not the payload: counts plus a pointer to
the report. When failures exist it must **not auto-dismiss**
(`variant: "warning"` for best-effort, `"error"` for a refusal); the
report region carries the detail.

## Progressive enhancement (no JS)

The base recipe's `303` post/redirect/get applies. Render the same
report at the top of the redirected page (the fragment links work
natively — that is the whole point of using anchors), and the
pre-flight becomes an ordinary intermediate page.

## Accessibility

- The report region is `aria-live="polite"`: a result announces
  without stealing focus; the reasons are readable in place.
- Row links move focus into the grid via the active cell — no silent
  scroll-only jumps.
- Failure is never colour alone: `data-attention="error"` plus the
  reason text plus the report entry.
- The pre-flight's dead-end case renders the reasons instead of a
  disabled button with no explanation.
- The retry set is visible, not remembered: the checkboxes that come
  back `checked` *are* the state, so a screen-reader user hears the
  same count in the actions bar that a sighted user sees highlighted.

## Notes

- **Re-validate ids server-side.** The hidden-at-zero bar and the
  pre-flight are affordances, never guarantees — state can change
  between pre-flight and submit, which is exactly why the atomic branch
  still needs its refusal path.
- Reversible destructive work is better served by
  [undo-delete](../undo-delete/)'s grace period than by a confirm
  dialog.
- Long-running bulk work (hundreds of rows) belongs in an async job
  with progress, not a synchronous POST — out of scope here, and named
  so it is not assumed.
