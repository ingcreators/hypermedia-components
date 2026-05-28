# Hypermedia Components — Claude Code instructions

Project: **Hypermedia Components** (ingcreators)
Prefix: `hc-` · npm scope: `@hypermedia-components` · Docs: Astro Starlight · Deploy: Cloudflare Pages
User communication language: **Japanese**.

## Authoritative plan

The v0.4 implementation plan is the source of truth for naming, repo
structure, design principles, component/recipe APIs, roadmap, and
release strategy:

→ [plans/hc-hypermedia-components-implementation-plan-v0.4-en.md](plans/hc-hypermedia-components-implementation-plan-v0.4-en.md)

Before suggesting structural changes (directory layout, naming, API
shape, docs IA, package boundaries), read the relevant plan section
first. Deviations from the plan need explicit user approval.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/docs/` | Astro Starlight documentation site (`pnpm docs:dev`). |
| `packages/core/` | `@hypermedia-components/core` — `src/{css,js,macros,tokens}/`. |
| `recipes/<name>/` | `recipe.html`, `expanded.html`, `contract.md` per recipe. |
| `examples/<framework>/` | Runnable usage examples per template engine. |
| `plans/` | Implementation plans and design documents. |

## Project conventions

- **Vanilla JS (ESM)** for behaviors and macros — not TypeScript.
- Docs use **`data-hx-*`** for htmx attributes (not the shorter `hx-*`).
- **Light DOM only** — no Shadow DOM in the MVP.
- **Semantic classes** + `data-variant` / `data-size` (not utility-first CSS).
- **State in HTML attributes** (`aria-*`, `data-*`, native disabled/invalid).
- **Behaviors stay small.** htmx owns network requests; behaviors never wrap `fetch()`.
- **DTCG tokens** are the visual source of truth → generated `--hc-*` custom properties.
- **Macros are optional.** Every macro must document its expanded HTML.

## Component DoD (plan §17.3)

CSS API · variants · states · CSS variables · accessibility notes · ≥1 docs example · uses token references · docs site builds.

## Recipe DoD (plan §17.4)

Basic HTML · htmx version · optional `data-hc-*` shorthand · optional macro · expanded HTML · server response contract · progressive enhancement · accessibility notes · tests for behaviors.

## Development

```bash
pnpm install
pnpm docs:dev      # http://localhost:4321/hypermedia-components/
pnpm docs:build
```

CI: `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `pnpm -r build`, `pnpm -r test`.

## Current status (scaffold)

Skeleton only. Component CSS, token build script, behaviors, and macros are not yet implemented. The natural next step is the minimal vertical slice (plan §24): tokens → `hc.tokens.css` → `hc-button` + `hc-field` CSS → `hc.htmx.css` → `confirm` behavior → first real component docs page.
