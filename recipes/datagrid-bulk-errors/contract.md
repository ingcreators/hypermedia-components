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
- A **report region** above the grid:
  `<div id="bulk-report" aria-live="polite">`, filled by the response
  (out of band alongside the rows, or as the direct target for the
  pre-flight).
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
| Failed rows | marked `data-tone="error"`, reason via `aria-describedby` | **not marked** — nothing changed; marking would lie |
| Copy | "113 succeeded / 87 failed" | "**Nothing was executed** (2 rows do not qualify)" |
| Selection | clears by construction (fresh unchecked rows) | **preserved** — re-render the checkboxes `checked` |
| Recovery | filter to the failed rows and retry | fix the blockers, or exclude them and re-run |

**Selection preservation is mandatory in the atomic branch.** The base
recipe's "the selection clears by construction" holds only when the
action ran. A refusal that also wipes 200 hand-picked rows is a data
loss the user cannot undo. The checkboxes *are* the selection truth, so
rendering them `checked` is the whole fix.

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
<tr class="hc-datagrid__row" id="row-101" data-tone="error">…</tr>
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
the relevant cell, which points at it with `aria-describedby` (add
`aria-invalid="true"` when the cell's own value is at fault). The grid
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
- Failure is never colour alone: `data-tone="error"` plus the reason
  text plus the report entry.
- The pre-flight's dead-end case renders the reasons instead of a
  disabled button with no explanation.

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
