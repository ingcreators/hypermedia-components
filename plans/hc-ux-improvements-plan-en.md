# UX improvements — designer-review follow-ups

Status: **approved** (2026-07-09). Eight items, implemented in the
priority order below, one PR each (PR-1 … PR-8). Findings come from a
UX review of the deployed site (screenshots + behavior probes) on
2026-07-09.

## Findings → work items

| # | Finding | Fix |
| --- | --- | --- |
| 1 | Sticky toasts (`duration: 0`) have **no visible dismiss affordance** — swipe, Escape-when-focused and action buttons are all undiscoverable for mouse users | Visible close button on every toast |
| 2 | Under `data-invalid`, **the persistent hint turns error-red too** (`[data-invalid] .hc-field__message` recolors all messages), collapsing the hint/error hierarchy | Additive `.hc-field__hint` that stays muted |
| 3 | Canonical field-errors fragments use **"Unprocessable Entity"** as the user-facing title — HTTP jargon replicated by every copy of the example | Humanize the example copy + a voice & tone guide |
| 4 | No guidance on **density × touch targets** (`dense` can drop below 44 px on touch) | Fundamentals guidance + recommended `pointer: coarse` override snippet |
| 5 | Docs header hosts four labeled pickers; the **site title truncates** ("Hyperm…") even at 1280 px | Collapse pickers into one theme-settings popover (dogfoods `hc-popover`) |
| 6 | Landing hero is text-only with an **empty right half** — the kit's "markup is the contract" story is told, not shown | Live mini-demo composite in the hero |
| 7 | No **page-template layer** above blocks (users assemble pages, not components) | New Templates docs section (settings page, CRUD page) |
| 8 | No **motion system** — toast/dialog/drawer transitions are ad-hoc per component | `--hc-motion-*` tokens + motion guide, applied to overlays |

## PR-1 — toast close button (core)

- Every toast renders `<button class="hc-toast__close" type="button">`
  with an `aria-label` from the message catalog (new key
  `toast.dismiss`, default "Dismiss"); glyph `×` is `aria-hidden`.
  Clicking dismisses through the same path as auto-dismiss.
- Placement: top corner of the toast grid (logical inline-end; ghost
  styling consistent with `.hc-toast__action`'s quiet look).
- The action-button rule "don't start swipe capture on the button"
  extends to the close button.
- Additive per VERSIONING.md (new class, new message key, new token(s)
  `--hc-toast-close-*` if needed). Tests: Vitest for markup/dismiss/
  i18n override; browser spec extension for click-dismiss + Escape
  parity. Docs: components/toast + recipes/toast (en + ja).

## PR-2 — hint vs. error separation (core)

- New `.hc-field__hint`: same base typography as `.hc-field__message`,
  but explicitly **stays** `--hc-field-message-color` under
  `.hc-field[data-invalid="true"]` and `.hc-field:has(:user-invalid)`.
- `.hc-field__message` behavior unchanged (many recipes rely on it
  turning red when it *is* the error text) — this is additive.
- Docs: field page documents the split (persistent help → `__hint`,
  state-coupled message → `__message`, validation slot → `__error`);
  the field-errors / mutating-form / file-upload live demos switch
  their persistent hints to `__hint`. Recipe contracts untouched.

## PR-3 — docs header: theme-settings popover (docs only)

- The Color / Neutral / Density / Dir pickers move from the header row
  into one `hc-popover` opened by a compact icon button
  (aria-label "Display settings" / 「表示設定」), next to Starlight's
  light/dark select. Persistence script unchanged.
- Acceptance: the site title renders untruncated at ≥ 360 px; pickers
  keep working (localStorage round-trip); axe-clean.

## PR-4 — error copy + voice & tone guide

- New `fundamentals/writing.mdx` (en + ja): UI copy principles —
  errors say *what happened + how to fix* in human language (no HTTP
  status names), toast copy is verb-first and short, confirm dialogs
  name the action on the button, empty states offer the next step.
- Sweep the user-facing example copy: "Unprocessable Entity" titles in
  docs pages / demo-api fragments become human copy ("Please fix the
  errors below." pattern). recipes/*/contract.md examples updated the
  same way **only where machine checks permit** (checks.json verified
  first; contract semantics unchanged — the title is app-chosen).

## PR-5 — density × touch guidance (docs only)

- The density documentation gains a "Touch targets" section:
  `comfortable` keeps ≥ 44 px targets; `compact`/`dense` are for
  pointer-fine, information-dense surfaces; recommended snippet to
  reset to comfortable under `@media (pointer: coarse)`. Kitchen-sink
  note near the density switcher.

## PR-6 — landing hero live demo (docs only)

- The splash page's empty hero half gains a small live composite
  (real hc- components — e.g. a live-search box hitting the demo API,
  a toast trigger, a badge/button cluster) so the first screen *shows*
  HTML-over-the-wire. Falls back gracefully without JS (the markup
  renders; that is the point). en + ja.

## PR-7 — Templates section (docs)

- New sidebar group **Templates** with two full-page compositions
  assembled from existing components/blocks/recipes:
  - `templates/settings` — app shell + account settings + mutating
    form + toast round trip.
  - `templates/crud` — shell + datagrid (pager + bulk actions) +
    remote dialog editing + undo delete.
- Each page: framed live preview at page scale, the complete markup,
  and a "wiring map" listing which recipes/contracts each region uses.
  en + ja.

## PR-8 — motion tokens + guide (core + docs)

- DTCG tokens `motion.duration.{fast,base,slow}` (120/200/320 ms) and
  `motion.easing.{standard,enter,exit}` → `--hc-motion-*` custom
  properties (same build pipeline as existing tokens).
- Toast, dialog and drawer enter/exit transitions consume the tokens
  (visual result initially identical or near-identical — this is a
  refactor to a system, not a redesign); `prefers-reduced-motion`
  handling unchanged.
- New `fundamentals/motion.mdx` (en + ja): when to animate, which
  duration/easing per pattern, reduced-motion policy.

## Sequencing

PRs land in this document's order, PR-1 → PR-8 (the approved priority:
toast close → hint split → header → copy guide → density → landing →
templates → motion). Each PR merges before the next opens (CHANGELOG
adjacency; no stacked PRs). Core-touching PRs (1, 2, 8) follow
VERSIONING.md — all changes are additive, no renames.
