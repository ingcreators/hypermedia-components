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
| 2 | `datagrid-bulk-errors`: the three surfaces by semantics (summary / drawer / dialog), the "show only failed" filter promoted to the primary affordance, and the height rule in *Required client markup* |
| 3 | A regression spec: with 15 reasons rendered, the grid still has usable height and the page itself does not scroll |

## Out of scope

- A new component. The drawer, alert, filterbar and datagrid states all
  exist; this is composition and a rule.
- Client-side pagination of the report. The cap plus the full-list link
  already covers it.
- Changing the report's *content* contract (grouped by reason, capped,
  linked) — only where it is rendered.
