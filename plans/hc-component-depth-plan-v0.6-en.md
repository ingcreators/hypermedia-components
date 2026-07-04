# HC Component-Depth Plan v0.6 — native-first feature parity

Status: **shipped** (verified against origin/main on 2026-07-04). Every
track landed, including the two that were Baseline-gated at writing
time: B3 (breadcrumb ellipsis → `popovertarget` + `hc-menu`, docs
"Collapsed steps"), E2 (scroll-area `data-shadows`, scrolling-shadows
gradients — deliberately no scroll-driven animations), and F1
(accordion height animation behind
`@supports (interpolate-size: allow-keywords)`). Only **F2 remains
deferred**: `appearance: base-select` is still Chromium-only
("limited" per webstatus.dev, checked 2026-07-04); `hc-select.css`
records the decision and the dropdown stays native everywhere.
Originally proposed at the end of the v0.5 polish work, after PRs
up to #90 `feat(splitter): collapse toggle & localStorage persistence`.

This plan closes the highest-value gaps between existing HC components and
their shadcn/ui equivalents **without violating HC's principles**. It is a
companion to:

- [`hc-hypermedia-components-implementation-plan-v0.4-en.md`](./hc-hypermedia-components-implementation-plan-v0.4-en.md) — design principles, naming, DoDs.
- [`hc-next-phase-plan-v0.5-en.md`](./hc-next-phase-plan-v0.5-en.md) — release readiness + MVP polish.

## Guiding constraints (unchanged)

Every item below MUST stay inside these lines (CLAUDE.md):

- **Vanilla JS (ESM)** behaviors — idempotent `installXxx(root=document)`
  returning an uninstaller; no TypeScript.
- **Native-first / Light DOM only**; state in HTML attributes
  (`aria-*` / `data-*` / native validity), not JS state objects.
- **Semantic classes + `data-variant` / `data-size`**; DTCG tokens →
  `--hc-*` custom properties.
- **htmx owns the network.** Behaviors never wrap `fetch()`; async timing
  (debounce / cancel) stays with htmx (`delay:` / `hx-sync`).
- **Macros optional**; every macro documents its expanded HTML.
- **No back-compat** before `0.0.1-alpha.0` — rename aggressively, no aliases.
- **Check the web-standard baseline** before adopting any new CSS/HTML
  primitive; gate browser-bleeding-edge features behind a documented
  baseline and a JS fallback where it matters.
- Per-component **Definition of Done** (v0.4 plan §17.3 / §17.4): CSS API ·
  variants · states · CSS variables · a11y notes · ≥1 docs example · token
  references · docs builds · behavior tests (Vitest + Playwright incl. axe).

## Workflow (unchanged)

One concern per PR. Branch off **fresh `origin/main`** each time (no stacked
PRs). Verify locally before commit: `build`, `lint`, `test` (Vitest),
`typecheck`, `docs:build`, and the **full** Playwright browser suite. Commit
only when asked; merge only on the user's "マージして"; stop before merge and
report CI. Reply in Japanese; keep identifiers/code English. Never commit
the dev-only `.claude/` directory. Update `CHANGELOG.md` (Unreleased) for
every user-visible change.

---

## Tracks & backlog

Ordered by value ÷ cost. Each item is one PR unless noted.

### Track A — Quick wins (small, no baseline risk)

- **A1. Toolbar roving-tabindex arrow-key navigation.**
  `installToolbar()` adds APG Toolbar keyboard nav (←/→ or ↑/↓ by
  `aria-orientation`, Home/End, skip disabled, single tab stop). Reuse the
  roving-tabindex approach already in `toggle-group.js` / `datagrid.js`.
  Attribute opt-in is automatic for `.hc-toolbar[role="toolbar"]`.
  *DoD:* idempotent behavior + uninstaller; Vitest (focus movement, wrap,
  disabled skip, orientation) + Playwright (real Tab/Arrow) + axe.

- **A2. Avatar image load/error → fallback.**
  Tiny `installAvatar()` (or pure native `onerror`): when `<img>` fails or
  is empty, reveal the initials fallback and set `data-state="error"`;
  optional `data-delay` before showing the fallback to avoid flash. No
  network — just the native `error`/`load` events. Progressive: with JS off,
  the CSS fallback still shows behind a transparent broken img (document the
  trade-off).
  *DoD:* behavior + tests (error swaps to fallback, successful load hides
  it), docs "Image fallback" section.

