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
