# Contributing to Hypermedia Components

Thank you for your interest in Hypermedia Components. This document
explains what the project is, what it is not, and the rules a
contribution needs to follow.

Read the [implementation plan](plans/hc-hypermedia-components-implementation-plan-v0.4-en.md)
for the long-form rationale. This file is the short version.

---

## Project goals

Hypermedia Components is a UI kit for **server-rendered, hypermedia
applications**. It provides:

- semantic CSS components driven by DTCG tokens;
- htmx-friendly recipes;
- small Light DOM behaviors;
- optional Light DOM macros that always document their expanded HTML.

The North-Star is that a server-rendered app can pick up `hc.css` plus
a sprinkle of `data-hx-*` attributes and ship a coherent UI without
adopting a client-side framework.

## Scope and non-goals

Hypermedia Components **is not**:

- a React / Vue / Svelte component library;
- a utility-first CSS framework;
- a Shadow DOM widget library;
- a client-side application framework;
- a replacement for htmx, hyperscript, or server templates;
- a full data grid or charting library;
- a domain workflow toolkit.

Avoid domain-specific naming (`invoice`, `approval`, `audit`,
`customer`) in **core** APIs. Those concepts belong in examples, not
in component or recipe names.

---

## Design rules for components

A new or modified component must follow these rules:

1. **Standard HTML first.** Apply `hc-*` classes to native elements
   (`button`, `input`, `dialog`, `table`, …). Do not invent
   `<hc-button>`-style custom elements as the primary API.
2. **Light DOM only.** No Shadow DOM in the MVP.
3. **Semantic classes plus `data-variant` / `data-size`.** Variant and
   size axes are attributes, not extra class names. No BEM modifier
   classes.
4. **State lives in HTML attributes.** `disabled`, `aria-invalid`,
   `aria-current`, `data-loading`, `[popover]`, `:open`. CSS styles
   those states directly so consumers never need a JavaScript hook to
   change presentation.
5. **CSS reads `--hc-*` variables — never hard-coded values.** Add a
   new token if the value should be themable. Component CSS reads
   component or semantic variables, never primitive values directly.
6. **`hc.htmx.css` owns htmx integration styling.** Component files do
   not branch on `.htmx-request` or similar — that lives in the htmx
   layer.
7. **Behaviors stay small.** htmx owns network requests. Behaviors must
   never wrap `fetch()` or replace htmx attributes.
8. **Light DOM macros are optional and always document expanded HTML.**
   A macro is never the only documented way to use a pattern.

The full Definition of Done lives in plan §17.3 (components) and
§17.4 (recipes). In short:

- CSS API documented (variants, sizes, states).
- Relevant `--hc-*` variables documented.
- Accessibility notes included.
- At least one example in the docs.
- Token references used instead of hard-coded values.
- The docs site builds.
- For recipes: basic HTML, htmx version, optional `data-hc-*`
  shorthand, optional macro, **expanded HTML**, server response
  contract, progressive enhancement notes, a11y, and tests for any
  behavior.

## Naming

Use the `hc-` prefix consistently. See
[Fundamentals → Naming](apps/docs/src/content/docs/fundamentals/naming.mdx)
for the full spec; the short version is:

```text
CSS classes:           hc-button, hc-card__header
Data attributes:       data-hc-confirm, data-hc-close-dialog-on-success
Custom elements:       hc-confirm-action
CSS custom properties: --hc-color-bg, --hc-button-primary-bg
Events:                hc:toast, hc:confirm
```

Variant names follow `default | primary | secondary | danger |
warning | success | info | ghost | link`. Sizes are `sm | md | lg`.

---

## Tokens

Visual decisions live in DTCG-shaped JSON under
`packages/core/src/tokens/`:

- `primitive.tokens.json` — raw values; never emitted directly.
- `semantic.tokens.json` — UI meaning; emitted under
  `:root, [data-theme="light"]`.
- `component.tokens.json` — component-level values; emitted under
  `:root`.
- `theme.dark.tokens.json` — dark-mode overrides under
  `[data-theme="dark"]`.

