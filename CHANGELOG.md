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
