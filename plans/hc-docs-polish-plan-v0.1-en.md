# Hypermedia Components — Docs Polish Plan v0.1

Status: **shipped** (PRs #138–#183; verified item-by-item against the
built docs on 2026-06-12 as part of the
[v0.8 maintenance plan](./hc-maintenance-quality-plan-v0.8-en.md) R3) ·
Owner: docs · Scope: `apps/docs/` only (no `packages/core` component
changes) · Approval: this document was the sign-off gate for the IA
changes it contains (P0-3 sidebar grouping, P1-1 component gallery) per
`CLAUDE.md` → *Authoritative plans*.

Verification (2026-06-12): P0-1 `Demo.astro` shipped and adopted ·
P0-2 preview canvas (`preview.css` 4 → 159 lines, `.hc-preview--*`
helpers, inline preview styles removed) · P0-3 grouped Components
sidebar (Actions / Forms / Overlays / Navigation / Data display /
Feedback / Layout in `astro.config.mjs`) · P0-4 landing showcase
("Standard HTML, composed" live section) · P1-1 `ComponentGallery.astro`
on `components/index.mdx` · P1-2 `<details>` API-reference sections on
50 component pages · P2-2 Expressive Code `defaultProps.wrap` ·
P2-1 (typography / rhythm) has no concrete outstanding ask — fold any
future tuning into normal docs work. **No residual items**; nothing
moved to the v0.8 backlog.

## 1. Why

The docs site renders correctly and dogfoods HC's own tokens
(`apps/docs/src/styles/custom.css` bridges `--sl-*` → `--hc-*`), but it
reads as less polished and harder to scan than peer libraries
(shadcn/ui in particular). This plan captures a grounded audit — done
by running `pnpm --filter @hypermedia-components/docs dev` and
screenshotting the landing page, a component page (Button), and dark
mode — and a phased, low-risk improvement track.

Out of scope: the component CSS in `packages/core`. One related finding
(no dark component theme — `data-variant="default"` buttons render on a
light surface inside a dark preview) is a **core** concern and is
tracked separately, not here.

## 2. Audit findings (grounded)

| # | Symptom | Evidence |
| --- | --- | --- |
| F1 | Preview and code are **stacked and duplicated** per section; pages get long; code overflows horizontally and is clipped. | `components/button.mdx` — `.hc-preview` box immediately followed by a near-identical fenced block. |
| F2 | Preview frame is minimal and **blends into the page in dark mode**; light-surfaced components sit on a dark canvas. | `src/styles/preview.css` is 4 lines: `1px` border + padding + radius, `background: var(--sl-color-bg)` (= page bg). |
| F3 | Every preview hand-writes `style="display:flex;gap:…"`; **spacing/alignment drift** across pages. | `button.mdx:12`, `select.mdx:25`, `item.mdx`, `kitchen-sink.mdx`, … |
| F4 | Sidebar **Components is a flat ~52-entry alphabetical list**; hard to scan, no category map. | `astro.config.mjs` → `{ label: 'Components', autogenerate: { directory: 'components' } }`. |
| F5 | `components/index.mdx` is **two sentences** — no visual gallery; discovery relies entirely on the sidebar. | `components/index.mdx`. |
| F6 | Pages are **text-heavy**; raw `CSS variables` dumps and `Theming tokens` tables sit inline in the main flow. | `button.mdx` "CSS variables" / "Theming tokens" sections. |
| F7 | **Landing is thin** — splash hero + 4 plain cards, large empty space below the fold; no "what it looks like" showcase. | `index.mdx` (`template: splash`). |

## 3. Principles for this work

- **Dogfood the fixes.** Build the improvements with HC's own
  components where possible — `hc-tabs` for the Preview/Code switch,
  `hc-grid` + `hc-card` for galleries — so the docs keep "rendering in
  the system they document".
- **Keep the token bridge.** Do not regress `custom.css`'s `--sl-*` →
  `--hc-*` mapping; extend it where needed (e.g. a preview surface
  token).
- **Accessibility intact.** The Preview/Code control must be keyboard-
  operable and labelled; previews stay real, interactive demos.
- **One PR = one concern**, each branched fresh off `origin/main`, full
  local verification, stop before merge.

## 4. Plan

### P0 — high impact, low risk

- **P0-1. `<Demo>` component (Preview/Code in one frame).**
  New Astro component wrapping a live preview and its source behind an
  `hc-tabs` (Preview | Code) with a copy button. Replaces the
  "box + duplicate fenced block" pattern. Roll out page-by-page so the
  migration is reviewable.
  *DoD:* component built + dogfoods `hc-tabs`; keyboard + `aria`
  correct; ≥3 pages migrated as the pilot; `docs:build` green.

- **P0-2. Preview canvas redesign.**
  Rework `.hc-preview` into a real canvas: distinct surface
  (`--hc-color-surface` or a dedicated `--hc-docs-preview-bg`),
  `min-block-size`, centered default, border contrast that holds in
  dark mode. Add layout-helper classes (`.hc-preview--row` / `--col` /
  `--center` / `--wrap` / `--stack`) and **replace the inline
  `style="…"` on previews** with them. Land the CSS + a pilot set of
  pages first for visual sign-off, then complete the rollout.
  *DoD:* canvas legible in light + dark; helper classes documented;
  inline preview styles removed; `docs:build` green.

- **P0-3. Sidebar categories.** *(IA — approved via this doc)*
  Replace the `autogenerate` Components entry with manual groups:
  Actions · Forms · Overlays · Navigation · Data display · Feedback ·
  Layout. Slugs and content unchanged — grouping only.
  *DoD:* every component reachable under exactly one group; no broken
  links; `docs:build` green.

- **P0-4. Landing showcase.**
  Add a live component showcase + a "Browse components" CTA below the
  hero to fill the dead space and show the look. Built with
  `hc-grid`/`hc-card` (already the landing's pattern).
  *DoD:* no large empty viewport below the fold at desktop; links
  resolve; `docs:build` green.

### P1 — structure / IA

- **P1-1. Component gallery.** *(IA — approved via this doc)*
  Turn `components/index.mdx` into an `hc-grid` + `hc-card` gallery
  linking each component (mini preview or icon + one-line blurb).
- **P1-2. Examples-first page structure.**
  Move long `CSS variables` dumps and `Theming tokens` tables into a
  collapsed "API reference" section (or `<details>`) near the page
  bottom, so examples lead. Apply incrementally across pages.

### P2 — finish

- **P2-1. Typography / rhythm.** Tune heading scale, content
  max-width, inline-code chip weight, and code wrapping for a tighter,
  more designed feel.
- **P2-2. Expressive Code config.** Frame titles (e.g. `index.html`),
  HC-aligned themes, long-line wrapping.

## 5. Sequencing & constraints

Recommended order: **P0-2 → P0-1 → P0-3 → P0-4 → P1-1 → P1-2 → P2.**
P0-2 is the foundation P0-1 builds on; doing the two first changes the
feel the most.

Each item ships as its own PR off `origin/main` with the full local
gate (build / lint / vitest / typecheck / docs:build / Playwright) and
stops before merge for review. PRs are kept independent (non-stacked):
they touch different files, so merge order is free.

## 6. Done = the docs read examples-first

A visitor lands, sees a showcase; opens a component, sees a framed live
demo with the code one tab away; scans a category-grouped sidebar or a
visual gallery to find the next component; reaches the API reference
when they need it, not before.