References use the `{namespace.path.to.token}` syntax and may chain
across layers. The variable name drops the file's namespace and joins
the remaining JSON path with hyphens:
`component.button.primary.bg` → `--hc-button-primary-bg`.

Add a token only when the value is reused. A value used once is not
yet a token.

Shadows are an exception with their own scale: `box-shadow` colors must
come from `--hc-shadow-sm` / `-md` / `-lg` / `-overlay` (or compose the
`--hc-shadow-edge` color) so dark mode can strengthen them — Stylelint
rejects literal colors in `box-shadow`.

## Development environment

The standard setup is WSL 2 + Docker Desktop + VS Code Dev Containers
(the same workflow as TesseraQL):

1. Clone the repository into the WSL 2 filesystem (not `/mnt/c/...` —
   file watching and pnpm are much slower across the Windows mount).
2. Open the folder in VS Code (`code .` from WSL) and run
   **Dev Containers: Reopen in Container**.
3. `postCreateCommand` installs dependencies and Playwright Chromium,
   then runs `scripts/verify-dev-env.sh`.

The container ships Node.js 24, pnpm, the GitHub CLI, and Claude Code.
Agent and CLI state persists across rebuilds in named volumes
(`/home/node/.claude`, `/home/node/.config/gh`, the pnpm store, and the
Playwright browser cache). Authenticate once inside the container with
`gh auth login` and `claude` (`/login`); alternatively copy
`.devcontainer/devcontainer.local.env.example` to
`.devcontainer/devcontainer.local.env` (gitignored) for token-based
auth. Do not bind-mount broad host secret directories.

Working directly on the host (any OS with Node.js ≥ 24 and pnpm) also
works — the devcontainer is the recommended path, not a requirement.

---

## Building

```bash
pnpm install
pnpm -w run build         # builds packages/core
pnpm -w run docs:build    # builds the docs site
pnpm -w run docs:dev      # http://localhost:4321
```

The core build runs three steps in order:

```text
build:tokens   node scripts/build-tokens.mjs   → dist/hc.tokens.css
build:css      node scripts/bundle-css.mjs     → dist/hc.css + per-file copies
build:js       node scripts/bundle-js.mjs      → dist/hc.behaviors.js etc.
```

The docs site declares `@hypermedia-components/core` as a workspace
dependency. `pnpm --filter @hypermedia-components/docs build` runs the
core build first via the `prebuild` script.

---

## Tests

Tests live in `packages/core/test/` and run on Vitest + jsdom.

```bash
pnpm -w run test
```

Coverage expectations:

| What | Where | Notes |
| --- | --- | --- |
| Token transform | `test/tokens.test.mjs` | `buildTokensCss({ sources, trees })` runs against in-memory fixtures. |
| Behaviors | `test/<behavior>.test.mjs` | DOM tests under jsdom. Each behavior's `installXxx()` returns an uninstaller; tests call it in `afterEach`. |
| Macros | `test/macros.test.mjs` | jsdom upgrade tests for `<hc-confirm-action>` / `<hc-live-search>`. |
| Real browser APIs | `test-browser/*.spec.mjs` | Playwright (Chromium) drives a real page (`test-browser/fixtures/`) served by `test-browser/serve.mjs`. Run with `pnpm --filter @hypermedia-components/core test:browser`. Browser binaries: `pnpm exec playwright install chromium`. |

Rules:

- New behaviors must ship with tests for their public contract.
- New tokens or token build changes need a test if they change the
  transform itself (not when they only add data).
- Tests must be deterministic. Use `vi.useFakeTimers()` for timing
  behavior (see `toast.test.mjs`).

Polyfills live in `test/dom-setup.mjs`. Import it from any test that
relies on `<dialog>.showModal()` / `close()` — jsdom's implementation
varies by version.

### Visual regressions

