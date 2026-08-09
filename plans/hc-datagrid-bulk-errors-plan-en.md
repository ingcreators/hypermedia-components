# datagrid-bulk-errors — execution semantics, refusal, and errors at scale

Status: **plan approved 2026-08-09 — implementation PRs follow, one theme
per PR, sequential (no stacking).**

Follow-up to [datagrid-edit-feedback](hc-datagrid-edit-feedback-plan-en.md)
(#500–#504), which closed the feedback loop for editing **one cell**.
Bulk actions have no equivalent: today the whole failure vocabulary is
one toast — `"3 archived, 1 failed"` — and the shipped
[datagrid-bulk-actions](../recipes/datagrid-bulk-actions/contract.md)
contract states there is "no status-code choreography, always 200".

Two problems with that, and the second is the deeper one:

1. **At scale the toast says nothing actionable.** With 87 failures out
   of 200 the user cannot learn *which* rows failed, *why*, or how to
   retry — and a toast is the wrong surface for a list anyway (it
   disappears, cannot scroll, cannot be reviewed).
2. **It silently assumes partial success is acceptable.** Many business
   operations are all-or-nothing (ledger postings, stock transfers,
   permission changes with invariants). For those, "3 succeeded, 1
   failed" is a *lie* — the server rolled everything back. A grid that
   only blesses best-effort pushes apps into the wrong model.

This plan makes the **execution semantics an explicit contract choice**
and gives each mode the presentation it actually needs.

## 0. Doctrine check

Unchanged: the server owns the rules and the truth, htmx owns the
requests, the behavior only marks states and moves focus. Everything
below is either markup the server renders or an affordance derived
from it. Nothing is computed client-side.

Out of scope (named so they are not silently assumed):

- **Long-running bulk jobs** — hundreds of rows should not block a
  synchronous POST. Async job + progress + completion is a separate
  axis (the SSE recipes and `installUploadProgress()` are the
  precedents); a later theme, not this one.
- **Cross-page selection** — still the datagrid-bulk-actions
  non-goal; the report's cross-page *links* (§1.5) are a different
  thing and are in scope.

## 1. Themes

### 1.1 Two execution modes, declared

`datagrid-bulk-errors` documents both branches of the same POST. The
server picks per action; the recipe's job is that each branch is
coherent end to end.

| | **best-effort** (partial success allowed) | **atomic** (all-or-nothing) |
| --- | --- | --- |
| Fits | independent items: archive, tag, notify | invariants: postings, transfers, permissions |
| Response | `200` + rows reflecting **what actually happened** | **`409` / `422`** + rows **unchanged** |
| Failed rows | marked (`data-tone="error"`, per-row reason) | **not marked** — nothing changed, marking would lie |
| Toast | `warning`, non-dismissing while failures exist | `error`, framed as **refusal**, not partial completion |
| Wording | "113 件成功 / 87 件失敗" | "**実行しませんでした**（2 件が条件を満たさないため）" |
| Selection | clears by construction (fresh unchecked rows) | **must be preserved** — the user has to fix and retry |
| Next step | retry the failed subset | fix the blockers, or **exclude and re-run** |

**Selection preservation is a correction to the shipped contract.**
`datagrid-bulk-actions` currently tells servers that rows come back
unchecked so "the selection clears by construction". In an atomic
refusal that destroys the user's work (200 hand-picked rows, gone).
The mechanism already supports the fix — the checkboxes *are* the
selection truth, and `installDatagrid()` re-derives from them after a
swap — so the fix is purely "render the refusal with `checked` kept".
The bulk-actions contract gets that carve-out plus a pointer here.

### 1.2 Pre-flight is the real answer for atomic

Error prevention outranks error messaging. For atomic actions,
executing-then-refusing is the worst path; the **confirm step becomes
a pre-flight report** (the [confirm-action](../recipes/confirm-action/)
shell already exists):

```text
20 件のうち 18 件が実行可能、2 件は不可（理由: 締め済み）
〔2 件を除いて 18 件を実行〕〔キャンセル〕
```

`GET /products/bulk/preflight?ids=…&action=…` answers that fragment.
The "exclude and run" button is a normal submit carrying **only the
executable ids** (server-rendered hidden inputs) — so an atomic
guarantee is preserved while the user still has a way forward. This
turns a dead end into a scoped decision, which is the whole point.

### 1.3 The result report — reason-first, capped

One OOB region (`#bulk-report`, `aria-live="polite"`) above the grid,
reusing the [csv-import](../recipes/csv-import/) validation-report
shape (a real `<table>`, `scope` on headers):

- summary line ("113 件成功 / 87 件失敗");
- **grouped by reason**, not by row — at scale the reason is the
  actionable unit: `理由 / 件数 / 対象（先頭 N 件）`;
- **a hard cap** on inline detail (default 10 per reason) with
  "他 77 件" and a full-list link (a page or CSV — the export needs no
  recipe, it is an `<a href>`);
- for best-effort: a **"失敗した行だけに絞り込む"** link — a plain
  server filter URL (`?f-last-result=failed`), composing with
  [datagrid-filter](../recipes/datagrid-filter/) /
  [saved-views](../recipes/saved-views/). Filtering beats
  "re-select the failed ones" because the retry is then just the
  ordinary select-all → action loop.

### 1.4 Detail on demand: the tooltip layer

Per-row/per-cell reasons become tooltips **in addition to**, never
instead of, the report:

- the server renders the reason once as an `hc-tooltip` with an id and
  points the row's marked cell at it with `aria-describedby` (plus
  `aria-invalid` where the cell is at fault). `installTooltip()`
  already wires trigger discovery by `aria-describedby`, shows on
  focus without delay, and dismisses on Escape without losing focus —
  WCAG 1.4.13 satisfied out of the box;
