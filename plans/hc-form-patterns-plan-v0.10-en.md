# HC Form-Patterns Plan v0.10 — range slider, transfer, cascading select

Status: **shipped in full** — plan #332, `hc-range` #333, `transfer`
#334, `cascading-select` #335 (2026-07-04). The three items the
[v0.9 breadth plan](./hc-component-breadth2-plan-v0.9-en.md) deferred;
one concern per PR, merged sequentially. Remaining follow-up: the CLI
re-bundles the two new recipes at its next release (`cli-v0.2.1`).

Unlike v0.9 (pure CSS), these are **composite form patterns**: one small
behavior (`installRange` — the platform has no dual-thumb `<input>`),
and two server-driven recipes where htmx round-trips replace the client
state the peer libraries (Ant Transfer / Cascader, MUI range Slider)
keep in JavaScript.

## Principles alignment

| HC principle | How the three honour it |
| --- | --- |
| Native first | `hc-range` is two real `<input type="range">`s (form participation, arrow keys, SR value announcements). Transfer panes are checkbox forms; the cascader is chained `<select>`s. |
| Behaviors stay small / never fetch | `installRange` only clamps values, syncs two CSS custom properties, and emits an event. The recipes add **zero** new JS — htmx owns every request. |
| Markup as wire contract | Both recipes ship `contract.md` + `checks.json` (`hc validate`-checked) server contracts. |
| State in HTML | Range values live in the two inputs; transfer membership and cascader levels live in server-rendered fragments. |

## Track A — `hc-range` + `installRange()` (component + behavior)

A dual-thumb range for min/max filters (price band, date window — the
peer of MUI/Ant "range" sliders). Two overlapping native inputs on one
painted track:

```html
<div class="hc-range" style="--hc-range-low: 20; --hc-range-high: 80">
  <input class="hc-range__input" type="range" name="price_min"
         min="0" max="100" value="20" aria-label="Minimum price">
  <input class="hc-range__input" type="range" name="price_max"
         min="0" max="100" value="80" aria-label="Maximum price">
</div>
```

- **CSS**: the container paints the rail and the low→high fill segment
  from `--hc-range-low` / `--hc-range-high` (0–100 percentages); the
  inputs stack on top with transparent tracks; `pointer-events: none`
  on the inputs and `pointer-events: auto` on the thumb pseudo-elements
  make both thumbs draggable. Reuses the `--hc-slider-*` thumb/track
  tokens so the pair themes as one family; adds only `range.*` tokens
  for what differs.
- **Behavior** (`installRange`, auto-init bundle): on `input`, clamps so
  low ≤ high (pushing the sibling like the platform's own steppers do),
  keeps the two custom properties in sync, and emits a bubbling
  **`hc:rangechange`** `{ low, high }`. Idempotent, uninstaller,
  MutationObserver. Server-rendered fallback: inline custom properties
  (as above) — without JS the two inputs still work and serialize; only
  the cross-thumb clamp and live fill are lost.
- **htmx**: the two named inputs serialize natively; debounce with
  `data-hx-trigger="hc:rangechange delay:300ms"` on a filter form.
- **A11y**: each input keeps its own label ("Minimum price" /
  "Maximum price"), role, and value semantics; no ARIA re-plumbing.
- Out of scope: more than two thumbs, tick marks, tooltips-on-thumb.

## Track B — `transfer` recipe (+ `hc-transfer` layout CSS)

Dual listbox (Ant Transfer / PrimeVue PickList) as a **server round
trip**: membership lives on the server; every move re-renders the two
panes.

- **Markup**: one `<form class="hc-transfer" id="…">` with two panes
  (available / assigned) — each a titled, scrollable checkbox list of
  `hc-item` rows — and a controls column with `add` / `remove` submit
  buttons (`name="action" value="add|remove"`,
  `data-hx-post` + `data-hx-target="this" data-hx-swap="outerHTML"` on
  the form).
- **Contract** (`contract.md` + `checks.json`): POST receives `action`
  plus the checked ids (`available[]` / `assigned[]`); the server
  answers with the re-rendered `<form class="hc-transfer">` fragment
  (both panes, counts updated, checkboxes cleared). 4xx re-renders with
  an inline `.hc-alert`. No-JS path: the same POST full-page.
- **CSS** (`hc-transfer.css`): pane | controls | pane grid, logical
  properties (RTL flips), panes collapse to a stack in narrow
  containers; scrollable pane bodies reuse `hc-scroll-area` thinking
  (max-block-size + `overscroll-behavior`). New `transfer.*` tokens.
- **Zero new JS** — checkboxes, submit buttons, htmx.
- Out of scope: drag-and-drop between panes, client-side search inside
  panes (compose the live-search recipe per pane instead).

## Track C — `cascading-select` recipe

Cascader (hierarchical select) as **chained `<select>`s** — the
canonical hypermedia shape: each level's `change` fetches the next
level's options.

```html
<select class="hc-select" name="prefecture" aria-label="Prefecture"
        data-hx-get="/areas/cities" data-hx-target="#city"
        data-hx-include="this" data-hx-swap="outerHTML">…</select>
<select class="hc-select" id="city" name="city" aria-label="City" disabled>
  <option value="">Select a prefecture first</option>
</select>
```

- **Contract**: GET receives the parent's value and returns the child
  `<select>` fragment (enabled, populated, downstream levels reset to
  their disabled placeholder). Three levels documented; N levels follow
  the same shape.
- **Zero new JS / CSS** — `hc-select` + htmx. `checks.json` rules:
  child target declared, `data-hx-include` present, placeholder option
  present on disabled levels.
- Out of scope: a single-input tree-popover cascader (compose
  `hc-tree` + `hc-popover` manually if wanted; not blessed here).

## Definition of Done

Per track: docs page (en + **ja**) under recipes (B, C) or components
(A) · sidebar / recipes-index entries (en + ja) · kitchen-sink entry
(A only) · CHANGELOG (Unreleased) · Playwright spec incl. axe
(A: behavior suite; B, C: fixture-driven pattern spec) · recipes ship
`recipe.html` / `expanded.html` / `contract.md` / `checks.json` passing
`hc validate` (the keystone self-validation test picks them up
automatically). All additive → patch. The CLI re-bundles the two new
recipes at its next release (`cli-v0.2.1`), as with past recipe
additions — not part of these PRs.

## PR sequence

| PR | Content |
| --- | --- |
| 1 | This plan document. |
| 2 | Track A — `hc-range` + `installRange()`. |
| 3 | Track B — `transfer` recipe + `hc-transfer` CSS. |
| 4 | Track C — `cascading-select` recipe. |

Docs placement: range → components / Forms (after rating);
transfer + cascading-select → recipes "Actions & forms" group.
