# HC Component-Breadth Plan v0.7 — closing the shadcn component gap (native-first)

Status: **shipped** (verified against origin/main on 2026-07-04). All
three tracks landed: G1–G5 (`hc-aspect`, `hc-kbd`, `hc-button-group`,
`hc-empty`, `hc-collapsible`), H1–H5 (`hc-carousel`, `hc-input-group`,
`hc-navmenu`, `hc-menubar`, `hc-item`), and I1 (spinner docs page).
Originally proposed after the v0.6 component-depth work merged,
PRs up to #108 `docs(select): track customizable-<select> roadmap`.

Where [v0.6](./hc-component-depth-plan-v0.6-en.md) deepened **existing**
components to native-first parity with their shadcn/ui equivalents, this plan
adds the **missing components** — the ones shadcn/ui ships that HC has no
equivalent for — again **without violating HC's principles**. Companion to:

- [`hc-hypermedia-components-implementation-plan-v0.4-en.md`](./hc-hypermedia-components-implementation-plan-v0.4-en.md) — design principles, naming, DoDs.
- [`hc-next-phase-plan-v0.5-en.md`](./hc-next-phase-plan-v0.5-en.md) — release readiness + MVP polish.
- [`hc-component-depth-plan-v0.6-en.md`](./hc-component-depth-plan-v0.6-en.md) — native-first parity on existing components.

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
every user-visible change. Confirm priority with the user before each track.

---

## Gap analysis (shadcn/ui → HC), June 2026

Cross-referencing the shadcn/ui registry against HC's current 40 documented
components (+ `hc-spinner.css` and the `confirm-action` macro):

### Genuinely missing → candidates in this plan

`Carousel` · `Navigation Menu` · `Menubar` · `Button Group` · `Input Group` ·
`Aspect Ratio` · `Kbd` · `Empty` · `Collapsible` (standalone) · `Item`.
Plus `Spinner` exists as CSS but has no documented component page.

### Already covered under a different name (do NOT rebuild)

| shadcn | HC equivalent |
| --- | --- |
| Alert Dialog | native `<dialog>` + `confirm-action` macro |
| Sheet | `hc-drawer` |
| Sidebar | `hc-shell` (collapse + persistence) |
| Resizable | `hc-splitter` |
| Dropdown Menu | `hc-menu` (with submenus) |
| Sonner / Toast | `hc-toast` (actions + update-by-id) |
| Radio Group | `hc-radio` |
| Data Table | `hc-datagrid` + `hc-table` |
| Textarea / Label | folded into `hc-input` / `hc-field` |
| Toggle (single) | `hc-toggle-group` |

### Out of scope by principle (see "Explicitly OUT")

`Chart` · `Form` (react-hook-form) · `Typography`.

---

## Tracks & backlog

Ordered by value ÷ cost. Each item is one PR unless noted. Sizes: **S**
(CSS-only / hours), **M** (CSS + a small behavior), **L** (new behavior with
real keyboard/overlay logic). Native-first fit ◎ > ○.

### Track G — CSS-only quick wins (no behavior, no baseline risk)

- **G1. Aspect Ratio (`hc-aspect`).** ◎ · **S**
  A ratio box via the `aspect-ratio` property (`data-ratio="16/9"` →
  `--hc-aspect-ratio`, default `1/1`); children (img/iframe/video) fill it
  with `object-fit: cover`. No JS. `aspect-ratio` is widely available
  (Baseline 2021) — no gate needed; document the one-line fallback
  (`padding-top` hack) only as a note.
  *DoD:* CSS + tokens (none required) + docs "Aspect ratio" with img/iframe
  examples; Playwright computed-ratio assertion.

- **G2. Kbd (`hc-kbd`).** ◎ · **S**
  A styled `<kbd>` for keyboard keys/shortcuts, with `data-size` and an
  inline group form (`<kbd class="hc-kbd-group">⌘ + K</kbd>`). The docs
  already render raw `<kbd>` in prose — promote it to a real token-driven
  component. No JS.
  *DoD:* CSS + tokens (`kbd.bg` / `fg` / `border` / `radius` / `font`); docs
  "Kbd"; a11y note (decorative vs. announced); Playwright style assertion.