- **the grid's roving tabindex makes cells focusable**, so arrowing to
  a marked cell reveals its tooltip — the usual "tooltips are
  mouse-only" objection does not apply here;
- **collision guard (core)**: a cell that both truncates and carries an
  error would show the built-in overflow tooltip *and* the error
  tooltip on the same gesture. `installDatagrid()` must suppress the
  overflow tip on `[data-invalid]` / `[aria-describedby]` cells —
  error wins.

Tooltips are for *inspecting a row you noticed*; nobody reviews 87
tooltips. The report stays the reviewable surface.

### 1.5 Report ↔ row navigation

Plain fragment links, so history (and therefore **Back to the report**)
works for free:

- rows carry a **stable `id`** (`row-<id>`) — a contract requirement;
- report entries are ordinary anchors whose text identifies the row
  (`101 Anvil`, never "こちら"):
  - same page → `#row-101`;
  - **another page → `/items?focus=101#row-101`** — the server renders
    the page containing that row and the fragment does the rest.
    Failures span pages at scale, so this is the important one;
- **`:target` landing emphasis** (CSS only, persistent, not a flash);
- **focus, not just scroll (core)**: a hash pointing at a row moves the
  **active cell** to that row's first cell and focuses it, reusing
  `setActive()`. Scrolling alone strands keyboard and screen-reader
  users;
- sticky headers must not cover the landing row — the behavior already
  sets `scroll-padding-top` from the measured header height; verify
  across the three engines and add `scroll-margin-block-start` on rows
  if fragment navigation ignores it;
- the return trip closes too: the row's message links back to
  `#bulk-report`.

## 2. Public API surface (additive → patch)

- Attributes: `data-hc-datagrid-focus`-free — the hash *is* the API;
  rows keep plain `id`s. `data-tone` / `data-invalid` /
  `aria-describedby` are existing vocabulary.
- Classes: `.hc-datagrid__row:target` styling (no new class).
- Behavior: hash → active cell + focus; overflow-tooltip suppression on
  error cells. No new exports, no new events.
- Recipes: `datagrid-bulk-errors`; a carve-out amendment to
  `datagrid-bulk-actions` (selection preservation on refusal + the
  semantics pointer).

## 3. PR split (sequential, no stacking)

1. `chore(plans)`: this document.
2. `feat(datagrid)`: the navigation + tooltip core bits (§1.4 guard,
   §1.5 `:target` + hash-to-active-cell + sticky-header verification).
3. `docs(recipes)`: bless `datagrid-bulk-errors` — both modes,
   pre-flight, report, jump links, tooltip usage — plus the
   `datagrid-bulk-actions` contract carve-out.

## 4. Risks / notes

- **Do not let the atomic branch inherit best-effort wording.** The
  copy is the contract here: refusal ≠ partial completion. The recipe
  spells out both message shapes.
- **`:target` after an htmx swap**: a re-rendered row with the same id
  should re-match the fragment; pin it with a browser spec rather than
  assuming.
- **Report cap is a promise, not a default** — an uncapped report of
  10 000 failures is a broken page. The contract states the cap and
  the full-list escape hatch together.
- **The server must re-validate ids** (unchanged from
  datagrid-bulk-actions): the hidden-at-zero bar and the pre-flight are
  affordances, never guarantees.
- Destructive best-effort actions should prefer
  [undo-delete](../recipes/undo-delete/)'s grace period over a confirm
  dialog — undo beats confirmation for reversible destructive work.
