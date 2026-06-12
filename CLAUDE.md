# Hypermedia Components — Claude Code instructions

Project: **Hypermedia Components** (ingcreators)
Prefix: `hc-` · npm scope: `@hypermedia-components` · Docs: Astro Starlight · Deploy: Cloudflare Pages
User communication language: **Japanese**.

## Authoritative plans

Two plan documents live under `plans/`. Read the relevant section
before suggesting structural changes (directory layout, naming, API
shape, docs IA, package boundaries); deviations from the plans need
explicit user approval.

| Plan | Scope |
| --- | --- |
| [`plans/hc-hypermedia-components-implementation-plan-v0.4-en.md`](plans/hc-hypermedia-components-implementation-plan-v0.4-en.md) | Original v0.4 plan — design principles, naming, MVP component list, DoDs, recipe contracts. Implemented and merged in PR #1. |
| [`plans/hc-next-phase-plan-v0.5-en.md`](plans/hc-next-phase-plan-v0.5-en.md) | Next-phase plan — release readiness for `0.0.1-alpha.0`, MVP polish, quality work, P3 backlog. |

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/docs/` | Astro Starlight documentation site (`pnpm docs:dev`). |
| `packages/core/` | `@hypermedia-components/core` — `src/{css,js,macros,tokens}/`, `scripts/`, `test/`, `test-browser/`. |
| `recipes/<name>/` | `recipe.html` / `expanded.html` / `contract.md` source-format scaffolds. |
| `examples/<framework>/` | Runnable usage examples (`plain-html/`, `htmx/` — others scaffolded). |
| `plans/` | Implementation plans and design documents. |
| `.github/workflows/` | `ci.yml` (lint / unit / docs / browser) + `release.yml`. |

## Project conventions

- **Vanilla JS (ESM)** for behaviors and macros — not TypeScript.
- Docs use **`data-hx-*`** for htmx attributes (not the shorter `hx-*`).
- **Light DOM only** — no Shadow DOM in the MVP.
- **Semantic classes** + `data-variant` / `data-size` (not utility-first CSS).
- **State in HTML attributes** (`aria-*`, `data-*`, native disabled/invalid).
- **Behaviors stay small.** htmx owns network requests; behaviors never wrap `fetch()`.
- **Behaviors return uninstallers** and are idempotent across `installXxx()` calls.
- **DTCG tokens** are the visual source of truth → generated `--hc-*` custom properties (drop the file namespace; e.g. `component.button.primary.bg` → `--hc-button-primary-bg`).
- **Macros are optional.** Every macro must document its expanded HTML and never become the only documented way to use a pattern.

## Definitions of Done

- **Component** (plan §17.3): CSS API · variants · states · CSS variables · accessibility notes · ≥1 docs example · uses token references · docs site builds.
- **Recipe** (plan §17.4): Basic HTML · htmx version · optional `data-hc-*` shorthand · optional macro · expanded HTML · server response contract · progressive enhancement · accessibility notes · tests for behaviors.

## Implemented surface

As of `0.0.1-alpha.0` (published 2026-06-09): 52 component stylesheets ·
30+ behaviors · 2 macros · 11 recipe scaffolds · ~100 docs pages
(components, tokens, fundamentals, integrations, blocks) · runtime axes
`data-theme` / `data-color` / `data-neutral` / `data-density` / `dir` ·
i18n message catalog (`setMessages()`) · examples for plain-html + htmx ·
34 Vitest suites · 71 Playwright suites (incl. axe scans).

[`CHANGELOG.md`](CHANGELOG.md) is the source of truth for what shipped;
counts here go stale — verify before relying on them.

## Development

```bash
pnpm install --frozen-lockfile

# Local dev
pnpm -w run docs:dev       # http://localhost:4321/hypermedia-components/

# Build
pnpm --filter @hypermedia-components/core build
pnpm -w run docs:build

# Lint
pnpm --filter @hypermedia-components/core lint          # ESLint + Stylelint

# Tests
pnpm --filter @hypermedia-components/core test          # Vitest + jsdom
pnpm --filter @hypermedia-components/core test:browser  # Playwright + axe
# First run only: pnpm --filter @hypermedia-components/core exec playwright install chromium

# Runnable examples
cd examples/plain-html && pnpm start    # :4322
cd examples/htmx       && pnpm start    # :4323
```

**Runtime**: Node.js 24 (active LTS). Root `engines.node = ">=24"`.

## CI

`.github/workflows/ci.yml` runs four parallel jobs on every push and PR:

- **lint** — ESLint + Stylelint
- **unit** — Vitest (jsdom) + `tsc --noEmit` smoke test of the public type surface
- **docs** — Astro build (uploads `apps/docs/dist` as artifact)
- **browser** — Playwright + Chromium (cached browser binaries; uploads report + traces on failure)

All four must be green before merging.

## Workflow conventions

- Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Update `CHANGELOG.md` under **Unreleased** for any user-visible change.
- PR template in `.github/PULL_REQUEST_TEMPLATE.md` has the §21.4 checklist.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contributor guide.
- See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the Cloudflare Workers runbook (manual dashboard steps, build / deploy commands, custom domain attach, Worker Route).

## Current focus

`0.1.0` shipped (npm `latest`, 2026-06-12) — the alpha-graduation
release that closed out the **TesseraQL improvement brief** (all 7
themes, one PR each, #192–#198):

| Doc | Purpose |
| --- | --- |
| [`plans/tesseraql-2026-06-brief.md`](plans/tesseraql-2026-06-brief.md) | The brief as received (7 themes; markup-as-wire-contract framing). |
| [`plans/tesseraql-2026-06-response-en.md`](plans/tesseraql-2026-06-response-en.md) | Our response: what already existed in alpha.0 vs. what each theme PR added. |

The docs site is deployed at
`hypermedia-components.ichimura-12c.workers.dev`. The active workstream
is
[`plans/hc-maintenance-quality-plan-v0.8-en.md`](plans/hc-maintenance-quality-plan-v0.8-en.md)
— post-0.1.0 quality debt (shadow tokens, docs truth, CI guards,
shared-internal tests, hygiene) plus two P3 picks (Lighthouse
benchmarks, recipe CLI).

[`VERSIONING.md`](VERSIONING.md) defines the public API surface
(class names, data attributes, custom properties, exports, events) and
the deprecation-alias rule — renames need aliases now that alpha.0 has
shipped; the pre-alpha "no back-compat" rule is over.
