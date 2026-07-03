# undo-delete — recipe plan (soft delete + grace period + tombstone restore)

Status: **shipped — recipe + checks + browser test (#294).**
Net-new recipe; **zero new JavaScript** — the pattern is a pure
composition of already-shipped pieces (the toast action button, htmx
event triggers, the 200-with-truth response doctrine). Baseline:
post-#288, 17 recipes.

## 1. Goal

The blessed **undo instead of confirm** pattern for frequent destructive
actions: delete executes immediately (no dialog), the server
soft-deletes with a grace period, and the result toast carries an
**Undo** button that restores the item — at its original position.

This is the counterpart to [confirm-action](../recipes/confirm-action/):
confirm gates *rare, catastrophic* actions up front; undo makes
*frequent, recoverable* actions instant and forgiving. The recipe
documents that decision rule — authors should pick one, not stack both.

## 2. The tombstone — the load-bearing idea

The deletion response does not return "nothing"; it returns a
**tombstone**: a hidden element swapped into the row's DOM slot that
(a) preserves the position, and (b) carries the restore wiring.

```text
DELETE /items/42
  → 200, body replaces the row (outerHTML):

    <tr id="item-42" hidden
        data-hx-post="/items/42/restore"
        data-hx-trigger="item-42:restore from:body"
        data-hx-swap="outerHTML"></tr>

  → plus the toast:

    HX-Trigger: {"hc:toast":{"id":"undo-item-42",
      "message":"\"Anvil\" deleted","variant":"info","duration":10000,
      "action":{"label":"Undo","event":"item-42:restore"}}}
```

Clicking **Undo** makes the toast dispatch the bubbling
`item-42:restore` event (existing `installToast` behavior — its own
source comment names undo as the use case); the tombstone hears it via
`from:body`, POSTs the restore, and the server returns the **original
row markup**, which swaps back into the tombstone's slot — the item
reappears exactly where it was. Everything is server-rendered HTML and
htmx wiring; the event name in the toast payload and in the tombstone's
trigger is the same server-generated string, so the pairing can never
drift.

```text
POST /items/42/restore
  → 200, body = the original <tr>…</tr> (outerHTML replaces the tombstone)
  → HX-Trigger: {"hc:toast":{"id":"undo-item-42",
      "message":"\"Anvil\" restored","variant":"success","duration":3000}}
```

Reusing the toast `id` updates the undo toast in place when it is still
visible (the shipped update-by-id path) and simply shows a fresh toast
when it already expired — both correct.

## 3. Contract decisions

- **Grace period is server truth, toast duration is only a hint.** The
  server hard-deletes after its grace window (recommended ≥ the toast
  duration; e.g. 10 s toast, 30–60 s grace). The toast expiring does
  NOT finalize anything.
- **Restore is idempotent**; restoring twice returns the row twice
  (the second swap is a no-op re-render).
- **Restore after expiry — 200 with the truth** (the bulk-actions
  doctrine, no status-code choreography): body = the tombstone again
  (unchanged slot), toast `variant: "error"`,
  `"…permanently deleted"`. A non-2xx would not swap and htmx's header
  handling on errors is version-dependent — the 200-truth shape avoids
  the whole question.
- **Client markup is one button** (request-action shape):
  `data-hx-delete="/items/42"`, `data-hx-target="closest tr"`,
  `data-hx-swap="outerHTML"`, `data-hx-disabled-elt="this"`. No
  `data-hc-confirm` — that is the point; the contract states the
  undo-vs-confirm decision rule instead.
- **Tombstones are inert leftovers.** A page usually re-renders before
  they matter; contracts note the server may also prune them via any
  later full re-render (data-region refresh, pagination). `<tr hidden>`
  keeps table semantics valid; non-table lists use the same pattern on
  `<li hidden>`.
- **Datagrid composition**: inside `.hc-datagrid__body` the tombstone
  is swapped as a row (outerHTML on the closest `.hc-datagrid__row`) —
  the tbody observer re-derives roles/offsets/selection (#280) on both
  delete and restore.

## 4. Why this shape (alignment)

| HC principle | How undo-delete honours it |
| --- | --- |
| Zero glue JS | Toast action buttons, update-by-id, htmx event triggers — all shipped; the recipe only arranges them. |
| Server owns the truth | Grace period, tombstone markup, restore payload, expiry outcome: all server-side; 200-with-truth throughout. |
| Markup as wire contract | The pairing key (`item-42:restore`) appears in exactly two server-rendered places: the toast payload and the tombstone trigger. |
| Progressive enhancement | No-JS: the button can keep a form fallback (`method`/`action` route posting the delete, 303 back — mutating-form branching); undo is then unavailable, which is the honest degradation for an enhancement whose whole value is the toast. The contract says so explicitly. |
| Composition over invention | request-action (button shape), toast (action + id), data-region (any full refresh prunes tombstones), datagrid (observer). |

## 5. Deliverables (single implementation PR)

- `recipes/undo-delete/{recipe.html, expanded.html, contract.md,
  checks.json}` — expanded.html is multi-fragment (button state,
  tombstone state, restored state), like inline-edit's. checks.json
  detects the delete button
  (`[data-hx-delete][data-hx-swap="outerHTML"]`) and encodes: target
  declared; `data-hx-disabled-elt` present (warn); **no
  `data-hc-confirm` on the same element** (error — the anti-pattern the
  contract warns about: stacking confirm on an undoable delete).
- `recipes/README.md` index row; docs page
  `recipes/undo-delete.mdx` (with the undo-vs-confirm decision table);
  links from the confirm-action docs page ("when NOT to confirm").
- Browser test: serve.mjs mock (`DELETE /mock/items/:id` → tombstone +
  toast; `POST /mock/items/:id/restore` → row + success toast; an
  `expired` item → 200 tombstone + error toast), fixture with a 3-row
  table, `test-browser/undo-delete.spec.mjs`:
  1. Delete removes the row; the undo toast shows with an Undo button.
  2. Undo restores the row **at its original position** (order
     asserted) and the toast updates in place to "restored".
  3. Restore after expiry: row stays gone, error toast shown, page
     still functional.
  4. Two deletes → two toasts → undoing only the second restores only
     that row (pairing keys don't cross).
  5. Axe scan with the undo toast visible.
- CHANGELOG (Added); plan Status → shipped.

## 6. Public API surface

**None.** No new behaviors, attributes, events, CSS, or i18n keys —
one new recipe contract (`recipes/undo-delete/`), which is additive.

## 7. PR split

PR 1 — this plan (`chore(plans)`). PR 2 — `docs(recipes): bless
undo-delete (soft delete + grace period + tombstone restore)`.

## 8. Risks / notes

- **Toast region position vs. event bubbling**: the action event
  bubbles from the toast (inside the body-appended region) to `body`;
  tombstones listen `from:body` — pinned by the browser test.
- **Multiple pending undos** are naturally supported (unique event
  names + per-item toasts with distinct `id`s); the toast region's
  `data-limit` may evict older undo toasts — the contract notes the
  grace period still applies (the toast is an affordance, not the
  state).
- **Tombstone accumulation** is bounded by page lifetime and pruned by
  any full re-render; noted, not engineered around, in v1.
- Recipe DoD (§17.4): all nine items covered — no macro (allowed), no
  behavior helpers to test beyond the composition itself (browser
  spec).
