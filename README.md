# Hypermedia Components

[![CI](https://github.com/ingcreators/hypermedia-components/actions/workflows/ci.yml/badge.svg)](https://github.com/ingcreators/hypermedia-components/actions/workflows/ci.yml)

Semantic components and recipes for hypermedia applications.

Hypermedia Components is a UI kit for server-rendered, htmx-friendly
apps. It ships DTCG-token-driven CSS components, small Light DOM
behavior helpers, optional macro custom elements, and documented
htmx recipes — without pulling in a client-side framework.

## Goals

- **Standard HTML first** — `<button>`, `<dialog>`, `<popover>`,
  `<table>` stay the API.
- **Light DOM only** — no Shadow DOM in the MVP.
- **Semantic classes with `data-variant` / `data-size`** — no
  utility CSS framework as a prerequisite.
- **State in HTML attributes** — `disabled`, `aria-invalid`,
  `aria-current`, `data-loading`, native `[popover]`.
- **DTCG tokens are the visual source of truth** — themable via
  `--hc-*` custom properties.
- **htmx owns network behavior** — behaviors never wrap `fetch()`.
- **Copyable expanded HTML** — every macro documents its expansion.

## Install

```bash
npm install @hypermedia-components/core
```

```js
import '@hypermedia-components/core/css';        // bundle
import '@hypermedia-components/core/behaviors';  // auto-init
import '@hypermedia-components/core/macros';     // optional custom elements
```

Or via CDN-style asset paths (see the
[`plain-html` example](examples/plain-html/) for a self-contained server).

## Quick example

```html
<link rel="stylesheet" href="/assets/hc/hc.css">
<script type="module" src="/assets/hc/hc.behaviors.js"></script>

<table class="hc-table">
  <tbody>
    <tr id="item-123">
      <td>Acme widgets</td>
      <td><span class="hc-badge" data-variant="success">Active</span></td>
      <td>
        <span class="hc-action">
          <button
            class="hc-button"
            data-variant="danger"
            data-hc-confirm="Delete this item?"
            data-hx-delete="/items/123"
            data-hx-trigger="confirmed"
            data-hx-target="closest tr"
            data-hx-swap="outerHTML"
            data-hx-disabled-elt="this"
            data-hx-indicator="closest .hc-action">
            Delete
          </button>
          <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

## What's included

| Surface | Scale | Highlights |
| --- | --- | --- |
| CSS components | 50+ | from `hc-button` / `hc-input` / `hc-table` to `hc-dialog`, `hc-combobox`, `hc-datagrid`, `hc-calendar`, `hc-shell` |
| DTCG tokens | 780+ custom properties | `primitive` / `semantic` / `component` layers × runtime axes `data-theme` / `data-color` / `data-neutral` / `data-density` |
| Behaviors | 30+ | `installXxx()` helpers — confirm, toast, combobox, datagrid, menu, tabs, theme toggle, validation, … |
| Macros | 2 | `<hc-confirm-action>`, `<hc-live-search>` |
| Recipes | 12 | request-action, confirm-action, live-search, field-errors, datagrid-pager, chart, … |
| Integration guides | 8 | plain HTML, htmx, hyperscript, Thymeleaf, Django, Rails, Go, Razor |
| Tests | 100+ suites | Vitest (jsdom) + Playwright (Chromium), incl. axe a11y scans |

Full IA: see [`apps/docs/src/content/docs/`](apps/docs/src/content/docs/)
or run the docs locally (`pnpm docs:dev`).

## Repository layout

```text
apps/docs/         Astro Starlight documentation site
packages/core/     @hypermedia-components/core
  src/css/         per-layer + per-component source CSS
  src/js/          behaviors (vanilla ESM)
  src/macros/      optional custom elements
  src/tokens/      DTCG-shaped JSON sources
  scripts/         build-tokens / bundle-css / bundle-js
  test/            Vitest + jsdom tests
  test-browser/    Playwright + Chromium specs and fixtures
examples/
  plain-html/      Static gallery (zero-dep Node server)
  htmx/            Full recipes wired to a 100-line Node API
plans/             Implementation plans and design documents
```

## Development

```bash
pnpm install
pnpm -w run docs:dev      # http://localhost:4321/hypermedia-components/

# Build the core package (tokens → CSS bundle → JS modules)
pnpm --filter @hypermedia-components/core build

# Tests
pnpm --filter @hypermedia-components/core test           # Vitest + jsdom
pnpm --filter @hypermedia-components/core test:browser   # Playwright (Chromium)

# Docs build
pnpm -w run docs:build

# Runnable examples
cd examples/plain-html && pnpm start   # http://localhost:4322
cd examples/htmx       && pnpm start   # http://localhost:4323
```

First run of `test:browser` needs the Chromium binary:

```bash
pnpm --filter @hypermedia-components/core exec playwright install chromium
```

## CI

GitHub Actions runs four parallel jobs on every push and PR:

- **lint** — ESLint + Stylelint
- **unit** — Vitest + jsdom, plus a `tsc --noEmit` smoke test of the
  public type surface
- **docs** — Astro build (uploads `apps/docs/dist` as an artifact)
- **browser** — Playwright + Chromium (uploads report + traces on
  failure; Chromium binaries are cached)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Project status

`0.1.4` is published on npm under the `latest` dist-tag (2026-06-17).
The public API surface — class names, data attributes, custom
properties, exports, events, recipe contracts — and the semver rules
are defined in [`VERSIONING.md`](VERSIONING.md): 0.x **patch**
releases are strictly additive, and renames ship behind a deprecation
alias for at least one minor version. The release process is
documented in [`CONTRIBUTING.md`](CONTRIBUTING.md#release-process).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project goals, design
rules, tokens, testing, docs style, and the release process.
Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