`test-browser/vrt.spec.mjs` screenshots three dense fixture sheets
(`fixtures/vrt-core.html` / `vrt-data.html` / `vrt-overlays.html`)
under light/dark × ltr/rtl (plus a compact-density and an accent slice)
and compares them against the committed linux baselines in
`test-browser/vrt.spec.mjs-snapshots/`. The sheets pin the font tokens
to DejaVu so the devcontainer and CI rasterize identically; keep any
new content deterministic (no network, no timers, no random data).

- **Changed a component's look on purpose?** Regenerate the baselines
  and commit the PNGs — the PR then shows reviewable image diffs:

  ```bash
  pnpm --filter @hypermedia-components/core exec playwright test test-browser/vrt.spec.mjs --update-snapshots
  ```

- **Added a component?** Add it to the relevant sheet (usually
  `vrt-core.html`), then regenerate.
- **CI disagrees with your local baselines** (rare — both are linux +
  the same pinned Chromium): download the Playwright report artifact
  from the failed browser job and commit its `*-actual.png` images as
  the baselines.

---

## Documentation

The docs are first-class. They must teach, not just list APIs.

- Components follow the §7.7 template: Overview, Basic HTML, Variants,
  Sizes, States, htmx usage, Accessibility, Theming tokens, CSS
  variables, Related.
- Recipes follow the §7.8 template: Overview, Basic usage, htmx
  version, `data-hc-*` shorthand, optional macro, **Expanded HTML**,
  Server response contract, Accessibility, Progressive enhancement,
  Related.
- Code examples use `data-hx-*` rather than the shorter `hx-*` so the
  HTML stays valid and template-engine-friendly. A note can mention
  that htmx also supports `hx-*`.
- Live previews are welcome but optional. The bundled core CSS is
  loaded into the Starlight site so `<button class="hc-button">` in
  MDX renders correctly.

Docs are written in English. Japanese i18n is deferred.

---

## Accessibility

Accessibility is part of the component contract, not a footer note:

- Use native elements whenever they fit (`button`, `dialog`,
  `popover`, `nav`, `table`).
- Pair `aria-invalid="true"` with `aria-describedby` on form fields.
- Mark the current pagination link with `aria-current="page"`.
- For destructive actions, focus the cancel button by default and use
  the danger-color focus ring.
- Reserve `role="alert"` for truly urgent updates; default to
  `role="status"` / `aria-live="polite"`.
- Color alone is never the message.

Each component and recipe page must have an Accessibility section.

---

## Commits and pull requests

- Conventional Commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`. Keep the subject under 70 characters.
- One change per PR where reasonable. Bundle closely-related changes
  if splitting would be churn.
- Update `CHANGELOG.md` under the **Unreleased** section for any
  user-visible change.
- Pull requests must answer:
  - [ ] Docs updated.
  - [ ] Examples added or updated where relevant.
  - [ ] Accessibility considered.
  - [ ] Tests added where relevant.
  - [ ] No utility-CSS framework introduced as a requirement.
  - [ ] Light DOM first — no Shadow DOM additions.

The PR template in `.github/PULL_REQUEST_TEMPLATE.md` enforces the
checklist.

---

## Release process and versioning

The full policy — what counts as the public API (CSS class names,
data attributes, `--hc-*` custom properties, JS exports, `hc:*`
events, i18n keys, export paths, recipe contracts), what semver means
during 0.x, and how deprecation aliases work — lives in
[`VERSIONING.md`](VERSIONING.md). The short version for contributors:

- Markup is a wire contract: consumers generate it from server
  templates and compilers, so renaming a documented class or
  attribute is a breaking change even if nothing looks different.
- Renames ship behind a deprecation alias for at least one minor
  version, with a **Deprecated** CHANGELOG entry naming the
  replacement.
- Releasing: move the `Unreleased` CHANGELOG block under the new
  version heading, bump `packages/core/package.json`, tag `v<version>`
  — `.github/workflows/release.yml` publishes to npm (pre-releases
  under their derived dist-tag, releases under `latest`).

---

## Questions

Open an issue. The implementation plan
([`plans/`](plans/hc-hypermedia-components-implementation-plan-v0.4-en.md))
is the canonical source for architectural decisions; if your question
is not answered there, that may itself be useful feedback.
