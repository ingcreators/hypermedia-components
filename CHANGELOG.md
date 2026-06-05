# Changelog

All notable changes to Hypermedia Components are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Sections used:

```text
Added       — new features
Changed     — changes in existing functionality
Deprecated  — soon-to-be removed features
Removed     — features removed in this release
Fixed       — bug fixes
Security    — security-relevant changes
```

---

## [Unreleased]

### Added

- **Remote (async) combobox options.** Add `data-remote` to an `hc-combobox`
  to let the server filter: the behavior turns off its client-side filter and
  surfaces the request lifecycle as in-listbox states — a spinner row +
  `aria-busy` while loading (from `htmx:beforeRequest`), the existing "No
  matches" marker on an empty result, and an error row on failure
  (`htmx:responseError` / a failed `htmx:afterRequest`). It re-evaluates and
  highlights the first option after each options swap (htmx event or a plain
  DOM swap, via a `MutationObserver`). New `combobox.loading` / `combobox.error`
  i18n keys (overridable per-listbox with `data-hc-loading` / `data-hc-error`),
  CSS `.hc-combobox__loading` (with a reduced-motion-aware spinner) /
  `.hc-combobox__error`, and a Combobox → Remote (async) options docs section.
  The behavior still never makes the request — htmx owns fetching, debounce,
  and cancel-in-flight. 5 Vitest + 5 Playwright tests.

- **Toast options — position, stacking limit, swipe-to-dismiss.** The toast
  region accepts `data-position="{top,bottom}-{left,center,right}"` (default
  `bottom-right`; top positions stack downward, `*-center` centres) and
  `data-limit="N"` to cap the visible stack (the oldest is evicted). Each toast
  can be **dragged horizontally to dismiss** — past ~40% of its width it flies
  out, otherwise it snaps back (pointer / touch; motion removed under
  `prefers-reduced-motion`). New **Toast** component docs page. 3 Vitest + 3
  Playwright tests.

- **Scrollable tab overflow (`hc-tabs`).** Add `data-overflow="scroll"` to keep
  a long tab list on one horizontally-scrollable row instead of wrapping.
  `installTabs()` injects edge scroll buttons that appear only when there is
  more to scroll (a mouse affordance, kept out of the tab order), keeps the
  active / focused / initially-selected tab in view (arrow keys, activation,
  and load), hides the scrollbar, and is direction-aware (the buttons flip and
  the chevrons mirror under RTL). New Tabs → Overflow (scrollable) docs and
  `--hc-tabs-scroll-size` token; 4 Playwright tests.

### Changed

- **Anchor-positioning fallback consolidated and hardened.** The popovers
  (menu, tooltip, hovercard, combobox, multi-combobox) position with CSS
  Anchor Positioning where available and fall back to JS where it isn't (e.g.
  current Firefox). That fallback now lives in one shared module
  (`anchor-fallback.js`) instead of five near-duplicates, and gains three
  fixes: it **tracks the trigger on scroll / resize** while open (was
  positioned once on open and drifted); the combobox / multi-combobox
  fallbacks now **flip** on viewport overflow like the others (they only
  dropped straight down before); and it positions with physical `top` / `left`
  so it is **correct under RTL** (the previous logical-inset values mis-placed
  it). Listeners are cleaned up on close. Default (Chromium) rendering is
  unchanged. New browser tests run with anchor positioning stubbed off.
- **Docs home page dogfoods `hc-card` + `hc-grid`.** The landing page's
  feature cards are now built from HC's own `hc-grid` + `hc-card` (with
  `not-content` to bypass Starlight's prose styles) instead of Starlight's
  `<CardGrid>` / `<Card>`. Docs only.
- **Docs navbar pickers dogfood `hc-select`.** The colour / density
  pickers in the navbar are now styled by HC's own `.hc-select`
  (`data-size="sm"`) instead of ~30 lines of bespoke `<select>` CSS — the
  chrome itself now uses a real HC form control. Docs only.
- **Docs reference tables dogfood `hc-table`.** A small rehype plugin
  (`apps/docs/rehype-hc-tables.mjs`) wraps every Markdown table in
  `<div class="hc-table-scroll not-content">` and adds the `hc-table`
  class, so the docs' reference tables render as HC's own component (the
  `.not-content` wrapper is required because Starlight styles tables with
  unlayered rules that would otherwise beat the `hc-table` layer; it also
  doubles as the responsive scroll strip). Authored `<table class="hc-table">`
  demos in MDX are JSX nodes and are left untouched. Docs only.
- **Responsive audit of existing components** (no breaking changes):
  - **`hc-pagination`** now wraps onto multiple rows when its container is
    narrow (`flex-wrap: wrap`) instead of overflowing horizontally.
  - **`hc-table`** gains a `.hc-table-scroll` wrapper that confines a wide
    table to a horizontal scroll strip on small screens rather than
    pushing the page sideways. (Make the wrapper a focusable, labelled
    region — `role="region"` / `aria-label` / `tabindex="0"` — so it stays
    keyboard-reachable.)
  - **`hc-dialog` / `hc-drawer` footers** wrap their action buttons
    (`flex-wrap: wrap`) instead of overflowing on very narrow screens.

  Audit confirmed the already-responsive components need no change:
  `hc-dialog` / `hc-drawer` / `hc-command` cap their width to the viewport,
  and `hc-toolbar` / `hc-tabs` / `hc-breadcrumb` already wrap.
- Consistency renames (pre-alpha, no back-compat aliases). A library
  audit turned up three naming drifts:
  - **`confirmed` event → `hc:confirmed`.** `installConfirm` was the
    only behavior dispatching an un-namespaced event; every other one
    uses `hc:*`. Update `data-hx-trigger="confirmed"` →
    `data-hx-trigger="hc:confirmed"` (and `send confirmed` →
    `send hc:confirmed` in _hyperscript). Touches the behavior, the
    `<hc-confirm-action>` macro, all integration / recipe / component
    docs and examples.
  - **`data-hc-command-hotkey` → `data-hotkey`.** Every other
    component reads its own config from a plain `data-*`
    (`data-value`, `data-length`, `data-orientation`, …); the
    `data-hc-*` prefix is reserved for cross-component glue
    (`data-hc-confirm`, `data-hc-context-menu`,
    `data-hc-close-dialog-on-success`, …). The command hotkey is the
    component's own config, so it drops the prefix.
  - **`*-invalid-border` token → `*-error-border`.** The error-state
    border token for value-entry fields (input / select / datepicker /
    input-OTP, and checkbox / radio) was named `invalid-border` while
    the `data-variant="error"` attribute and every other component use
    `error-*`. Renamed for attribute↔token symmetry
    (`--hc-input-invalid-border` → `--hc-input-error-border`, etc.);
    `aria-invalid` still maps to the same border.
- **Docs site dogfoods HC tokens.** The Starlight chrome (header,
  sidebar, links, inline code, hairlines, accents) is now skinned with
  the generated `--hc-*` tokens via a `--sl-*` → `--hc-*` bridge in
  `apps/docs/src/styles/custom.css`. Because both Starlight and HC key
  their light/dark values on `[data-theme]`, the bridge is a single set
  of `var(--hc-*)` references; and because the navbar `data-color`
  picker re-tints `--hc-color-action-primary-*`, switching the colour
  theme now re-tints the whole docs chrome, not just the live previews.
  No library or API change.
- **Responsive design documentation.** New Fundamentals → Responsive
  design page laying out the container-first strategy (intrinsic layout
  utilities, the single viewport breakpoint in `hc-shell`, the density
  axis, and a decision table for which tool responds to container vs
  viewport width). The Kitchen sink gains a Layout & responsiveness
  section (live `hc-grid` / `hc-cluster` / `hc-sidebar`, a scaled
  `hc-shell`, and the `.hc-table-scroll` pattern), and the Fundamentals
  index links the new pages. Docs only.

### Added

- **Form-validation depth for `hc-field`.** Native HTML constraint validation
  (`required`, `type`, `pattern`, `min`/`max`, `minlength`…) now drives the
  field UI with no per-field wiring. New CSS `:user-invalid` hooks on input /
  select / datepicker / checkbox / radio style the control invalid **only after
  the user interacts** (no JS), the field's help message follows via
  `:has(:user-invalid)`, and a required control adds an asterisk to its label
  (`--hc-field-required-color`, overridable). A new `installValidation()`
  behavior (in the auto-init `/behaviors` bundle, and exported from the main
  entry) surfaces the control's localized `validationMessage` into a
  `.hc-field__error` element, wires `aria-invalid` / `data-invalid` /
  `aria-describedby`, clears live as the user fixes the field, and replaces the
  browser's default bubble with the inline message on submit. New Field →
  Client-side validation docs; 8 Vitest + 4 Playwright tests.
- **Right-to-left (RTL) support.** The kit is built on CSS logical properties,
  so `dir="rtl"` mostly "just works"; this fills the gaps that needed genuine
  direction-awareness. The datagrid frozen column now sticks to the
  inline-start via `inset-inline-start` (was a physical `left`) with the
  freeze-line shadow flipped in RTL; the calendar prev/next chevrons mirror;
  and horizontal arrow-key navigation is mirrored in RTL for tabs, toggle
  group, datagrid cell grid, calendar, and splitter (vertical arrows
  unchanged). Docs gain a **Dir** picker in the top bar to preview the whole
  site in RTL, plus an Accessibility → Right-to-left section. 6 Playwright
  tests under `dir="rtl"`.
- **Reduced-motion coverage completed.** The controls whose only animation is
  a `transition` and that weren't already gated in their own stylesheet
  (button, checkbox, radio, input, select, datepicker, tabs, pagination,
  toggle group) now zero their `transition-duration` under
  `prefers-reduced-motion: reduce` — handled centrally in `hc.a11y.css`; the
  htmx indicator fade is gated in `hc.htmx.css`. Combined with the components
  that already self-gated, nothing in the kit animates under reduced-motion.
  New Accessibility → Reduced motion section; 2 Playwright tests under
  emulated `reducedMotion`.
- **Forced Colors / Windows High Contrast support.** A cross-component
  forced-colors stylesheet (`hc.a11y.css`, bundled into `hc.css`) re-expresses
  the patterns that break under a high-contrast theme — where the UA drops
  `box-shadow` and forces the system palette — using CSS system colours.
  Focus rings that used `box-shadow` are restored as an `outline`; selection /
  active state (combobox & command options, tabs, toggle group, pagination,
  calendar, datagrid selected rows / current cell) is marked with an inset
  `outline`; custom toggles (checkbox / radio / switch / slider thumb) opt out
  with `forced-color-adjust: none` and paint with `Highlight` / `Canvas` /
  `CanvasText`. Shipped in the components layer (last source file, no extra
  cascade layer) and exposed granularly at `@hypermedia-components/core/a11y.css`.
  New Fundamentals → Accessibility page. 6 Playwright tests under emulated
  forced-colors.
- **i18n message catalog for behaviors.** The strings behaviors inject —
  created nodes (combobox "No matches", multi-select tag remove labels) and
  default ARIA labels (shell nav toggle, splitter handle, toast region,
  calendar prev/next/grid, confirm dialog) — now route through a single
  catalog. Call `setMessages({ … })` once to translate the whole kit;
  `{name}` placeholders interpolate (e.g. `multicombobox.remove`). Per-element
  attributes still win (`data-hc-confirm-*`, `data-hc-empty`, an
  author-provided `aria-label`), so the server can localize per region.
  Exported from the main entry and a side-effect-free `./i18n` submodule
  (`setMessages` / `resetMessages` / `getMessages` / `DEFAULT_MESSAGES`).
  New Fundamentals → Internationalization (i18n) page.
- **`datagrid-pager` recipe** — server pagination for `hc-datagrid` with
  htmx: swap one page of rows into the `<tbody>` (`innerHTML`, so the
  behavior's observer re-runs and re-applies roles / sticky offsets /
  resized widths) and update the `hc-pagination` pager + status line
  out-of-band. New Recipes → Datagrid pager page plus the
  `recipes/datagrid-pager/` scaffold (recipe / expanded / contract).
