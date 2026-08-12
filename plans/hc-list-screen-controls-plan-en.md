# List screen controls — views, sort, columns, and the filter panel

Status: **approved** (2026-08-12). Follows the
[filter UX plan](hc-filter-ux-plan-en.md), which built the wire; this
one is about the controls on the screen and how they divide the work.

## The four questions a list screen answers

Everything on the chrome answers one of four questions, and the controls
read best when each question has exactly one home:

| Question | Control | Home |
| --- | --- | --- |
| *What am I looking at?* | the saved view | **with the title** — it is the screen's identity |
| *Narrowed how?* | filter conditions | the **bar** (read-out) + the **panel** (editor) |
| *In what order?* | sort | a **toolbar control** |
| *Showing which columns?* | column set | a **toolbar control** |

The rule that places them: **frequency and verb.** Switching views,
re-sorting and toggling a column are frequent, navigational acts — they
belong on the screen. Building a condition set is compositional and
occasional — it belongs in a panel. Naming what you built is the
terminal step of that composition, so saving stays in the panel while
*recall* moves out to the screen.

Concretely:

```text
Orders   [ Overdue shipments ▾ ]                    ← identity (+ modified)
[ Ship date: last month (2026-07-01 – 2026-07-31) × ] [ Buyer code: 3 values × ]  Clear all
[⌵ Filters (3)] [↕ Sort (2)] [▥ Columns]  │ Refresh  Export 4,873 rows  │  4,901–4,940 of 5,000  ‹ ›
```

## Views move to the screen

Recall behind a modal costs four interactions for the single most
frequent act on the screen — and a saved view is a **named URL**, which
makes recall navigation, not filter editing. Bookmarks do not live
inside an "edit address bar" dialog.

- A `hc-menu` button whose **label is the current view's name**, so the
  identity question is answered without extra chrome. Modified renders
  in the label (`Overdue shipments • Modified`).
- The menu holds pinned first, then recent, then **Manage views…**, plus
  **Show everything** — the way back when a default view is applied.
- Chips or tabs remain reasonable when a team standardises on two or
  three views; the menu is the shape that survives thirty.
- The panel keeps only **Update** and **Save as new…** — the closing
  actions of the composition. This also resolves two defects in the
  current template: five controls crammed into a dialog title bar, and
  two different undos (header *Reset*, footer *Cancel*) sitting far
  apart with nothing to distinguish them.

## Sort gets a control, not just headers

Header clicks are the fast path and stay. What they cannot do is answer
*what is the current sort set* or let anyone change it deliberately:

- **Shift-click for multi-sort is invisible.** Nobody discovers it.
- With thirty columns the sorted one is often **scrolled out of view**,
  so `data-sort-index` on the header answers a question the user cannot
  see.
- A sort key on a **hidden column** has no header at all.
- Re-ordering keys means re-clicking headers in the right sequence.

So sort gets the same treatment filters got: a control that is both the
read-out and the editor. The button says the set
(`Sort: Ship date ↓, Order ↑`); opening it gives the ordered list, where
each key can be re-ordered (**`installSortable()`** — already shipped),
flipped, or removed, plus *Add a column…* listing every column including
hidden ones.

The wire is unchanged: `sort=-ship,order`, mirrored into the filter
form's `input[data-hc-datagrid-sort]` (#526), so a saved view captures
it and changing sort marks the view Modified like any other condition.

## Columns get an entry point

The `datagrid-columns` recipe exists, and
the template never surfaced it — the wiring map named the contract while
the screen offered no way in. A toolbar control opens the chooser.

Resolution stays **URL → user preference → app default**, and a view may
pin a column set (see the filter UX plan).

## Icons

The kit ships no icon set by design, so the template uses inline SVG on
`.hc-icon` and says which set it drew from. What matters here is the
policy, not the drawing:

- **Icon + label** for anything whose meaning is not universal — the
  three toolbar controls included. Business screens rotate staff;
  icon-only toolbars are learned once and re-learned by every newcomer.