- **A3. Tabs vertical orientation (`data-orientation="vertical"`).**
  CSS column layout for the tablist + `aria-orientation="vertical"`; the
  existing `installTabs()` roving nav switches ←/→ ↔ ↑/↓ off the attribute
  (same trick splitter uses). No new behavior surface.
  *DoD:* CSS + behavior arrow-axis swap; Vitest + Playwright (Up/Down moves
  tabs when vertical) + axe; docs "Vertical" section.

- **A4. Slider vertical orientation (`data-orientation="vertical"`).**
  Native-first: `writing-mode: vertical-lr` on `input[type=range]` (modern
  baseline) so the OS thumb/keyboard stay native. `installSlider()` keeps
  filling `--hc-slider-value`. **Baseline check required** for vertical
  range rendering across engines; document support + fallback.
  *DoD:* CSS + docs; Playwright check that Up/Down changes value; note the
  baseline. (Multi-thumb stays OUT — see "Explicitly out".)

### Track B — Menu / overlay depth

- **B1. Menu & context-menu submenus.**
  APG submenu pattern: a `menuitem` with `aria-haspopup="menu"` +
  `aria-expanded` owns a nested `role="menu"` popover, anchored to the
  parent item. Open on hover/→/Enter, close on ←/Escape; roving stays in the
  open submenu. Attribute-driven (`data-hc-submenu="<id>"` or a nested
  `.hc-menu` child). Reuse `menu-core.js`. Extends `hc-context-menu` for free.
  *DoD:* behavior + Vitest (open/close, focus return, keyboard) + Playwright
  + axe; docs "Submenus".

- **B2. Tooltip / popover / hovercard `data-side` + `data-align` + arrow.**
  CSS Anchor Positioning `position-area` driven by `data-side`
  (top/right/bottom/left) and `data-align` (start/center/end), with
  `position-try-fallbacks` for collision flipping, and an optional CSS
  `::before` arrow. The JS anchor-fallback already exists; extend it to honor
  the same attributes. **Baseline check** for `position-area` /
  `position-try`; keep the JS fallback authoritative where unsupported.
  *DoD:* CSS + fallback update; Playwright placement assertions; docs
  "Placement".

- **B3. Breadcrumb collapsible ellipsis.**
  Turn the static `…` into a `popovertarget` button opening a `.hc-menu`
  popover that lists the hidden steps. Pure attribute wiring on top of the
  existing menu/popover — minimal/no new JS. Progressive: with JS/popover
  off, the full trail is still in the DOM (document a responsive
  `data-collapse` threshold).
  *DoD:* docs "Collapsed steps"; Playwright (open reveals hidden links) + axe.

### Track C — Forms / date / search

- **C1. Calendar range selection (`data-mode="range"`).**
  Extend `installCalendar()`: track `start`/`end`, paint the in-range band
  (`data-in-range`, `data-range-start`, `data-range-end`), keyboard + click
  to set both ends, emit `hc:calendarrangechange { start, end }`. Form
  integration writes two hidden inputs (`data-name` → `name-start` /
  `name-end`) so it serializes for htmx without JS state. Keep single-date
  mode the default. (Multiple-months / week-numbers stay OUT for now.)
  *DoD:* behavior + Vitest (range math, clamp to min/max, keyboard) +
  Playwright + axe; docs "Range selection".

- **C2. Command fuzzy / scored filtering.**
  Replace the substring filter in `command.js` with a small, dependency-free
  scoring function (subsequence match + contiguity/word-boundary bonus) and
  reorder items by score; ties keep DOM order. Client-side only — no network.
  Optional `data-filter="substring"` to keep the old behavior.
  *DoD:* Vitest for the scorer (ranking cases) + Playwright (type narrows &
  reorders); docs note on matching.

- **C3. Input OTP per-slot active caret.**
  Render a blinking caret in the active slot and reflect the active index
  with `data-active` so authors can style it; respect
  `prefers-reduced-motion`. Behavior-only enhancement to `inputotp.js`.
  *DoD:* Vitest (active index tracks caret/selection) + Playwright; docs
  update; remove the "per-slot caret" line from Out-of-scope.

### Track D — Notifications / gestures