- **`hc-datagrid`** — an interactive, Excel-like data grid for business
  screens, built on a semantic `<table>` and `position: sticky`.
  - **CSS layer:** multi-level sticky group/sub/leaf headers, frozen
    (sticky-left) columns with a freeze-line affordance, and styling for
    row selection (`aria-selected`), active cell (`data-active`), column
    highlight (`data-highlight`), and the inline-editing cell slot
    (`data-editing`, padding drops so an HC form control fills the cell).
    Built for **paged** data (htmx loads a page) — explicitly not a
    client-side virtual-scroll / sort / filter engine.
  - **Column resize:** mark a column with `data-resizable` + `data-col` on
    its header (and the matching `data-col` on body cells);
    `installDatagrid()` adds a draggable / keyboard-operable grip
    (`role="separator"` + `aria-valuenow`) that sets that column's width and
    clips it, leaving other columns content-sized. Emits
    `hc:datagridcolumnresize` (`{ col, width }`) for the app to persist.
  - **Vertical headers:** `data-orientation="vertical"` on a header cell
    rotates its label (`writing-mode: vertical-rl`) so a long name reads
    top-to-bottom in a narrow column instead of widening it;
    `data-orientation="sideways"` uses `sideways-lr` (whole line rotated,
    bottom-to-top — axis-label style). Override
    `--hc-datagrid-head-writing-mode` for full control. Pure CSS.
  - **`installDatagrid()` behavior:** measures the rendered header heights
    and frozen-column widths and writes the sticky offset variables
    (`--hc-datagrid-head-1-h`, per-cell `--hc-datagrid-left`),
    re-measuring on resize; applies the WAI-ARIA *grid* roles and a
    roving-tabindex keyboard model (arrows / Home / End / Ctrl+Home·End /
    Page Up·Down move the active cell; the grid is one tab stop); and
    wires row selection (Space + per-row checkbox + select-all with an
    indeterminate state), emitting `hc:datagridselectionchange`. Idempotent,
    returns an uninstaller, and picks up htmx-swapped grids/rows via
    `MutationObserver`.

  - **Expandable row detail (master/detail):** put a
    `[data-hc-datagrid-toggle]` button in a record's lead cell and a
    `.hc-datagrid__detail-row` (a `<tr>` with one `colspan` cell) holding
    **arbitrary HTML** — a nested grid, a form, a chart. `installDatagrid()`
    toggles `data-expanded` / row visibility / `aria-expanded` /
    `aria-controls` (click the +/− or `Enter`), dispatches
    `hc:datagridexpand` / `hc:datagridcollapse`, and (htmx) lazy-loads via
    `data-hx-*` on the toggle. A nested `hc-datagrid` in a detail panel is
    upgraded and operated independently (events from a nested grid are
    ignored by the outer one).
  - **Multi-row records:** render one record across several rows by
    making each record a `<tbody class="hc-datagrid__record">` of sub-rows
    (span the lead column with `rowspan`). `installDatagrid()` treats each
    record `<tbody>` as one selectable unit — its checkbox / `Space`
    selects every sub-row (`aria-selected` per row + `data-selected` on the
    tbody), select-all and `hc:datagridselectionchange` count by record,
    and the active cell's record gets `data-current` (accented lead cell).
    A thicker border separates records, a lighter one divides sub-rows;
    keyboard nav moves by sub-row (↑/↓) and cell (←/→) across both.
    Single-row grids are unchanged. New tokens
    `--hc-datagrid-subrow-border` / `-current-bg` / `-current-fg`.
  - **Overflow truncation + tooltip:** wrap a value in
    `.hc-datagrid__truncate` (with a fixed `max-inline-size` /
    `--hc-datagrid-truncate-max`) to clip it to one ellipsised line;
    `installDatagrid()` shows the full text in a single shared, styled
    tooltip on hover/focus, but only when the value is actually clipped
    (`scrollWidth > clientWidth`) — so it scales without a per-cell
    tooltip. Reuses the `--hc-tooltip-*` tokens.
  - **Inline editing:** editable cells (`data-editable` + `data-col`)
    activate on Enter / F2 / double-click / type-to-edit; the column's
    `<template data-datagrid-editor>` is cloned into the cell, reusing
    existing HC controls (text → `hc-input`, date → `hc-input[type=date]`,
    select → `hc-select`, searchable → `hc-combobox`, whose `popover`
    listbox escapes the scroll clip). Commit on Enter / blur / combobox
    pick writes the value back and dispatches `hc:datagridedit`
    (`{ cell, col, value, label, oldValue }`) for htmx to persist; Escape
    cancels. No bespoke editor engine.

    Colours come from the shared tokens. New Components → Datagrid docs
    page; Vitest unit + Playwright coverage (sticky header / frozen
    columns / corner pinning via the behavior's auto-measurement, header
    stacking, keyboard navigation, selection, select-all, text/select/
    combobox editing, and axe).
- **`hc-shell`** — a full-viewport application shell for business apps:
  a persistent sidebar, header, scrolling main region, and optional aside
  (third column, added via `:has()`) and footer, on a CSS Grid with
  `grid-template-areas` and `100dvh`. The layout is pure CSS. The one
  behavior, `installShell()`, powers only the **mobile** navigation
  overlay (below a `60rem` breakpoint the sidebar becomes a fixed
  off-canvas panel): it toggles `data-sidebar` from a
  `[data-hc-shell-toggle]` button, keeps `aria-expanded` / `aria-controls`
  in sync, moves focus into the sidebar and traps `Tab`, and closes on
  `Escape` / scrim click / nav-link activation while restoring focus —
  force-closing when the viewport returns to desktop. Idempotent, returns
  an uninstaller, and picks up htmx-swapped shells via `MutationObserver`.
  Layout knobs: `--hc-shell-sidebar-width` / `--hc-shell-aside-width` /
  `--hc-shell-pad`. New Components → Shell docs page; Vitest unit coverage
  for the behavior and Playwright coverage for the desktop grid, the
  mobile overlay (open / focus move / Tab trap / Escape / scrim), and axe
  scans in both states.
- **Layout utilities** (`hc.utilities` cascade layer, plan §10.4). The
  previously reserved layer is now populated with a small, semantic set
  of *intrinsically responsive* layout primitives — no breakpoints, no
  media queries: `.hc-stack` (vertical rhythm), `.hc-cluster` (wrapping
  row), `.hc-grid` (auto-fill responsive grid), `.hc-container` (centred
  well), `.hc-sidebar` (sidebar + main that wraps by container width),
  plus the `.hc-sr-only` and `.hc-hidden` helpers. Each exposes
  token-based tuning knobs (`--hc-stack-gap`, `--hc-grid-min`, …). They
  are bundled into `hc.css` / `hc.min.css` and available granularly via
  the new `@hypermedia-components/core/css/utilities` export. These are
  the responsive foundation the forthcoming `hc-shell` builds on. New
  Fundamentals → Layout utilities docs page; Playwright coverage for
  display modes, responsive wrap/collapse, sr-only, and an axe scan.
- Unified the `data-variant` vocabulary across form controls so every
  field speaks the same `success` / `warning` / `error` language
  (closing inconsistencies that had crept in as controls were added
  piecemeal):
  - **`hc-input` / `<textarea>`** gain `data-variant="success" |
    "warning" | "error"` border-colour cues (previously error-only via
    `aria-invalid`), matching `hc-select` / `hc-datepicker`. New
    `input.success-border` / `input.warning-border` tokens.
  - **`hc-switch`** gains the missing `data-variant="warning"` (it had
    only `success` / `error`), so it matches checkbox / radio. New
    `switch.warning-checked-bg` token.
  - **`hc-inputotp`** gains `data-variant="success" | "warning"` slot-
    border cues alongside its existing error / `aria-invalid` state.
    New `inputotp.success-border` / `inputotp.warning-border` tokens.
  - **Combobox / multicombobox** inherit the trio through their inner
    `.hc-input` (set `data-variant` on the input / control) — no new
    code.

  For value-entry fields, `error` remains best expressed with the
  native `aria-invalid="true"` (the accessible hook); `data-variant`
  is the visual-only shorthand and the only way to express
  `success` / `warning`. `tokens/variants.mdx` is rewritten as a
  complete matrix covering every form control with the two rationales
  (validation cue for value-entry fields, semantic intent for choice
  controls), and the input / switch / input-OTP component pages document
  the variants. New Playwright `input.spec.mjs` (5 cases) plus
  `warning` / variant-border cases added to the switch and input-OTP
  specs.

- Docs: _hyperscript "receiving" guidance. The interactive components
  keep their internals in the vanilla behaviors (one tested, accessible
  WAI-ARIA implementation) but expose bubbling `hc:*` events; the
  `integrations/hyperscript.mdx` page gains a **Reacting to component
  events** section tabulating every event (`hc:menuselect`,
  `hc:comboboxselect`, `hc:multicomboboxchange`, `hc:commandselect`,
  `hc:calendarchange`, `hc:otpchange` / `hc:otpcomplete`,
  `hc:splitterchange`, `hc:togglegroupchange`, `hc:tabactivated`) with
  inline `_="on hc:…"` handlers, and notes the same events drive htmx
  via `data-hx-trigger`. Each of the event-emitting components added
  this cycle (calendar, command, input OTP, toggle group, splitter,
  context menu) gains a short **Hyperscript** snippet linking to it.

- Build optimization & granular imports (plan §5.4). Three consumption
  shapes so consumers pay only for what they use:
  - **Per-component CSS**: new `./css/*` exports (e.g. `./css/button` →
    `dist/hc-button.css`) plus a shared `./css/core` (`hc.core.css` =
    layer declaration + core tokens + base). Load `css/core` once, then
    only the component CSS you use. A ~6-component app drops from the
    ~26–62 KB-gzip full payload to roughly ~20 KB.
  - **Per-theme-axis token files**: `build-tokens.mjs` now also emits
    `hc.tokens.core.css` (semantic + default colour/density + dark) and
    one file per non-default axis (`hc.tokens.color-indigo.css`,
    `…-emerald/-rose/-amber`, `…density-compact/-dense`), exposed via
    `./tokens.*.css`. Apps load only the runtime axes they switch, and
    authors get a template for custom axes. `hc.tokens.css` (full)
    stays a concatenation of these.
  - **Minified single-file bundles** via a new `esbuild` devDependency +
    `scripts/minify.mjs` (`build:min` step): `hc.min.css`
    (30.6 → **14.1 KB gzip**), `hc.core.min.css` (**4.0 KB**),
    `hc.behaviors.min.js` (31.5 → **12.1 KB gzip**, bundled so the
    relative-import graph is no longer exposed to consumers),
    `hc.min.js`, and `macros/index.min.js`. The script prints a
    raw/min/gzip size report. (Minification helps unusually much here
    because it strips the source's doc comments, which gzip only
    partially compresses.)

  All new `exports` are additive — `.`, `./css`, `./behaviors`,
  `./macros` are unchanged — adding `./min`, `./css/min`, `./css/core`,
  `./css/core/min`, `./css/*`, `./tokens.*.css`, `./behaviors/min`,
  `./macros/min`; `sideEffects` lists the minified behaviors bundle. The
  per-file ESM + per-component CSS stay the primary tree-shakeable
  surface; the bundles are for CDN / import-map / no-bundler use. New
  docs page `reference/size.mdx` documents the size baseline and the
  full / granular / native-ESM-import-map shapes (including an
  `importmap-rails` recipe and a caching-tradeoff note). Two new Vitest
  cases cover the per-axis vs core token emission.

- Docs **Kitchen sink** page (`apps/docs/src/content/docs/kitchen-sink.mdx`)
  — every component rendered live on one page, grouped (Actions, Form
  controls, Navigation, Overlays, Feedback & status, Layout & data),
  with each heading linking to the component's full docs. Interactive
  components run their real behaviors (the docs site loads the behaviors
  bundle), so menus, the command palette, the splitter, the OTP field,
  etc. are all operable. Added a top-level "Kitchen sink" sidebar entry
  and a link from the Components index.