- **G3. Button Group (`hc-button-group`).** ◎ · **S**
  Visually connect adjacent `.hc-button`s into a segmented control:
  collapse inner border-radii, share one border between neighbours, support
  `data-orientation="horizontal|vertical"`. Pure CSS over existing buttons —
  **not** a toggle (that is `hc-toggle-group`); this is purely presentational
  grouping (e.g. split buttons, pagination-like clusters).
  *DoD:* CSS only; docs "Button group" (incl. an icon-button row and a
  split-button with a `hc-menu` trigger); Playwright radius/adjacency check;
  axe.

- **G4. Empty (`hc-empty`).** ◎ · **S**
  An empty-state block: centered icon/illustration slot + `__title` +
  `__description` + optional `__actions`. Semantic structure (`role` left to
  context), token-driven spacing. Pairs naturally with htmx "no results"
  partial swaps. No JS.
  *DoD:* CSS + tokens; docs "Empty state" with a htmx empty-results example;
  Playwright layout assertion; axe.

- **G5. Collapsible (`hc-collapsible`).** ◎ · **S**
  A standalone single-disclosure skin over native `<details>`/`<summary>`,
  distinct from `hc-accordion` (which groups items and owns the
  `<details name>` exclusive behaviour). Lighter visual treatment for inline
  "show more" toggles. Reuse the F1 `::details-content` +
  `interpolate-size` height animation, **gated behind the same `@supports`**;
  fully progressive (native instant toggle elsewhere).
  *DoD:* CSS + tokens (reuse/extend accordion content vars); docs
  "Collapsible" + baseline note; Playwright open/close + axe.

### Track H — New interactive components (behaviors)

- **H1. Carousel (`hc-carousel` + `installCarousel()`).** ◎ · **M**
  A scroll-snap track is the source of truth: slides are plain HTML in a
  `scroll-snap-type` rail; prev/next buttons call `scrollIntoView` /
  `scrollBy`; an `IntersectionObserver` marks the in-view slide
  (`data-active`) and syncs optional dot controls + `aria-` state. Keyboard:
  ←/→ on the focused rail. **No animation library, no JS-driven transform** —
  native smooth scrolling does the motion. Optional `data-autoplay` is
  opt-in only and pauses on hover/focus and under
  `prefers-reduced-motion: reduce`. htmx-friendly (slides can be lazy-loaded
  partials). **Baseline:** CSS scroll-snap + `IntersectionObserver` are
  widely available; `scrollIntoView({behavior})` smooth degrades to instant.
  *DoD:* behavior + Vitest (active-index tracking, button enable/disable at
  ends, autoplay pause) + Playwright (real scroll + button nav moves active
  slide) + axe; docs "Carousel" (incl. the reduced-motion/autoplay note).

- **H2. Input Group (`hc-input-group`).** ◎ · **S–M**
  Compose an input with leading/trailing **addons** (text, icon, or a real
  `.hc-button`) sharing one bordered surface and a single focus ring via
  `:focus-within`. Mostly CSS; an optional tiny behavior only if a clear
  affordance (e.g. password reveal) is documented as a separate opt-in.
  Distinct from `hc-field` (label + help text); this is the control's inner
  composition. Works with htmx (the inner `<input>`/`<button>` carry the
  `data-hx-*`).
  *DoD:* CSS + tokens; docs "Input group" (search-with-button, prefix unit,
  password reveal); Playwright focus-ring + submit; axe.