- **D1. Toast actions + lifecycle update (`hc:toast` / `HX-Trigger`).**
  Add an optional **action button** (`detail.action = { label, event }` →
  dispatches a bubbling event the author/htmx can catch, e.g. Undo) and an
  **update-by-id** path: a toast can carry `detail.id`; a later `hc:toast`
  with the same id updates the existing toast in place (e.g.
  loading → success/error). The *network* stays with htmx; we only model the
  UI states. Document the htmx promise pattern (request → `HX-Trigger`
  loading toast → response `HX-Trigger` success/error update).
  *DoD:* Vitest (action dispatch, update-by-id replaces not duplicates) +
  Playwright (click action fires event; second event updates) + axe; docs
  "Actions & updates".

- **D2. Drawer drag-to-dismiss.**
  Pointer-Events drag on the panel edge to dismiss past a threshold/velocity
  (reuse the toast swipe implementation), honoring `data-side`. Optional
  `data-snap` points as a follow-up. Backdrop-click close stays. Respect
  `prefers-reduced-motion` (no rubber-banding).
  *DoD:* Vitest (threshold math) + Playwright (real pointer drag closes;
  short drag snaps back) + axe; docs "Drag to dismiss".

### Track E — Layout

- **E1. Shell sidebar collapse-to-icon + persistence.**
  `data-collapsible` on `.hc-shell__sidebar` toggles a narrow icon-rail
  width via a `--hc-shell-sidebar-collapsed-width` var; a
  `data-hc-shell-collapse` button toggles it; `data-persist="<key>"` stores
  the collapsed state in localStorage (reuse the splitter persist helper
  pattern). Desktop only; mobile keeps the overlay.
  *DoD:* behavior extension + Vitest + Playwright (toggle + reload restores)
  + axe; docs "Collapsible sidebar".

- **E2. Scroll-area edge fade / shadow.**
  CSS-only top/bottom (or inline) fade or shadow that appears only when
  content overflows in that direction, via scroll-driven animations or a
  `mask`/gradient keyed off scroll position. **Baseline check** for
  scroll-driven animations; degrade to a static gradient. No custom overlay
  scrollbar (stays native).
  *DoD:* CSS + docs "Edge shadows"; Playwright visual/State assertions where
  feasible.

### Track F — Native-forward (baseline-gated; schedule when Baseline improves)

- **F1. Accordion height animation.** Animate `<details>` open/close via
  `::details-content` + `interpolate-size: allow-keywords` /
  `calc-size(auto)`. Pure CSS, no JS, fully progressive (no animation on
  unsupported engines). **Gate on Baseline**; ship behind a documented
  support note.

- **F2. Customizable native `<select>` (`appearance: base-select`).** Track
  the CSS `appearance: base-select` + `::picker(select)` work to style the
  *open* listbox while staying a native control (the native-first answer to
  Radix Select's custom dropdown). Forward-looking; revisit when Baseline
  widens. The `hc-combobox` remains the JS escape hatch meanwhile.

---

## Explicitly OUT (conflicts with HC principles — do NOT build)

- **Slider multi-thumb / range** — breaks the single native
  `input[type=range]`; keep the documented "two linked sliders" recipe.
- **Scroll-area custom overlay draggable scrollbar** — non-native; we use the
  CSS Scrollbars module. (Edge fade in E2 is fine.)
- **Datagrid client-side virtual scroll / full client-side data layer** — the
  grid is server-paged by design; client-side *sort of the already-rendered
  page* is acceptable, but a TanStack-style client data model is out.
- **Select fully-custom JS dropdown** — use `hc-combobox`; native `<select>`
  stays native (see F2 for the native-forward path).
- **Combobox / multicombobox built-in debounce / cancel-in-flight** — htmx
  owns request timing.
- **Toast doing its own network** — only the UI lifecycle is modeled (D1);
  htmx performs the request.

---

## Suggested sequencing (avoid stacked PRs)

1. A1 Toolbar nav → 2. A2 Avatar fallback → 3. A3 Tabs vertical →
4. B1 Submenus → 5. C1 Calendar range → 6. D1 Toast actions →
7. E1 Sidebar collapse → 8. B2 Placement/arrow → 9. C2 Command fuzzy →
10. D2 Drawer drag → 11. A4 Slider vertical → 12. C3 OTP caret →
13. B3 Breadcrumb ellipsis → 14. E2 Scroll fade → (F1/F2 when Baseline ready).

Re-evaluate priority with the user before each track; ship one PR at a time,
fresh off `origin/main`, and stop before merge.