- `hc-scroll-area` component — pure CSS scrollable region with thin,
  themed scrollbars (shadcn `ScrollArea` equivalent), no JavaScript.
  Uses the **standard** CSS Scrollbars module (`scrollbar-width: thin`
  + `scrollbar-color`, Baseline 2025) rather than the non-standard
  `::-webkit-scrollbar` pseudo-elements (Firefox never supported them,
  and a set `scrollbar-color` overrides them anyway). The thumb darkens
  to `scroll-area.thumb-hover` on hover (the property cascades live, no
  JS). `data-orientation` selects the scroll axis — `vertical`
  (default), `horizontal`, or `both` — and `overscroll-behavior:
  contain` stops scroll chaining to the page. New
  `scroll-area.{thumb, thumb-hover, track}` tokens. Documented markup
  contract: a scrollable region must be keyboard-focusable, so add
  `tabindex="0"` (plus `role="region"` + `aria-label` when it's a
  meaningful landmark) — CSS can't add it, and axe's
  `scrollable-region-focusable` rule requires it. Playwright spec (5
  cases): the thin themed scrollbar (computed `scrollbar-width` /
  `scrollbar-color`), vertical block-axis overflow, horizontal
  inline-axis overflow, programmatic scrolling, and an axe-core scan.

  Out of scope (deferred): fully custom JS overlay scrollbars,
  scroll-edge fade / shadow, scroll-to buttons, and `::-webkit-scrollbar`
  rounded-thumb styling.

- `hc-splitter` component + `installSplitter` behavior. Resizable panels
  with a draggable handle (shadcn `Resizable` equivalent), following the
  WAI-ARIA **Window Splitter** pattern — closes the focusable-splitter
  deferral noted when `hc-separator` shipped. Two `.hc-splitter__panel`
  panes are split by a `.hc-splitter__handle` that becomes a focusable
  `role="separator"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` tracking the primary pane's size (percent),
  `aria-controls` pointing at it, and `aria-orientation` set
  automatically (a side-by-side split uses a `vertical` separator line,
  and vice-versa). Layout is plain flexbox driven by a single
  `--hc-splitter-pos` custom property. Pointer drag (handled at the
  document level so a fast drag still tracks) and keyboard resize
  (`←`/`→` or `↑`/`↓` by `data-step`, `Home`/`End` to min/max) both
  clamp to `data-min` / `data-max`. Config: `data-orientation`
  (`horizontal` default / `vertical`), `data-value` (initial %, default
  50), `data-min` / `data-max` (default 10 / 90), `data-step` (default
  5). Each change dispatches a bubbling `hc:splitterchange`
  (`detail { value, orientation }`). New `splitter.*` tokens (handle
  size / bg / hover, grip bar incl. themed active colour). Vitest spec
  (10 cases) covers ARIA wiring, `data-value`/`min`/`max`, arrow-step
  resize + custom-property sync, min/max clamp + Home/End, the change
  event, vertical-orientation key mapping, a mocked-rect pointer drag,
  uninstall, and MutationObserver. Playwright spec (5 cases incl.
  axe-core scan) covers the separator semantics, keyboard resize (with
  pane-width assertion), Home/End, a real handle drag, and a11y.

  Out of scope (deferred): three-or-more panes, collapse / expand
  toggling, persistence (`localStorage`), nested splitters, and
  pixel-based minimums.

- `hc-inputotp` component + `installInputOtp` behavior. A segmented
  one-time-code field (shadcn `InputOTP` equivalent) built on the
  accessible **single-input** approach: one real
  `<input autocomplete="one-time-code">` captures all typing, paste,
  SMS autofill, and selection, and the behavior overlays it
  transparently (transparent text + caret) and renders N decorative
  `aria-hidden` slots that mirror the value — avoiding the
  screen-reader and paste problems of the "one input per digit"
  pattern. Config via `data-length` (slot count, default 6; also sets
  `maxlength`) and `data-pattern` (allowed-character class, default
  `[0-9]`; non-matching characters are stripped on input). The behavior
  also fills in `inputmode="numeric"`, `autocomplete="one-time-code"`,
  and `type="text"` when omitted. The active slot's border (shown only
  while focused) doubles as the focus indicator and carries a blinking
  caret that respects `prefers-reduced-motion`. `aria-invalid` (on the
  input) / `data-invalid` (on the container) draws the error border;
  `disabled` mutes the slots. Events bubble from the container:
  `hc:otpchange` (`detail { value, input }`) on every edit and
  `hc:otpcomplete` when every slot is filled — pair with
  `data-hx-trigger="hc:otpcomplete"` to auto-submit. The value lives in
  a single named `<input>`, so it serialises in a form with no hidden
  fields. New `inputotp.*` tokens (gap, slot size, chrome, themed
  active-border / caret-color, invalid / disabled). Vitest spec (12
  cases) covers slot rendering + maxlength, custom length, autofill
  attribute defaults, character mirroring, numeric + custom pattern
  filtering, the focused-only active slot, change / complete events,
  pre-filled seeding, uninstall, MutationObserver. Playwright spec (6
  cases incl. axe-core scan) covers rendering, typing + active caret,
  pattern stripping, the complete event, the invalid border, and a11y.

  Out of scope (deferred): group separators (e.g. `3-3`), per-slot
  click caret placement, and RTL fine-tuning.

- `hc-calendar` component + `installCalendar` behavior. A styled,
  inline month-grid date picker (shadcn `Calendar` equivalent) —
  closes the `hc-calendar` deferral noted when `hc-datepicker` shipped.
  `installCalendar()` renders the grid into a `.hc-calendar` container
  (you author only the container + `data-*` config) following the
  WAI-ARIA APG date-picker pattern: a `role="grid"` `<table>` with
  `<td role="gridcell">` day cells managed by a roving tabindex, an
  `aria-live` month title, `aria-selected` on the chosen day, and
  `aria-disabled` for out-of-range days. Keyboard: `←`/`→` ±1 day,
  `↑`/`↓` ±1 week, `Home`/`End` week edges, `PageUp`/`PageDown` ±1
  month, `Shift`+`PageUp`/`PageDown` ±1 year, `Enter`/`Space` select;
  crossing a month edge re-renders the adjacent month with the target
  day focused. Config via `data-value` (ISO, also sets the displayed
  month), `data-min`/`data-max`, `data-first-day` (`0`=Sunday default …
  `6`), `data-locale`, and `data-name` (maintains a hidden `<input>` so
  it serialises in a form). Month / weekday names come from
  `Intl.DateTimeFormat`; the first day of the week is `data-first-day`
  rather than `Intl.Locale`'s `getWeekInfo()` (not yet Baseline).
  Selecting dispatches a bubbling `hc:calendarchange`
  (`detail { value: 'YYYY-MM-DD', date: Date }`) and syncs `data-value`.
  New `calendar.*` tokens (surface, title, nav buttons, weekday header,
  day cells incl. the themed `day-selected-bg`, today ring, outside /
  disabled). Vitest spec (15 cases) covers grid render, weekday order
  per `data-first-day`, selection (aria-selected / data-value / hidden
  input / event), prev/next buttons, arrow nav + month crossing,
  PageDown / Shift+PageDown, Home/End, min/max disable + refusal,
  today / outside markers, uninstall, MutationObserver. Playwright
  spec (7 cases incl. axe-core scan) covers render, click select +
  event, keyboard month crossing, PageDown, the next button, min/max
  disabled, and a11y.

  hc-datepicker (the native `<input type="date">` skin) remains the
  no-JS baseline; hc-calendar is the opt-in styled grid. Out of scope
  (deferred): range selection, multiple months side by side, month /
  year dropdown pickers, week numbers, time, non-Gregorian calendars,
  and an input-attached combobox variant.

- `hc-command` component + `installCommand` behavior. A command palette
  (shadcn `Command` / `cmdk` equivalent): the WAI-ARIA combobox pattern
  used as an action launcher. An `<input role="combobox">` filters a
  `role="listbox"` of `role="option"` items grouped under `role="group"`
  headings (the cmdk / Radix `<div>` structure — not `<ul>/<li>`, which
  axe rejects `role="group"` on). `installCommand()` wires the
  case-insensitive substring filter (matching each item's label, with
  the `.hc-command__shortcut` text excluded), hides groups whose items
  all filter out, toggles a `.hc-command__empty` state, and drives
  `aria-activedescendant` keyboard navigation (`↓`/`↑` wrap and skip
  disabled, `Home`/`End`, `Enter` runs the active item) with DOM focus
  staying on the input. Selecting dispatches a bubbling
  `hc:commandselect` (`detail { item, value, command }`, `value` from
  `data-value`) and, inside a `<dialog>`, closes it. Optional ⌘K opener:
  `data-hotkey="k"` (any key, default `k`) on the dialog
  toggles it with Cmd/Ctrl + key (`preventDefault` so the browser's own
  shortcut doesn't also fire), focusing the input and resetting the
  filter on open; the filter also resets on dialog `close`. Used inside
  a native `<dialog class="hc-command-dialog">` it inherits focus
  trapping, Escape-to-close, and a backdrop; works inline too. New
  `command.*` tokens (surface, input, list, group heading, item +
  `item-active-bg` highlight that tracks `data-color`, shortcut chip,
  empty state, dialog width / offset / backdrop). Vitest spec (13
  cases) covers initial highlight, label filter + group hide + empty
  state, shortcut excluded from match, arrow wrap + disabled-skip,
  Home/End, Enter select + event detail + dialog close, click select +
  disabled no-op, ⌘K toggle + input focus, filter reset on close,
  uninstall cleanup, MutationObserver pickup. Playwright spec (8 cases
  incl. axe-core scan in the open state) covers ⌘K open + focus,
  filtering + group hiding, empty state, Arrow+Enter and click select,
  the shortcut chip, and Escape close.

  Out of scope (deferred): async / server-supplied commands, nested
  "pages", fuzzy ranking, recent / frequency ordering, multi-key
  chords.

- `hc-context-menu` — right-click / keyboard context menu built on the
  existing `hc-menu` surface (shadcn `ContextMenu` equivalent), via the
  new `installContextMenu` behavior. **No new CSS**: it reuses
  `.hc-menu` and all its items / separators / labels / `menuitemcheckbox`
  / `menuitemradio`, opening at the pointer instead of anchored to a
  trigger. A region carries `data-hc-context-menu="<menu-id>"` pointing
  at a `.hc-menu` popover. On `contextmenu` (right-click, long-press, or
  the keyboard Menu key) the native menu is suppressed
  (`preventDefault`) and the popover opens at the pointer, clamped to
  the viewport. `Shift`+`F10` is handled separately via `keydown`
  because — unlike the Menu key — it does not fire a `contextmenu`
  event; it opens the menu at the focused element. Once open, navigation
  (Arrow / Home / End / type-ahead / Tab) and selection
  (`menuitemcheckbox` / `menuitemradio` toggling, the bubbling
  `hc:menuselect` event) are shared with the dropdown menu; the event
  detail adds `contextTarget` (the right-clicked element). Escape /
  outside-click dismissal and focus restoration are the native
  `popover` behaviour. Documented caveat: Firefox's Shift+right-click
  bypasses the `contextmenu` event and shows the browser's own menu.

  The shared menu interaction logic (item queries, roving-focus
  movement, type-ahead, the keyboard handler, and the
  checkbox / radio + `hc:menuselect` selection) was extracted from
  `menu.js` into a new internal `menu-core.js` module that both
  `installMenu` and `installContextMenu` consume, so the two surfaces
  stay in lockstep. `installMenu`'s public behaviour is unchanged
  (all 23 existing menu Vitest + 10 Playwright cases still pass).
  Vitest spec (11 cases): idempotency, open + `preventDefault`, pointer
  positioning, first-item focus, `Shift`+`F10` (and plain `F10` no-op),
  arrow / End navigation with disabled-skip, menuitem select +
  `contextTarget` detail + close, checkbox toggle keeps open, missing-id
  no-op, uninstall cleanup, MutationObserver pickup. Playwright spec
  (7 cases incl. axe-core scan in the open state) covers real
  right-click, pointer coordinates, `Shift`+`F10` + Escape focus
  restoration, keyboard nav, and selection.

  Out of scope (deferred): nested submenus, stacked context menus,
  touch long-press tuning.

- `hc-separator` component — pure CSS divider line, no JavaScript.
  Apply `.hc-separator` to a native `<hr>`: the element already carries
  the implicit `role="separator"` + `aria-orientation="horizontal"`
  semantics, so the component only replaces the UA chrome with a single
  hairline drawn from a token. `data-orientation="horizontal"`
  (default) is a full-width line with block margin;
  `data-orientation="vertical"` is an inline line that stretches to its
  flex row's height (via `align-self: stretch`, with a `min-block-size`
  fallback) and takes inline margin — for toolbars and link rows. Since
  there is no HTML element for a vertical separator, the docs flag that
  `aria-orientation="vertical"` must be added by hand to keep the
  semantics right. New tokens `separator.{color, size, spacing}`
  (`color` defaults to the border token). Playwright spec (5 cases):
  the implicit separator role, the thin full-width horizontal line, the
  taller-than-wide vertical line, the border-token colour, and an
  axe-core scan.

  Out of scope (deferred): a focusable resize splitter
  (`aria-valuenow`), labelled separators, and a decorative
  `role="none"` toggle.