- **Icon only** is reserved for the genuinely universal: close (`×`),
  overflow (`⋯`), pager chevrons — each with an accessible name.
- **A gear is not a columns icon.** A gear reads as *app or screen
  settings* (density, theme) and collides with it. Columns get a columns
  glyph; keep the gear for the screen-level settings menu if one exists.
- A funnel for filters and up/down arrows for sort are established
  enough to carry meaning alongside their labels.
- The count belongs in the label, not in a badge nobody reads:
  **Filters (3)**, **Sort (2)**.

## Date ranges take both forms

A date filter is a **period**, and users choose periods — "last month",
"this quarter" — with absolute dates as the exception for a specific
investigation. So the preset is primary and absolute entry is a branch
off it, exactly as single-value relative dates already work.

**The wire carries a range as one value:**

```text
?f-ship=@month-start-1m..@month-end-1m   last month
?f-ship=2026-07-01..2026-07-31           absolute
?f-ship=@month-start..                   open ended
?f-ship=@month-start-1m..2026-07-15      mixed — normal in practice
```

One param, not `f-ship-from` + `f-ship-to`, because a preset must be
able to set **both ends from one control**: the alternative needs hidden
inputs, and hidden controls keep submitting. It also keeps the bar
honest — one chip for what the user thinks of as one condition.

Composition uses the **`formdata` hook** (the mechanism `installFormat`
and `installMultiValue` already share): a small `data-hc-range` behavior
joins the two date inputs into `f-ship=A..B` on the way out, so editing
either end costs no round trip. Servers accept both shapes, keeping the
no-JS path intact.

**`from > to` is refused**, not silently swapped: executing a different
condition from the one written is the failure this whole programme is
about.

## The panel's typography and layout

- **Labels stay above their control.** Faster to scan and to complete,
  and robust to label length — "Buyer" and 発注者コード differ by a
  factor the fixed label column of a left-aligned layout cannot absorb.
- **Fields align to the top of their row** (`align-self: start`), so a
  three-row textarea stops stretching its neighbour.
- **Multi-line fields take a full row.** `hc-grid` is `auto-fit`, so
  which fields pair up changes with width; no layout may depend on a
  particular pairing.
- **The operator is secondary.** Rendering `[value][equals ▾]` at equal
  weight doubles the scan cost of finding what is set, when the default
  is what nearly every row uses.
- **Applied fields are marked**, so "what is currently set" is
  answerable at a glance rather than by reading eight rows.
- One vocabulary: **Apply**, not Search in one place and Apply in
  another.
- **Cancel is `formmethod="dialog"`** — native, no inline JS, in a kit
  that advertises CSP-safety.

## Saving

Naming is not the only decision at save time. The dialog asks for:

- the **name**;
- the **scope** — personal or shared, because a department standard is
  the normal case and silently forking a colleague's view is an
  accident;
- whether it becomes the **default** — which then redirects the bare
  list URL (`303`) so the address bar always shows the real conditions.

**Copy link** sits beside Save: a view *is* a URL, so sharing one costs
nothing and needs no shared object at all. Reserve shared views for team
standards that outlive a conversation.

## Work items

| # | Content |
| --- | --- |
| 1 | Views menu on the screen; panel reduced to Update / Save as new… ; the `type="reset"` and always-on **Modified** defects fixed |
| 2 | `data-hc-range` + the `A..B` wire; period presets; mixed and open-ended ranges; `from > to` refused |
| 3 | Sort control — read-out, reorder via `installSortable()`, add a hidden column, remove |
| 4 | Columns entry point wired to `datagrid-columns` |
| 5 | Panel layout and typography; icon policy applied |
| 6 | Save dialog — name, scope, default, copy link — and the `saved-views` contract updated |

## Out of scope

- Shipping an icon set. The kit stays icon-agnostic
  (`fundamentals/icons` says why).
- A nested AND/OR query builder.
- Sorting or filtering on the client.
