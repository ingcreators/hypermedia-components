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
| `recipes/<name>/` | `recipe.html` / `expanded.html` / `contract.md` source-format scaffolds (most still empty — see v0.5 plan). |
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

15 components · 242 `--hc-*` vars (3 density layers attribute-toggleable) · 5 behaviors · 2 macros · 9 recipes · 43 docs pages · 5 integration guides · examples for plain-html + htmx · 75 Vitest tests · 41 Playwright tests (incl. 6 axe-core a11y scans).

For the full list of what is and is not built, see the
[next-phase plan](plans/hc-next-phase-plan-v0.5-en.md).

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

The next-phase plan ([`plans/hc-next-phase-plan-v0.5-en.md`](plans/hc-next-phase-plan-v0.5-en.md))
groups remaining work into four tracks. Track 1 (release readiness)
progress so far:

- **§3.1** types — resolved. `packages/core` emits `.d.ts` from JSDoc
  via `tsc --emitDeclarationOnly --allowJs`; the smoke test runs in
  the unit CI job.
- **§3.2** release workflow dry-run — pending.
- **§3.3** Cloudflare deployment — repo-side prep merged
  ([`wrangler.jsonc`](wrangler.jsonc), [`worker.mjs`](worker.mjs),
  [`apps/docs/public/_headers`](apps/docs/public/_headers),
  [`DEPLOYMENT.md`](DEPLOYMENT.md)). Uses the unified Workers + Static
  Assets flow (Cloudflare merged Pages into Workers). The Worker still
  has to be provisioned in the dashboard.
- **§3.4** cut `0.0.1-alpha.0` — pending §3.2 and §3.3 dashboard work.

Track 2 (MVP polish) progress:

- **§4.1** `hc-checkbox` / `hc-radio` — merged. Both wrap a native
  input via `appearance: none`; variants `default / success / danger`;
  Playwright covers Space toggle, arrow-key radio navigation, label
  click, variants, `aria-invalid`, disabled.
- **§4.2** Density modes — merged. `data-density="comfortable|compact|dense"`
  attribute swaps `--hc-control-height` / `--hc-control-padding-x`;
  button and input pick it up via `var()` indirection without
  per-component CSS changes.