- `hc-toggle-group` component + `installToggleGroup` behavior. A
  connected row of two-state toggle buttons (shadcn `ToggleGroup`
  equivalent) with two selection modes selected by `data-type` on the
  group and reflected by the ARIA roles on the buttons:
  - `data-type="single"` (default) — exclusive. Per the WAI-ARIA APG,
    an exclusive set of toggles is a **radio group**, so the markup is
    `role="radiogroup"` + `role="radio"` / `aria-checked`. Selection
    follows focus (arrow keys move and select) and a click can never
    empty the group (radio semantics).
  - `data-type="multiple"` — independent toggles: `role="group"` +
    `aria-pressed`. Arrow keys move focus only; Space / Enter / click
    toggle the focused button on and off.

  Both modes use a roving tabindex so the group is a single `Tab`
  stop, wrap at the ends, and skip disabled buttons (`disabled` or
  `aria-disabled="true"`). Space / Enter are left to the native
  `<button>` (which synthesise a click), so the behavior only binds
  Arrow / Home / End — no double-firing. Each change dispatches a
  bubbling `hc:togglegroupchange` (`detail` carries `value` for single
  or `values` + `pressed` for multiple, read from each button's
  `data-value`). Optional form integration: `data-name="X"` makes the
  behavior maintain hidden inputs (one for single, one per pressed
  value for multiple) so the group serialises like a native control.

  CSS is a connected segmented-control skin — shared inner borders
  collapse to a hairline, outer corners round via `:first/:last-of-type`
  (so the injected hidden-input `<span>` does not steal the last
  toggle's radius), and the selected / pressed state lifts above its
  neighbours with an accent background + border that track the active
  `data-color` theme through `{semantic.color.action.primary-soft.bg}`
  / `{...primary.border}`. Sizes `data-size="sm" | "md" | "lg"` draw
  from the shared `--hc-control-*` scale (density-aware). New tokens
  `toggle.{height, padding-x, radius, font-size, font-weight, fg, bg,
  border, hover-bg, hover-fg, on-bg, on-fg, on-border, disabled-fg,
  disabled-bg, sm.*, lg.*}`, all `{ref}` so the overlay machinery
  handles theming. Vitest spec (14 cases) covers idempotency, single
  roving-tabindex / exclusive select / no-op on already-checked /
  arrow select+skip-disabled / Home / End, multiple toggle + arrow
  moves focus only, the event detail shape, the `data-name` hidden
  inputs for both modes, the `:last-of-type` invariant with the hidden
  container present, uninstall cleanup, and MutationObserver pickup.
  Playwright spec (9 cases incl. axe-core scan) exercises the roles,
  keyboard, accent border, and sizing in a real browser.

  Out of scope (deferred): vertical orientation (`data-orientation`),
  a default/outline variant axis, and free deselect in single mode
  (radio semantics intentionally keep the group non-empty).

- `hc-skeleton` component — pure CSS loading placeholder, no
  JavaScript. Apply `.hc-skeleton` to any element and size it from the
  consumer side; the component supplies the surface colour, corner
  radius, and animation. The base surface is `var(--hc-color-muted-bg)`
  so it adapts to light / dark mode through the existing `data-theme`
  cascade with no per-mode overrides. Two axes:
  `data-animation="pulse" (default) | "wave" | "none"` — pulse fades
  the block (shadcn's `animate-pulse`), wave sweeps a lighter highlight
  band whose colour is derived from the base via `color-mix()` (so it
  tracks the active theme), none is static; and
  `data-shape="rect" (default) | "text" | "circle"` — rect uses the
  medium radius, text is a `1em` line with a tighter radius, circle is
  fully rounded with `aspect-ratio: 1` for avatar / icon slots. Both
  animations collapse to a flat static block under
  `prefers-reduced-motion: reduce`. New tokens
  `skeleton.{bg, highlight, radius, text-radius, text-height,
  pulse-duration, wave-duration}`. Recommended a11y pattern documented:
  mark the loading region with `role="status"` + `aria-busy="true"` +
  an accessible name rather than annotating each decorative block.
  Playwright spec (8 cases) covers the muted base colour, the pulse /
  wave / none animation-name swap, the circle / text shape radii, the
  `prefers-reduced-motion` suppression (via `emulateMedia`), and an
  axe-core scan.

  Out of scope (deferred): row-count auto-generation helper,
  image / table-specific presets, and a skeleton→content swap behavior
  (the consumer drives the swap via htmx or a re-render).

- `hc-datepicker` component — pure CSS skin over a native `<input>`
  whose `type` is `date`, `datetime-local`, `month`, or `time`. The
  native input keeps every accessible behaviour (keyboard
  navigation across year / month / day spinners, the OS-native
  calendar / time picker on mobile, form submission, `min` / `max`
  / `step` validation, locale-aware rendering); only the closed-
  state chrome is replaced via `appearance: none` and an embedded
  SVG icon (calendar for date / datetime / month, clock for time).
  The WebKit native indicator is hidden so a single visible icon
  reads consistently across engines; clicks anywhere on the input
  still open the picker. Same axes as the other form controls —
  `data-variant="success" | "warning" | "error"` for border-colour
  cues, `data-size="sm" | "md" | "lg"` driven from the shared
  `--hc-control-*` scale (so `data-density="compact"` shrinks
  consistently), `:disabled` / `aria-invalid` states. New
  `datepicker.{height, padding-x, radius, font-size, bg, fg,
  border, focus-border, error-border, success-border,
  warning-border, disabled-bg, icon-size, sm.*, lg.*}` tokens, all
  `{ref}` so the overlay machinery handles theming. Playwright
  spec (10 cases) covers the native `type` attribute and form
  value, both calendar and clock SVG icons, focus ring, error /
  success variant borders, disabled state, sm / lg sizing, native
  `change` event firing, and an axe-core scan.

  Out of scope (deferred): fully-styled calendar grid (a future
  `hc-calendar` component for cases that need design-system-
  consistent month UI), preset shortcuts ("Last 7 days"), Japanese
  imperial-era / Buddhist calendar (browser handles via locale),
  multi-thumb date range (use two adjacent inputs with linked
  `min` / `max` per the documented pattern).

- `hc-hovercard` component + `installHovercard` behavior. Richer-
  content sibling of `hc-tooltip` for previews that need an avatar,
  title and subtitle, paragraph description, or interactive links
  (GitHub-style `@user` mention previews, issue ID previews, page
  link previews). Trigger references the card via
  `aria-describedby`, same as tooltip. Built on the same
  primitives — HTML `popover` (still `manual` because Safari has
  no `popover="hint"` support as of 2026-05), CSS Anchor
  Positioning, JS positioning fallback. Three behavioural
  differences from tooltip:
  - the card receives pointer events so users can move the cursor
    in and click links inside;
  - the behavior tracks hover state on **both the trigger and the
    card** — the card stays open while either is hovered, so the
    short cursor traversal between them does not dismiss it;
  - show / hide delays are longer (500 ms / 200 ms) for the
    reading-card UX.

  Focus on the trigger shows the card immediately (a11y); Escape
  on either trigger or card hides it. CSS layout is
  `.hc-hovercard__header` (with `.hc-hovercard__title` /
  `.hc-hovercard__subtitle`), `.hc-hovercard__body`, optional
  `.hc-hovercard__footer`. New tokens
  `hovercard.{bg, fg, border, radius, max-width, padding, gap,
  offset, title-weight, subtitle-fg, subtitle-size}`, all `{ref}`.

  Vitest spec (12 cases) covers idempotency, auto-attribution,
  show delay, immediate focus open, hide grace period, hover-into-
  card cancellation of the hide timer, hover-out-of-card schedules
  hide, Escape closes, mouseleave during show delay cancels,
  no-id no-op, uninstall cleanup, MutationObserver pickup.
  Playwright spec (6 cases incl. axe-core scan) exercises the
  real popover algorithm and the cursor-into-card path.

- `hc-drawer` component + `installDrawer` behavior. Slide-in side
  panel styled over the native `<dialog>` element. The native
  dialog gives us focus trapping, `Escape`-to-close, and the
  `::backdrop` layer; HC adds edge positioning (`data-side="right"`
  default, plus `"left"`, `"top"`, `"bottom"`) and CSS-only slide
  animation via `@starting-style` + `transition-behavior:
  allow-discrete` on `display` + `overlay`. The slide animation
  respects `prefers-reduced-motion: reduce`. `installDrawer()`
  adds exactly one thing the platform does not give us: clicking
  the backdrop (outside the drawer panel) closes it — detected via
  `event.target === dialog`. Everything else stays native, so
  `<form method="dialog">` close buttons need zero JS. Vitest spec
  (5 cases) covers idempotency, backdrop-click closes, inside-body
  click does NOT close, uninstall cleanup, and MutationObserver
  pickup. Playwright spec (8 cases incl. axe-core scan in the
  open state) checks both right and bottom anchors via bounding
  boxes, the native dialog close affordances (Escape and the form
  submit), and the backdrop-click behavior.

  Out of scope (deferred): swipe-to-close gesture, resizable
  drawers, stacked drawers, non-modal `show()` mode.

- `hc-multicombobox` component + `installMulticombobox` behavior.
  Multi-select combobox with a tag-input control: selected values
  render as inline chips inside a single visual surface, the
  filter input sits next to them, the listbox carries
  `aria-multiselectable="true"` and stays open after each pick.
  Architectural primitives are the same as `hc-combobox` (WAI-ARIA
  1.2 combobox, HTML `popover`, CSS Anchor Positioning,
  `aria-activedescendant` highlight with DOM focus on the input)
  plus tag chip + Backspace-removes-last-tag semantics.
  `installMulticombobox()` seeds tags from any
  `aria-selected="true"` options at install time (SSR-friendly),
  wires the full keyboard contract (↓/↑/Home/End/Enter/Backspace/
  Escape/Tab), runs the case-insensitive substring filter with a
  `.hc-multicombobox__empty` placeholder, and toggles selection on
  click + Enter without closing the listbox. Each tag is a focusable
  `<button>` with `aria-label="Remove …"` so screen-reader users can
  land on it and trigger removal. Optional form integration: setting
  `data-name="X"` on the wrapper makes the behavior write one
  `<input type="hidden" name="X" value="…">` per selected value, so
  the form serialises like a native `<select multiple name="X">`.
  Every state change dispatches `hc:multicomboboxchange` with
  `detail.{values, added, removed, input}`. New
  `multicombobox.{control, input, tag, listbox, option, empty-fg}`
  tokens, all `{ref}`. Vitest spec (14 cases) covers idempotency,
  SSR seeding, toggle semantics, Backspace-removes-tag (and the
  with-text negative case), disabled-skip, filter, the change
  event detail shape, Escape preserves selections, uninstall
  cleanup, opt-in hidden-input creation only when `data-name` is
  set, and MutationObserver pickup. Playwright spec (8 cases incl.
  axe-core scan in the open state).

  Out of scope (deferred): free-input create-on-Enter, drag
  reorder, async loading helper, rich option rendering with
  icons / descriptions.

- `hc-combobox` component + `installCombobox` behavior. Accessible
  single-select with type-to-filter, following the WAI-ARIA 1.2
  combobox pattern: the `<input>` carries `role="combobox"` and the
  dropdown is a `<ul role="listbox" popover>`. Keyboard navigation
  uses `aria-activedescendant` so the visible highlight moves with
  the user's selection while DOM focus stays on the input (the
  type-ahead anchor). Same architectural primitives as `hc-menu` and
  `hc-tooltip` — HTML `popover` attribute for show / hide + Escape +
  outside dismiss, CSS Anchor Positioning for placement under the
  input, JS positioning fallback for browsers without anchor support.
  `installCombobox()` wires ARIA (`aria-haspopup`, `aria-autocomplete`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`),
  auto-sets `popover="manual"` and the anchor name pair, runs the
  case-insensitive substring filter on every input keystroke,
  manages `↓ / ↑ / Home / End / Enter / Escape / Tab`, dispatches
  `hc:comboboxselect` with `{ value, label, option, input }`, and
  inserts a `.hc-combobox__empty` `<li role="presentation">` placeholder
  when the filter yields nothing. `aria-disabled="true"` options are
  skipped by both keyboard nav and click selection. New tokens
  `combobox.{listbox.{bg, fg, border, radius, max-height,
  padding-block, min-width, offset}, option.{padding-x, padding-y,
  font-size, fg, hover-bg, active-bg, selected-bg, selected-fg,
  disabled-fg}, empty-fg}`, all `{ref}` so the overlay machinery
  handles theming. Vitest spec (12 cases): idempotency, ARIA wiring,
  focus opens, substring filter, arrow keys + disabled skip, Home /
  End, Enter select + event detail + input update, click select,
  Escape no-op on value, empty-marker insertion, uninstall cleanup,
  MutationObserver pickup. Playwright spec (9 cases incl. axe-core
  scan in the open state).

  Out of scope (deferred): multi-select (will ship as
  `hc-multicombobox`), built-in async loading helper (htmx pattern
  documented), strict / free-input mode toggle, rich option
  rendering with icons or descriptions.

- `hc-slider` component + `installSlider` behavior. Pure CSS skin
  over a native `<input type="range">` with a tiny JS shim. The
  native input retains every accessible behaviour (←/→/Home/End/
  PageUp/PageDown, form participation, screen-reader role + value);
  only the visual chrome is replaced via `appearance: none` plus
  per-vendor pseudo-elements (`::-webkit-slider-runnable-track`,
  `::-webkit-slider-thumb`, `::-moz-range-track`,
  `::-moz-range-thumb`, `::-moz-range-progress`).

  The 0→value portion of the track is filled differently per
  engine: Firefox uses the native `::-moz-range-progress` pseudo;
  WebKit / Chromium have no equivalent so the same effect is
  painted by a `linear-gradient` that reads a `--hc-slider-value`
  custom property (0-100 percentage). `installSlider()` keeps
  `--hc-slider-value` synchronised with each slider's current
  value via the `input` event — call it once and forget. Server-
  rendered pages can set the property directly via
  `style="--hc-slider-value: N"` so the fill renders correctly on
  first paint before JS loads.

  Variants: `data-variant="success" | "warning" | "error"`
  recolour the fill (both engines) and the thumb border. Sizes:
  `data-size="sm" | "md" | "lg"` scale track-height and thumb-size
  together. Disabled state lowers opacity and recolours the thumb
  border. Focus ring on the thumb via `--hc-color-focus-ring`.

  Vitest spec (8 cases): idempotency, initial value sync,
  `input`-event sync, non-zero min/max percent mapping,
  out-of-range clamping, degenerate min===max fallback, uninstall
  cleanup, MutationObserver pickup. Playwright spec (8 cases):
  native role + attributes, initial `--hc-slider-value`, keyboard
  + JS-driven updates, Home/End full-native traversal, sm vs lg
  sizing, disabled state, axe-core scan over six labelled
  instances.

  Multi-thumb range pickers (price-range, brightness-span) are out
  of scope — a native `<input type="range">` is single-thumb and
  that pattern requires a custom DOM shell. Two adjacent sliders
  with linked validation is the documented workaround.

- `hc-progress` component — pure CSS skin over a native
  `<progress>` element. The native element retains its
  `role="progressbar"` semantics and `value` / `max` attribute
  pair; only the visual chrome is replaced via `appearance: none`
  and per-vendor pseudo-elements (`::-webkit-progress-bar`,
  `::-webkit-progress-value`, `::-moz-progress-bar`). Determinate
  mode (with `value`) shows a smooth fill transition between
  states; indeterminate mode (no `value`) renders a CSS-only
  sliding gradient via a keyframe animation that respects
  `prefers-reduced-motion: reduce`. Variants:
  `data-variant="success" | "warning" | "error"` recolour every
  vendor pseudo. Sizes: `data-size="sm" | "md" | "lg"`. New
  tokens `progress.{height, radius, bg, fill, success-fill,
  warning-fill, error-fill, transition-duration,
  indeterminate-duration, sm.height, lg.height}`, all `{ref}` so
  theming flows through. Playwright spec (7 cases): native
  progressbar semantics + value attributes, default fill colour
  via `currentColor`, success / error variant fills, sm vs lg
  heights, indeterminate animation-name assertion, and an
  axe-core scan over seven labelled instances.
- `hc-avatar` component — pure CSS, no JavaScript. Apply
  `.hc-avatar` to an `<img>` for a photo avatar or to a `<span>`
  for an initials fallback when no image is available; both share
  the same circular surface, sizes, and shape variants. Image
  paths use `object-fit: cover` + `overflow: hidden` so any
  aspect ratio renders as a centred square crop. Sizes:
  `data-size="xs" | "sm" | "md" | "lg" | "xl"`. Shape:
  `data-shape="circle"` (default) / `"square"`. New
  `.hc-avatar-group` wrapper overlaps a row of avatars with a
  negative margin pull-back and a ring matching the page
  background, so trail-of-N patterns read cleanly. Tokens
  `avatar.{size, radius, square-radius, bg, fg, border, font-size,
  font-weight, xs.*, sm.*, lg.*, xl.*}`, all `{ref}`. Playwright
  spec (5 cases): circle vs square radius, distinct sizes,
  overlapping group margins, axe-core scan over seven labelled
  instances.
- `hc-switch` component — pure CSS over a native
  `<input type="checkbox" role="switch">`. The native input keeps
  every accessible behaviour (Space toggles, form serialisation,
  screen-reader announces "switch on/off" via the role override);
  only the visual chrome is replaced via `appearance: none`. iOS-
  style track with a `::before` thumb that slides on `:checked`
  via CSS `translate`. Same axes as the other form controls —
  `data-variant="success" | "error"` for checked-state tint,
  `data-size="sm" | "md" | "lg"`, disabled state, focus-visible
  ring driven by `--hc-color-focus-ring`. Thumb-slide transition
  respects `prefers-reduced-motion: reduce`. New
  `.hc-switch-label` cluster mirrors the
  `.hc-checkbox-label` / `.hc-radio-label` pattern. Tokens
  `switch.{width, height, thumb-size, padding, border-width,
  border, bg, thumb-bg, checked-bg, checked-border,
  success-checked-bg, error-checked-bg, disabled-bg, label-gap,
  sm.*, lg.*}`, all `{ref}` so theming carries through the
  overlay machinery. Playwright spec (9 cases) covers Space
  toggle, label click, checked tint, disabled state, success /
  error variant tints, sm vs lg sizing, native `change` event
  firing, and an axe-core scan.
- `hc-select` component — pure CSS skin over a native `<select>`,
  no JavaScript behavior. The underlying element keeps every
  native behaviour (keyboard, form submission, the OS picker on
  mobile, screen-reader semantics); only the closed state is
  restyled via `appearance: none` and an embedded SVG chevron so
  it matches `hc-button` / `hc-input`. Same axes as the other form
  controls: `data-variant="success" | "warning" | "error"` for
  border-colour cues, `data-size="sm" | "md" | "lg"` driven from the
  shared `--hc-control-*` scale, and `:disabled` / `aria-invalid`
  states. The dropdown picker itself stays browser-native — modern
  `appearance: base-select` (Chromium 135+) is left as an opt-in
  per-instance override so behaviour stays consistent in every
  browser. The chevron uses a hardcoded neutral stroke colour
  matching the SVG convention `hc-checkbox` / `hc-radio` already
  use. New `select.{height, padding-x, radius, font-size, bg, fg,
  border, focus-border, error-border, success-border,
  warning-border, disabled-bg, chevron-size, sm.*, lg.*}` tokens,
  all `{ref}` so the overlay machinery handles theming. The
  `hc-input` docstring was scoped to `<input>` / `<textarea>` only
  to remove the misleading note about applying it to `<select>` —
  pre-alpha and no consumers yet, so the API correction lands here
  rather than as a follow-up. Playwright spec (8 cases) covers
  chevron SVG render, focus ring, error / success variant
  borders, disabled state, sm / lg sizing, native `change` event
  firing (form integration), and an axe-core scan.
- `hc-breadcrumb` component — pure CSS, no JavaScript behavior.
  Semantic skeleton is `<nav aria-label="...">` → `<ol>` → `<li>`
  with `<a class="hc-breadcrumb__link">` for steps and
  `<span class="hc-breadcrumb__current" aria-current="page">` for
  the active page (deliberately not a link). Separators are
  injected via CSS `::before` on every item except the first,
  with `--hc-breadcrumb-separator` as the per-instance override
  hook — set any `content` value (a quoted string, escaped Unicode,
  or an `url()` SVG) in an `style="..."` or scoped stylesheet.
  Default glyph is `/`. Modern browsers exclude pseudo-content
  from the accessibility tree by default, so no extra
  `aria-hidden` work is needed for the separator. Optional
  `.hc-breadcrumb__ellipsis` styles a middle-truncation marker;
  an interactive "expand to dropdown" variant is deferred (a
  separate `installBreadcrumbExpand` behavior was sketched in the
  roadmap). New tokens
  `breadcrumb.{gap, font-size, separator-fg, link.fg, link.hover-fg,
  current.fg, current.font-weight}`, all `{ref}` so theming
  carries through. Playwright spec (6 cases) covers landmark
  semantics, the `aria-current` contract, default vs override
  separator glyph via `::before` computed-style, the ellipsis
  `aria-hidden` marker, and an axe-core scan.

- `hc-accordion` component — pure CSS, no JavaScript behavior.
  Skins the native `<details>` / `<summary>` elements: keyboard
  handling, the `open` attribute, and the `toggle` event all come
  for free from the browser. The single-open ("exclusive") variant
  is expressed declaratively via the
  [`<details name="...">` attribute](https://developer.mozilla.org/docs/Web/HTML/Element/details#name)
  — same `name` value on every item makes the browser enforce
  single-open semantics with zero JS (Chrome 120+, Firefox 130+,
  Safari 17.2+). Omit `name` for the independent multi-open variant.
  Components in scope: `.hc-accordion` (vertical container),
  `.hc-accordion__item` (the `<details>`), `.hc-accordion__trigger`
  (the `<summary>` with the default disclosure marker hidden),
  `.hc-accordion__icon` (chevron rotated 180° when `[open]`, with
  `prefers-reduced-motion` respect), `.hc-accordion__content`.
  Lazy htmx pattern documented:
  `data-hx-trigger="toggle once[target.open]"` fires exactly once,
  the first time an item opens. New tokens
  `accordion.{item.border-color, trigger.*, icon.*, content.*}`,
  all `{ref}` so the overlay machinery carries `data-color`
  through. Playwright spec (7 cases) covers click + keyboard
  toggling, exclusive vs independent variants, chevron rotation,
  and an axe-core a11y scan.
- `hc-tooltip` component + `installTooltip` behavior. Short, transient
  text label bound to a trigger via `aria-describedby`. Built on the
  HTML `popover` attribute and CSS Anchor Positioning, same baseline
  as `hc-menu`. `installTooltip()` auto-sets `popover="manual"` and
  `role="tooltip"` on every `.hc-tooltip`, wires every trigger
  referenced via `aria-describedby` (one tooltip can serve multiple
  triggers), and toggles the popover from:
  - `mouseenter` → show after 300 ms (industry-standard intent-to-
    hover threshold);
  - `mouseleave` → hide after 100 ms grace period (cancels a pending
    show if the cursor leaves during the delay);
  - `focus` → show immediately (no delay for keyboard users, per
    APG);
  - `blur` → hide immediately;
  - `Escape` while focused → hide without moving focus.

  We chose `popover="manual"` over the newer `popover="hint"` because
  Safari had no `hint` support as of 2026-05; `manual` + JS toggling
  achieves the same coexistence semantics (separate tooltips don't
  dismiss each other) everywhere `popover` is supported. CSS Anchor
  Positioning anchors the tooltip above the trigger by default with
  a `flip-block` fallback; browsers without anchor support get a JS
  `getBoundingClientRect` positioning hook that mirrors the same
  placement. The tooltip surface is `pointer-events: none` so it can
  never intercept clicks. New tokens `tooltip.{bg,fg,radius,padding-x,
  padding-y,font-size,max-width,offset}`, all `{ref}` so theming flows
  through the overlay machinery. Vitest spec (13 cases) covers
  idempotency, ARIA auto-attribution, all show / hide routes, delay
  semantics with fake timers, Escape, shared-tooltip across multiple
  triggers, and uninstall cleanup. Playwright spec (8 cases incl.
  axe-core a11y scan) exercises the real popover algorithm and
  asserts the anchored placement bounding box.
- `hc-menu` stateful items — `role="menuitemcheckbox"` and
  `role="menuitemradio"`. Mirrors shadcn's `DropdownMenuCheckboxItem`
  / `DropdownMenuRadioItem`:
  - **Checkbox**: click toggles `aria-checked` between `true` and
    `false`; multiple may be checked at once. Menu stays open so
    users can toggle several without reopening.
  - **Radio**: click sets this item's `aria-checked="true"` and
    every sibling within the same `[role="group"]` to `"false"`.
    Falls back to the menu container as the group when no explicit
    `<div role="group">` wrapper is present. Menu also stays open.
  - **`hc:menuselect.detail.checked`** carries the new boolean
    state for checkbox / radio clicks (undefined for plain
    `menuitem`).
  - New `<span class="hc-menu__label">` element styles a small
    muted heading above a group, pairable with `aria-labelledby` on
    the surrounding `<div role="group">`.
  - When the menu contains any checkable item, every item in it
    gets a reserved indicator column on the left via CSS `:has()`,
    so plain `menuitem`s align with the check / dot marker — no
    markup changes needed. Indicators are inline SVG via
    `background-image`, same pattern as `hc-checkbox` / `hc-radio`.

  Vitest spec adds 6 cases (checkbox toggle stays open, radio
  mutual-exclusion within group, plain `menuitem` still closes,
  `detail.checked` semantics, arrow nav across all three roles).
  Playwright spec adds 3 cases incl. the `::before` SVG indicator
  computed-style assertion. New tokens
  `menu.item.indicator-size` and the `menu.label.*` block, both
  written as `{primitive.*}` / `{semantic.*}` refs so the existing
  overlay machinery handles theming.

- `hc-menu` edge-aware collision flipping. Menus opened near a
  viewport edge now flip to stay inside it instead of getting
  clipped — the missing piece that kept the MVP menu out of
  production use. Two coordinated paths:
  - **CSS Anchor Positioning** (Chromium 128+, Firefox 147+, Safari
    26+): adds `position-try-fallbacks: flip-block, flip-inline,
    flip-block flip-inline;` to `hc-menu.css`. The browser tries the
    primary `block-end span-inline-end` placement first, then flips
    block / inline / both when overflow would occur. Zero JS, same
    behaviour shadcn ships via Radix's `collisionPadding`.
  - **JS positioning fallback** (Chromium 114-127, Safari 17-25,
    Firefox 125-146): extends `positionViaFallback` in `menu.js`
    with the equivalent measurement-based flip logic. Each branch
    mirrors the CSS path 1:1 so the user-visible behaviour stays
    consistent across modern and older browsers.
  Four new Vitest cases drive the JS path through all four flip
  combinations (no-flip, flip-block, flip-inline, flip-both) by
  stubbing the viewport and trigger / menu bounding rects. Two new
  Playwright cases mount edge-positioned triggers and assert the
  resulting menu bbox stays inside the viewport (the live test
  runs in Chromium ≥ 125 which exercises the CSS path).
- `hc-menu` component + `installMenu` behavior. WAI-ARIA APG action
  menu pattern built on three modern web standards: the HTML
  `popover` attribute (show/hide, light dismiss, native Escape), the
  `popovertarget` button attribute (declarative trigger ⇄ menu
  binding), and CSS Anchor Positioning (`anchor-name` /
  `position-anchor` / `position-area` — menu lands directly under
  the trigger). `installMenu()` wires the ARIA layer
  (`aria-haspopup`, `aria-expanded` synchronised with the popover
  `toggle` event, `aria-controls`), auto-assigns a unique anchor
  name per `[popovertarget=<id>]` pair, and adds the APG keyboard
  pattern: arrow keys / Home / End / type-ahead / Tab. Disabled
  items (`disabled` or `aria-disabled="true"`) are skipped. The
  first enabled menu item gets an `autofocus` attribute so the
  browser's popover algorithm — not racing JS — focuses it on open.
  On click, a bubbling `hc:menuselect` event carries
  `{ item, menu, trigger }` and the menu closes via
  `hidePopover()`. For browsers that lack CSS Anchor Positioning
  (Chromium < 125, Safari < 26, Firefox < 147), the behavior
  registers a `beforetoggle` handler that positions the menu via
  `getBoundingClientRect`; the menu remains functional everywhere
  `popover` is supported (Chromium 114+, Firefox 125+, Safari 17+).
  `data-variant="error"` recolours destructive items via
  `--hc-menu-item-error-fg`, mirroring shadcn's destructive
  variant. Vitest spec (13 cases) covers idempotency, ARIA wiring,
  anchor-name injection + JS positioning fallback, all keyboard
  routes, `hc:menuselect` dispatch, and uninstall cleanup; Playwright
  spec (10 cases incl. axe-core a11y scan) exercises the real
  popover algorithm.

### Changed

- Density tokens now use the same shadcn-style leaf emission as the
  colour themes (see next entry). `component.tokens.json` swaps
  `var(--hc-control-height)` / `var(--hc-control-padding-x)`
  literals for `{semantic.control.height}` /
  `{semantic.control.padding-x}` references, so each
  `[data-density]` block redeclares `--hc-button-height`,
  `--hc-button-padding-x`, `--hc-input-height`,
  `--hc-input-padding-x`, and `--hc-pagination-item-size` as resolved
  leaf values. A nested `<div data-density="compact">` now actually
  shrinks every control descendant; previously the var() chain was
  frozen at `:root` (40 px) and the nested attribute had no effect.
  Zero build-script changes — the overlay machinery added with the
  colour-theme fix already classified `density.*` sources the same
  way. Six new Playwright cases (`nested-density.spec.mjs`) cover
  button + input across all three density tiers.
- **Component-layer color tokens now emit as resolved leaf values per
  theme, mirroring shadcn / Radix Themes.** The old encoding placed
  `var(--hc-color-action-primary-bg)` literals inside the static
  `:root { component }` block. CSS custom properties resolve `var()`
  at the *declaring* element's computed-value time, so a nested
  `<div data-color="indigo">` could recolour `--hc-color-action-primary-bg`
  but every consumer (`--hc-button-primary-bg`, `--hc-checkbox-checked-bg`,
  `--hc-tabs-tab-indicator`, `--hc-input-focus-border`, …) had already
  baked the `:root`-level value and stayed blue. The same issue
  affected the v0.4 themes-page preview.

  Two coordinated changes:

  - `packages/core/src/tokens/component.tokens.json` — every
    `"$value": "var(--hc-color-action-*)"` and `"var(--hc-color-focus-ring)"`
    now uses the canonical `{semantic.color.action.*}` /
    `{semantic.color.focus-ring}` reference syntax. Also adds
    `semantic.color.action.primary-soft.bg` to `semantic.tokens.json`
    so the reference resolves at the semantic layer (previously it
    only existed under `color.*` files).
  - `packages/core/scripts/build-tokens.mjs` — new theme-overlay
    emission. Detects every semantic key that any runtime-themed
    source (`color.*`, `density.*`) redefines, classifies component
    leaves as theme-independent vs theme-dependent based on whether
    their resolution touches those keys, and emits theme-dependent
    leaves *inside each themed block* with that theme's resolved
    value. The `:root { component }` block only carries
    theme-independent leaves.

  Result: each `[data-color]` block now redeclares
  `--hc-button-primary-bg`, `--hc-checkbox-checked-bg`,
  `--hc-tabs-tab-indicator`, etc. as leaf colours — the shadcn
  pattern. Nested wrappers therefore cascade correctly and consumers
  can still override an individual `--hc-button-primary-bg` in any
  scope without touching the semantic layer.

  Token count climbed from 416 to 489 (~+18 KB raw on the unminified
  bundle). Three new Vitest cases cover the new emission rule, and a
  new Playwright `nested-theme.spec.mjs` (15 cases) probes computed
  styles across all five themes × three primitives.

### Fixed

- Docs site previews now actually behave on click and keyboard. The
  Starlight site loaded `@hypermedia-components/core/css` but never
  loaded the behaviors bundle, so interactive previews
  (`installTabs`, `installConfirm`, …) silently did nothing. Two
  changes:
  - `packages/core/package.json` `sideEffects` now lists
    `dist/hc.behaviors.js` and `src/js/behaviors.js`. The previous
    declaration only covered CSS files, so bundlers tree-shook the
    `import '@hypermedia-components/core/behaviors'` side-effect
    import — including the auto-init `DOMContentLoaded` listener.
    Every consumer that imports the auto-init entry benefits from
    this fix, not just our docs site.
  - `apps/docs/src/components/Head.astro` is a Starlight Head
    override that imports `@hypermedia-components/core/behaviors`.
    Resolved through the pnpm workspace, so no npm publish is
    required.

### Added

- `hc-tabs` component + `installTabs` behavior. Two markup patterns
  share the same classnames and visual style: an **app-state** variant
  (`<div role="tablist">` + `<button role="tab">` + `<div role="tabpanel">`)
  following the WAI-ARIA APG tabs pattern, and a **URL-routed** variant
  (`<nav>` + `<a href>` with `aria-current="page"`) that needs no JS.
  Variants: `default` (underline) / `pill`. Sizes: `sm` / `md` / `lg`,
  inheriting `--hc-control-*` from `data-density`. Active indicator
  references `--hc-color-action-primary-bg` so the colour theme cascades
  through `data-color`. `installTabs()` defaults to **manual activation**
  (APG-recommended when panels are htmx-loaded), with
  `data-activation="automatic"` to opt into focus-driven activation.
  Inactive panels carry `hidden="until-found"` so the browser's
  find-in-page can reveal them; the behavior listens for `beforematch`
  and auto-switches to the owning tab. When a panel becomes active, an
  `hc:tabactivated` event is dispatched on the panel (bubbles) so htmx
  can wire `hx-trigger="hc:tabactivated once"` for lazy loading. New
  Vitest spec (12 cases) and Playwright spec (6 cases incl. an axe-core
  a11y scan) cover keyboard navigation, manual vs automatic activation,
  disabled-tab skipping, `beforematch`, and the URL-routed variant being
  ignored by the behavior.
- `plans/hc-next-phase-plan-v0.5-en.md` — next-phase plan covering
  release readiness for `0.0.1-alpha.0`, MVP polish (form controls,
  density modes, hyperscript story), quality work (visual regression,
  build optimization), and a P3 backlog.
- TypeScript declarations (`.d.ts`) generated from JSDoc and shipped
  alongside the runtime modules. `packages/core/tsconfig.json` drives
  `tsc --emitDeclarationOnly --allowJs` into a staging directory; the
  existing `bundle-js.mjs` flattens the result so each entry in the
  `exports` map (`.`, `./behaviors`, `./macros`) has a sibling
  `.d.ts`. The `exports` map now declares `types` for `./behaviors`
  and `./macros` as well.
- `packages/core/test/types.smoke.ts` + `tsconfig.smoke.json` — a
  TypeScript smoke test that imports every public entry and is
  checked via `pnpm --filter @hypermedia-components/core typecheck`.
  The new `unit` CI job step runs it after the build so a regression
  in the public type surface fails CI.
- Density modes — closes v0.5 plan §4.2. New `data-density`
  attribute (`comfortable` / `compact` / `dense`) on `<html>` or any
  ancestor swaps `--hc-control-height` and `--hc-control-padding-x`
  to the values laid out in plan §9.3 (40/16 px → 32/12 px → 28/8 px).
  Three new token files under `packages/core/src/tokens/`
  (`density.{comfortable,compact,dense}.tokens.json`); a new
  `primitive.size.control.xs = 28px` entry; `build-tokens.mjs`
  registers the three sources with their own selector blocks. Button
  and input tokens now resolve their `height` / `padding-x` through
  `var(--hc-control-*)` indirection so a single attribute change
  cascades to every default-size control. Size variants
  (`data-size="sm"|"lg"`) keep their own dedicated vars and are
  unaffected. New docs page `tokens/density.mdx` with live preview;
  two new Vitest assertions cover the density block emission and the
  `var()` literal passthrough.
- Docs site theme + density sync — visitors can now toggle the
  Hypermedia Components density (`comfortable` / `compact` / `dense`)
  from a `<select>` next to Starlight's existing theme switcher, and
  the dark / light toggle now propagates to every component preview
  on the docs site automatically.
  - Theme: Starlight already writes `data-theme` to `<html>` and HC
    tokens listen for that exact attribute (`:root, [data-theme="light"]`
    / `[data-theme="dark"]` selectors). No code change — the cascade
    works because both sides use the same hook.
  - Density: new `apps/docs/src/components/SocialIcons.astro`
    overrides Starlight's `SocialIcons` slot to render the original
    GitHub link plus a styled density `<select>`. The choice persists
    to `localStorage['hc-density']` and is applied to `<html>` via
    an inline FOUC-prevention script declared through Starlight's
    `head` config in `apps/docs/astro.config.mjs`.
- Meta-integration pages — closes v0.5 plan §4.5. Two new docs pages
  round out the integrations section so the framework guides have a
  shared ground truth to link back to:
  - `apps/docs/src/content/docs/integrations/plain-html.mdx` — the
    simplest possible setup (copy dist files into a static folder,
    no template engine, no bundler), including a runnable minimal
    layout, theme / density toggles, and the "without htmx" CSS-only
    use case.
  - `apps/docs/src/content/docs/integrations/htmx.mdx` — the
    htmx-side conventions every framework guide currently repeats
    (htmx version, `data-hx-*` vs `hx-*`, `htmx:configRequest`
    hook for CSRF and arbitrary headers, `HX-Trigger` / `HX-Reswap`
    / `HX-Retarget` responses, the events the HC behaviors listen
    for, indicators, disabling controls during requests).
  - `integrations/index.mdx` now groups guides into "Foundations",
    "Server-side template engines", and "Client-side companions" so
    these foundational pages are the first thing a new reader sees.
- Hyperscript story — closes v0.5 plan §4.3. New
  `apps/docs/src/content/docs/integrations/hyperscript.mdx` page
  explains how to mount `_hyperscript` alongside Hypermedia
  Components and gives side-by-side equivalents for each behavior
  (`installConfirm`, `installToast`, `installCloseDialog`,
  `installClosePopover`, `installRemoteDialog`) so consumers can
  pick the form that fits the surface — vanilla helper, _hyperscript
  inline, or a mix. `recipes/confirm-action.mdx` gains a
  "Hyperscript alternative" section that links to the integration
  page and shows the same flow without `data-hc-confirm`. The
  integrations index now groups guides into "server-side template
  engines" and "client-side companions" so the new page slots in
  cleanly.
- Recipe source format — closes v0.5 plan §4.4. Every recipe under
  `recipes/<name>/` now ships the canonical three-file set:
  `recipe.html` (the short recommended snippet), `expanded.html`
  (the fully copy-pasteable HTML with every htmx attribute spelled
  out), and `contract.md` (server response shape — required
  endpoints, response headers, failure handling). Filled in the
  missing `recipes/request-action/recipe.html` and created the three
  scaffolds that did not exist yet — `recipes/toast/`,
  `recipes/inline-edit/`, `recipes/lazy-panel/`. `recipes/README.md`
  now indexes all nine recipes.
- `hc-checkbox` and `hc-radio` — closes v0.5 plan §4.1. Applied to a
  native `<input type="checkbox">` / `<input type="radio">`, the
  components keep every native behaviour (Space toggles, arrow-key
  navigation within a same-name radio group, form participation,
  assistive-tech announcements) and replace only the rendering via
  `appearance: none`. `data-variant` accepts `success` / `danger`.
  Checked state renders a white SVG glyph (check mark / inner dot)
  via `background-image`. Pair with `.hc-checkbox-label` /
  `.hc-radio-label` inline-flex wrappers, or with `hc-field` for
  fieldset-style groups. Two new docs pages and 10 new Playwright
  specs cover keyboard activation, label clicks, variants, invalid,
  disabled.
- Cloudflare Workers (Static Assets) deployment prep for the docs
  site:
  - [`wrangler.jsonc`](wrangler.jsonc) — Worker config, points the
    `ASSETS` binding at `apps/docs/dist`, `not_found_handling=404-page`,
    `run_worker_first=true`.
  - [`worker.mjs`](worker.mjs) — strips the
    `/hypermedia-components` base path from incoming URLs before
    forwarding to `env.ASSETS.fetch()`; redirects bare `/` to the
    base path. The base-path handling has to live in JS because
    Workers Static Assets `_redirects` does not honour `200`
    (rewrite) status codes.
  - [`apps/docs/public/_headers`](apps/docs/public/_headers) —
    long-cache for fingerprinted `_astro/*` assets, revalidate for
    HTML, baseline security headers (`X-Content-Type-Options`,
    `Referrer-Policy`, `Permissions-Policy`).
  - [`DEPLOYMENT.md`](DEPLOYMENT.md) — runbook for the unified
    Cloudflare Workers + Static Assets dashboard flow (project
    create, build / deploy commands, custom domain attach, Worker
    Route, rollback).

### Added

- `data-size="sm|md|lg"` on `hc-checkbox` and `hc-radio` — same
  vocabulary the button / input already speak, so every form
  control now sizes consistently. `sm = 0.875rem` (14 px), `md =
  1.125rem` (18 px, default), `lg = 1.375rem` (22 px). Independent
  of `data-density`: density only adjusts the `md` default; an
  explicit `sm` or `lg` stays fixed across density tiers so a
  deliberately-larger CTA-style checkbox doesn't shrink with a
  dense form around it.
- `data-variant="warning"` on `hc-checkbox` and `hc-radio` —
  completes the semantic intent trio `success / warning / danger`
  that the badge / alert / toast components already speak. Useful
  for forms where a checkbox represents a risky-but-allowed option
  ("Enable destructive backups"). Uses `semantic.color.warning`
  (amber.600) as the checked fill.
- New docs page `tokens/variants.mdx` — canonical cross-component
  matrix of every `data-variant` and `data-size` HC understands,
  with a written rationale for the deliberate asymmetries (e.g.
  buttons have no `success` variant, checkboxes have no `ghost`
  variant) so the matrix's gaps read as design choices rather than
  oversights.

### Changed

- **Breaking**: renamed the red severity variant from `danger` to
  `error` across the whole design system. Aligns with Material UI /
  Ant Design / Chakra / Carbon — the prevailing convention in
  modern enterprise design systems where the severity ladder reads
  `info → success → warning → error`. The previous `danger`
  naming was Bootstrap-era and clashed with the surrounding
  `warning` semantic. Touchpoints:
  - All `data-variant="danger"` attribute values across button /
    checkbox / radio / alert / badge / toast are now
    `data-variant="error"`.
  - All token paths `semantic.color.danger`,
    `semantic.color.action.danger.*`,
    `semantic.color.action.danger-hover.*`, plus component-layer
    `button.danger.*`, `button.danger-hover.*`,
    `checkbox.danger-checked-*`, `radio.danger-checked-*`,
    `alert.danger.*`, `badge.danger.*`, `toast.danger.*` are
    renamed by `danger → error`.
  - All CSS custom properties `--hc-color-danger`,
    `--hc-color-action-danger-*`, `--hc-{component}-danger-*` are
    renamed accordingly.
  - `installToast` checks `variant === 'error'` for
    `role="alert"` / `aria-live="assertive"` (was `'danger'`).
  - Docs (button / checkbox / radio / alert / badge / themes /
    variants), recipes (`confirm-action`), examples, fixtures,
    and Playwright specs are all updated.

  Emitted CSS *values* (red.600 / red.700 / etc.) are unchanged —
  every visual remains identical. This is a pure rename. Per the
  project's pre-alpha "no back-compat constraints" directive we
  did not ship a `danger` → `error` alias.
- `hc-checkbox` and `hc-radio` variant fills now reference the
  semantic colour tokens (`semantic.color.{success,warning,danger}`)
  directly rather than mixing primitive references and
  `semantic.color.action.danger.*`. Same emitted values; the
  refactor harmonises the token-graph shape so future colour
  customisation is uniform across the three variants.
- Density coverage extended to **table cells** and **checkbox /
  radio glyphs**. Previously a `data-density="compact"` or `"dense"`
  shrank buttons / inputs / container paddings but tables stayed
  roomy and checkbox / radio glyphs stayed at 18 px regardless —
  the layout felt half-tightened. Now:
  - `--hc-table-cell-padding-y` scales 8 → 6 → 4 px and
    `--hc-table-cell-padding-x` scales 12 → 8 → 6 px across the
    three tiers. Data tables, where density helps most, finally
    pick it up.
  - `--hc-checkbox-size` / `--hc-radio-size` step 18 → 16 → 14 px
    so the glyphs shrink in lockstep with the surrounding form
    controls.
  - Same direct-override pattern density already uses for control
    sizes — no component CSS changes; the density token files emit
    the same variable names at higher-specificity selectors and the
    cascade does the rest.
  - `tokens/density.mdx` gains a "Live preview — table and form
    controls" group rendering a 3-row table + checkbox + radio at
    each density tier, plus the new values in the variable table.
- `data-variant="secondary"` on `hc-button` — a filled neutral CTA
  that ranks under `primary` but above the outlined `default`. Closes
  a shadcn-style theme-token gap: a primary fill plus a neutral
  filled secondary is the standard SaaS / business-app two-tier
  action pattern, and HC was previously missing the second tier.
  - New semantic tokens `color.action.secondary.{bg,fg,border}` plus
    `secondary-hover.{bg,border}` in `semantic.tokens.json`. Light
    mode uses `gray.100` / `gray.900`; `theme.dark.tokens.json`
    overrides to `gray.700` / `gray.100` so contrast stays clean on
    dark surfaces.
  - New semantic `color.muted-bg` token (aliased to the same neutral
    grey) for subtle non-primary surfaces. Pairs with the existing
    `--hc-color-text-muted` foreground.
  - Component-level `button.secondary.*` / `button.secondary-hover.*`
    tokens resolve via `var(--hc-color-action-secondary-*)` so the
    light / dark cascade reaches the button automatically (same
    indirection pattern density and the colour themes already use).
  - Secondary is intentionally **not** theme-tinted — it stays a
    neutral grey in every `data-color` so primary remains visually
    distinct as the themed action. Documented in
    `tokens/themes.mdx`.
  - `hc-button.mdx` now shows the variant in the basic-HTML row and
    the variants table, with a written hierarchy
    (`primary > secondary > default > ghost`).

### Changed

- Color themes now reach further than just the primary action — the
  same `data-color` attribute also drives the **input focus border**,
  the **ghost button hover background**, and the **text ::selection
  highlight**. Three high-traffic interaction surfaces that used to
  stay a neutral grey / hard-coded blue regardless of theme now
  follow the active palette.
  - Added `--hc-color-action-primary-soft-bg` to every
    `color.{theme}.tokens.json` — a 12 % (18 % for amber) tint of
    the theme primary produced via `color-mix(... transparent)`. The
    transparency means the same value blends naturally on both light
    and dark surfaces; no per-mode variant required.
  - `component.tokens.json` swaps two more values to `var()`
    indirection:
    - `input.focus-border` → `var(--hc-color-focus-ring)` (previous
      build baked semantic.color.focus-ring as `#3b82f6`, so the
      input focus outline stayed blue even on indigo / emerald /
      rose / amber).
    - `button.ghost-hover.bg` → `var(--hc-color-action-primary-soft-bg)`
      (was a hard-coded `gray.100`).
  - `hc.base.css` adds a global `::selection { background-color:
    var(--hc-color-action-primary-soft-bg) }` rule so text-selection
    on any HC page becomes a low-key brand cue.
  - The themes docs page (`tokens/themes.mdx`) now exercises the
    full set in every per-theme preview row — primary button + ghost
    button + input + checkbox + radio + a snippet of selectable text
    — so you can see all five touchpoints at a glance.
- Color themes — five accent palettes (default / indigo / emerald /
  rose / amber) selectable via a `data-color` attribute on `<html>`
  or any subtree. Each theme overrides only the accent variables
  (`--hc-color-focus-ring`, `--hc-color-action-primary-*`,
  `--hc-color-action-primary-hover-*`); surface / background / text
  colours stay under the existing `data-theme` (light / dark) axis,
  and container spacing stays under `data-density`. The three axes
  cascade independently. The button / checkbox / radio / pagination
  component tokens now resolve their primary-action vars through
  `var(--hc-color-action-primary-*)` (the same indirection pattern
  density uses) so the swap propagates without component-CSS edits.
  - Five new files under `packages/core/src/tokens/`
    (`color.{default,indigo,emerald,rose,amber}.tokens.json`).
  - `primitive.tokens.json` gains `indigo` and `rose` scales plus
    the missing `green.500` and `amber.500` shades.
  - Each theme's primary shade is verified to clear WCAG AA
    contrast (≥ 4.5:1) for text-on-primary in both light and dark
    mode — emerald and rose use the `.700` shade, amber pairs the
    bright `.500` with dark text.
  - New docs page `tokens/themes.mdx` with a live preview row per
    theme and the full contrast table.
  - Starlight docs site picker — second `<select>` next to the
    existing density picker, persists to `localStorage['hc-color']`,
    pre-applied by the FOUC head script.
- Density now scales container paddings and gaps in addition to
  control sizes, so the whole layout tightens or relaxes evenly
  instead of leaving the buttons compact while cards and dialogs
  around them stayed roomy. The three density token files
  (`density.{comfortable,compact,dense}.tokens.json`) now also
  override `--hc-field-gap`, `--hc-toolbar-{gap,padding-y,padding-x}`,
  `--hc-card-padding`, `--hc-dialog-{padding,gap}`,
  `--hc-popover-padding`, `--hc-alert-{padding-block,padding-inline,gap}`,
  and `--hc-toast-{padding-y,padding-x,gap}`. Cascade flows the same
  way as the existing control vars — density files emit the same
  variable names at higher-specificity selectors so the override
  picks up automatically with no component-CSS changes. Total tokens
  emitted grew from 242 to 284 vars across the six selector blocks.
  `tokens/density.mdx` gains a container-tier preview (card +
  alert) at all three densities and a value table for the new vars.

### Fixed

- Density inverted the `sm / md / lg` button + input ordering at the
  `dense` tier. Earlier PRs scaled `md` (the default) with density
  but kept `sm` and `lg` at fixed primitive values, on the theory
  that "explicit `data-size` should be absolute, not relative."
  Under `data-density="dense"` that produced `md = 28 px` while
  `sm` stayed at `32 px` — the default ended up *smaller* than
  `sm`, which is obviously wrong. The whole size scale now shifts
  together so `sm < md < lg` holds at every density tier. New
  density-tier values:
  - **Button / input height** (`sm` / `md` / `lg`):
    32/40/48 (comfortable) → 28/32/40 (compact) → 24/28/32 (dense).
  - **Button / input padding-x**:
    12/16/20 (comfortable) → 8/12/16 (compact) → 6/8/12 (dense).
  - **Checkbox / radio size**:
    14/18/22 (comfortable) → 12/16/20 (compact) → 12/14/18 (dense).
  - `tokens/density.mdx` and `tokens/variants.mdx` updated to
    explain the relative-emphasis interpretation.


- Docs preview alignment — every `<div class="hc-preview">` wrapper
  in the component / token / recipe docs now also carries Starlight's
  `not-content` class so its descendants are excluded from the prose
  layer. Without that opt-out, Starlight applied `margin-top: 1rem`
  to every consecutive non-inline child of `.sl-markdown-content`,
  which gave each button / input after the first one a taller outer
  box and broke `align-items: center` inside the preview flex row
  (visible on the Button page as Save / Delete / Ghost sitting ~8 px
  below Default). `not-content` is Starlight's intended escape hatch
  for non-prose regions, so this also keeps prose rules for link
  colour, inline code background, heading colour, etc., from
  bleeding into future previews. Updated 25 preview wrappers across
  13 mdx files and documented the convention in
  `apps/docs/src/styles/preview.css`.

### Changed

- `CLAUDE.md` refreshed for the post-v0.4 state — references both
  plans, lists the implemented surface, documents the lint / test /
  test:browser / examples commands, and points at Track 1 as the
  next concrete move.
- `packages/core` `build` script now runs `build:types` (tsc) before
  `build:js` so the bundler can copy the freshly emitted declarations
  into `dist/`. `typescript` is a new `devDependency`.

---

## [Unreleased — v0.4 implementation]

Merged in PR #1 (squash commit `be72271`, 2026-05-28). The list below
is preserved verbatim for the eventual `0.0.1-alpha.0` release notes.

### Added

#### Tokens

- DTCG-shaped JSON sources under `packages/core/src/tokens/`:
  `primitive`, `semantic`, `component`, `theme.dark`.
- `scripts/build-tokens.mjs` resolves `{ref}` syntax across the four
  layers and emits `dist/hc.tokens.css` (209 custom properties across
  three selector blocks) wrapped in `@layer hc.tokens`. The transform
  is exported as `buildTokensCss({ sources, trees })` for testing.

#### CSS components

- `hc-button` — variants (`default`, `primary`, `danger`, `ghost`),
  sizes (`sm`, `md`, `lg`), focus ring, disabled, `[data-loading]`.
- `hc-input` — applies to `<input>`, `<select>`, `<textarea>`; sizes;
  `aria-invalid` styling.
- `hc-field` — composes label + control + message; `[data-invalid]`
  propagates the danger state.
- `hc-spinner` — CSS-only loading indicator; respects
  `prefers-reduced-motion`.
- `hc-dialog` — minimal styling for the native `<dialog>` element
  including `::backdrop`.
- `hc-popover` — minimal styling for the native `popover` attribute.
- `hc-card` — generic container with optional header / body / footer
  parts.
- `hc-table` — header band, hoverable rows, optional
  `data-density="compact"`.
- `hc-badge` — inline status pill with info / success / warning /
  danger variants.
- `hc-alert` — block-level notice with info / success / warning /
  danger variants and optional title.
- `hc-toast` + `hc-toast-region` — corner-pinned stack.
- `hc-toolbar` — horizontal cluster with separators and spacer.
- `hc-pagination` — page-link nav using `aria-current="page"`.

#### CSS infrastructure

- `hc.layers.css` declares the layer order
  `hc.tokens, hc.base, hc.components, hc.recipes, hc.utilities`.
- `hc.base.css` provides minimal normalization (box-sizing, body
  defaults).
- `hc.htmx.css` styles `.htmx-indicator`, `.htmx-request`, and the
  `.hc-action` wrapper.
- `scripts/bundle-css.mjs` concatenates the layers and per-component
  files into `dist/hc.css` and copies individual files for
  per-layer imports via the package `exports` map.

#### Behaviors

All behaviors are vanilla ESM, listen at the document level via event
delegation, and return an `uninstall` function. Calls are idempotent.

- `installConfirm` — intercepts clicks on `[data-hc-confirm]`, shows
  a shared `<dialog>`, and re-emits a bubbling `confirmed` event so
  htmx can listen via `data-hx-trigger="confirmed"`.
- `installToast` — renders `hc:toast` event payloads into the first
  `[data-hc-toast-region]`, mapping `variant="danger"` to
  `role="alert"` / `aria-live="assertive"`. Lazy-creates the region
  if absent.
- `installCloseDialog` — listens for `htmx:afterRequest`; on success
  closes the closest `<dialog>` of any element marked with
  `data-hc-close-dialog-on-success`.
- `installClosePopover` — same shape against `[popover]` and the
  `data-hc-close-popover-on-success` attribute.
- `installRemoteDialog` — listens for `htmx:afterSwap` on
  `[data-hc-remote-dialog-root]`; on swap finds the first `<dialog>`
  and calls `showModal()`.
- `@hypermedia-components/core/behaviors` auto-init entry installs
  all five on `DOMContentLoaded`.
- `scripts/bundle-js.mjs` copies ES modules to `dist/` for the
  package `exports` map.

#### Macros (optional Light DOM custom elements)

- `<hc-confirm-action>` — expands to the `.hc-action` + `.hc-button` +
  `.hc-spinner` markup of the confirm-action recipe with full
  `data-hx-*` / `data-hc-*` wiring. Attribute-driven; idempotent.
- `<hc-live-search>` — expands to the live-search form (label, input,
  optional submit) per §15.4 of the plan.
- Both build their expanded DOM via `createElement` + `setAttribute`
  (no string interpolation), and call `htmx.process(this)` when htmx
  is loaded.
- Registration entry at `@hypermedia-components/core/macros`.

#### Documentation (Astro Starlight)

40 pages generated, including:

- **Start** — introduction, installation, quick-start, philosophy.
- **Fundamentals** — naming, tokens.
- **Components** — `button`, `input`, `field`, `card`, `table`,
  `badge`, `alert`, `dialog`, `popover`, `toolbar`, `pagination`.
- **Recipes** — `request-action`, `confirm-action`, `live-search`,
  `toast`, `remote-dialog`, `filter-popover`, `data-region`,
  `inline-edit`, `lazy-panel`.
- **Integrations** — Thymeleaf (Spring Boot), Django, Rails, Go,
  Razor (ASP.NET Core). Each guide covers asset loading, fragment
  rendering, `HX-Trigger` toasts, and CSRF integration.
- **Reference** — `custom-elements` (macro contract).
- The docs site consumes `@hypermedia-components/core/css` as a
  workspace dependency so live previews render against the same CSS
  the package publishes.

#### Examples (runnable)

- `examples/plain-html/` — static gallery of every CSS component plus
  a toast trigger. Self-contained `serve.mjs` aliases
  `/hc.css`, `/hc.behaviors.js`, and `/macros/*.js` to the workspace
  dist.
- `examples/htmx/` — `index.html` demonstrating request-action,
  confirm-action, live-search, and HX-Trigger toasts against a
  zero-dep Node `server.mjs` with hardcoded items, `GET/POST/DELETE`
  on `/items`, and `GET /search`.

#### Tests

- **Vitest + jsdom** (`packages/core/test/`) — 73 unit / DOM tests
  across 7 files:
  - `tokens.test.mjs` — variable name derivation, transitive
    references, circular-reference detection, light/dark overrides.
  - `confirm.test.mjs` — dialog reuse, accept/cancel branching,
    variant fall-through, idempotent install, uninstall.
  - `toast.test.mjs` — region creation, role/aria-live mapping,
    auto-dismiss with `vi.useFakeTimers`, sticky toasts, preset
    region preservation.
  - `close-dialog.test.mjs`, `close-popover.test.mjs`,
    `remote-dialog.test.mjs` — htmx event flow + uninstall.
  - `macros.test.mjs` — upgrade idempotency, attribute mapping,
    `htmx.process` call.
  - `dom-setup.mjs` polyfills `HTMLDialogElement.showModal/close` and
    popover APIs for jsdom.
- **Playwright + Chromium** (`packages/core/test-browser/`) — 25
  end-to-end specs against a real browser, served by
  `test-browser/serve.mjs`:
  - `dialog.spec.mjs` — `showModal()`, Escape, focus, `:modal`.
  - `popover.spec.mjs` — native popover open/close, light-dismiss.
  - `confirm.spec.mjs` — focus-on-cancel default, `confirmed` event,
    Escape cancellation, dialog reuse.
  - `toast.spec.mjs` — region creation, role mapping, real timer
    auto-dismiss, stacking.
  - `macros.spec.mjs` — `<hc-confirm-action>` and `<hc-live-search>`
    upgrade timing and attribute output.

#### Governance and tooling

- `CONTRIBUTING.md` per plan §21.2 — project goals, design rules,
  tokens, testing matrix (unit + browser), docs style, a11y, commit
  conventions, release process.
- `CHANGELOG.md` (this file) per plan §20.3.
- `.github/PULL_REQUEST_TEMPLATE.md` with the §21.4 checklist.
- `.github/workflows/ci.yml` rewritten as three parallel jobs:
  - **unit** — `pnpm --filter @hypermedia-components/core build && test`.
  - **docs** — `pnpm -w run docs:build`, uploads `apps/docs/dist`.
  - **browser** — `playwright install --with-deps chromium` (cached)
    + `test:browser`, uploads report / traces on failure.
  - Concurrency cancels superseded runs on the same ref.

### Changed

- `packages/core` `exports` map now points `./macros` at
  `dist/macros/index.js` (was `dist/hc.macros.js`); per-macro files
  live next to the entry so relative imports resolve.

[Unreleased]: https://github.com/ingcreators/hypermedia-components/commits/main