- **H3. Navigation Menu (`hc-navmenu` + `installNavmenu()`).** ○ · **L**
  A top-level site nav whose items can open content **panels** (mega-menu).
  Built as a disclosure set: each trigger is a `button[aria-expanded]`
  controlling a `popover` panel anchored with CSS Anchor Positioning (reuse
  `anchor-fallback.js`); open on hover/focus with a small close delay,
  arrow-key/Escape handling, one open panel at a time. Plain links inside
  panels stay real `<a>` (htmx/MPA friendly). **Baseline:** Anchor
  Positioning is Baseline 2026 with the existing JS fallback; `popover` is
  baseline. Reuse `menu-core.js` + `anchor-fallback.js`.
  *DoD:* behavior + Vitest (open/close, single-open, focus/Escape) +
  Playwright (hover + keyboard opens the right panel; click-through links) +
  axe; docs "Navigation menu" with a responsive (mobile disclosure) note.

- **H4. Menubar (`hc-menubar` + `installMenubar()`).** ○ · **M**
  The desktop application menu bar pattern (File / Edit / …): a horizontal
  `role="menubar"` of menu buttons with **roving tabindex** (reuse the
  `installToolbar` roving logic), ←/→ between top items, ↓/Enter opens a
  menu, and submenus reuse the **B1 submenu** machinery from v0.6. Largely a
  composition of existing `hc-toolbar` + `hc-menu` behaviours.
  *DoD:* behavior + Vitest (roving, open/adjacent menu while open, Escape) +
  Playwright + axe; docs "Menubar".

- **H5. Item (`hc-item`).** ○ · **S–M**  *(lower priority — refactor primitive)*
  A generic list/option row primitive: `__media` (icon/avatar) + `__content`
  (`__title` / `__description`) + `__actions`, with `data-variant` and
  selectable/disabled states. Intended as the shared building block under
  command items, menu items, and plain lists so they look consistent. Mostly
  CSS; no new behavior. Ship only after auditing whether `hc-menu` /
  `hc-command` should be refactored onto it (avoid churn for its own sake).
  *DoD:* CSS + tokens; docs "Item"; Playwright layout/variant; axe. Note in
  the PR which existing components could later adopt it (follow-up, not in
  the same PR).

### Track I — Formalize existing CSS

- **I1. Spinner docs page + DoD (`hc-spinner`).** ◎ · **S**
  `hc-spinner.css` already exists and is used in lazy-load examples but has
  no documented component page. Promote it: document the CSS API, `data-size`
  / `data-variant`, the `role="status"` + `aria-label` / visually-hidden
  label a11y pattern, and `prefers-reduced-motion` behaviour (the animation
  must not stop conveying "busy" — keep an accessible label). Add tokens if
  any are hard-coded. No behaviour.
  *DoD:* docs "Spinner"; token audit; Playwright (animation present;
  reduced-motion still exposes the status name); axe.

---

## Explicitly OUT (conflicts with HC principles — do NOT build)

- **Chart** — data visualization (shadcn wraps Recharts). Outside a semantic
  CSS + htmx kit. If charting is ever needed, the answer is a server-rendered
  SVG/`<canvas>` *recipe*, not a component.
- **Form (react-hook-form equivalent)** — HC's form story is **native form +
  Constraint Validation API + htmx**, with `hc-field` for labels/errors.
  There is no client-side form-state library to mirror, by design.
- **Typography** — docs prose is owned by Astro Starlight; the type scale
  already lives in the design tokens. No standalone component.
- **Carousel autoplay-by-default / infinite-loop transform engine** — autoplay
  is opt-in and motion-safe only; no JS transform/animation engine (native
  scroll-snap is authoritative).
- **Item as a forced refactor** — do not rewrite menu/command onto `hc-item`
  in the same PR; introduce the primitive first, migrate later if it pays off.

---

## Suggested sequencing (avoid stacked PRs)

Quick CSS wins first (cheap, no baseline risk), then the interactive set:

1. G2 Kbd → 2. G1 Aspect Ratio → 3. G3 Button Group → 4. I1 Spinner docs →
5. G4 Empty → 6. G5 Collapsible → 7. H2 Input Group → 8. H1 Carousel →
9. H4 Menubar → 10. H3 Navigation Menu → 11. H5 Item (last; refactor primitive).

Re-evaluate priority with the user before each track; ship one PR at a time,
fresh off `origin/main`, and stop before merge.
