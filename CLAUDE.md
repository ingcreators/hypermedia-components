# Hypermedia Components — Claude Code instructions

Project: **Hypermedia Components** (ingcreators)
Prefix: `hc-` · npm scope: `@hypermedia-components` · Docs: Astro Starlight · Deploy: Cloudflare Workers
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
| `examples/<framework>/` | Runnable usage examples (`plain-html/`, `htmx/`; other stacks are covered by the docs integration guides). |
| `plans/` | Implementation plans and design documents. |
| `.github/workflows/` | `ci.yml` (lint / unit / docs / browser×3) + `perf.yml` (weekly Lighthouse) + `release.yml`. |

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

As of `0.3.0` (2026-08-29): 67 component stylesheets ·
57 behaviors (56 auto-init + opt-in chart) · 2 macros · 44 recipes ·
8 integration guides · 4 full-page templates · opt-in `hc.print.css`
(`./css/print`) · docs **fully mirrored in Japanese (`/ja/`)** ·
runtime axes
`data-theme` / `data-color` / `data-neutral` / `data-density` / `dir` ·
i18n message catalog (`setMessages()`) · examples for plain-html +
htmx · Vitest suites (core + CLI + demo-api) · Playwright suites (incl.
axe scans and the VRT screenshot sheets) · `hc validate` machine-checked
recipe contracts (`@hypermedia-components/cli@0.4.2`).

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
pnpm --filter @hypermedia-components/core test:browser  # Playwright + axe (all 3 engines)
pnpm --filter @hypermedia-components/core test:browser --project=chromium   # one engine
# First run only: pnpm --filter @hypermedia-components/core exec playwright install --with-deps chromium firefox webkit

# Runnable examples
cd examples/plain-html && pnpm start    # :4322
cd examples/htmx       && pnpm start    # :4323
```

**Runtime**: Node.js 24 (active LTS). Root `engines.node = ">=24"`.

## CI

`.github/workflows/ci.yml` runs parallel jobs on every push and PR:

- **lint** — ESLint + Stylelint
- **unit** — Vitest (jsdom) + `tsc --noEmit` smoke test of the public type surface
- **docs** — Astro build (validates internal links via `starlight-links-validator`; uploads `apps/docs/dist` as artifact)
- **browser** — Playwright, one matrix leg per engine (Chromium / Firefox / WebKit; cached binaries; report + traces on failure). The VRT screenshot sheets run on the Chromium leg only. A gate job named "Browser tests (Playwright)" aggregates the legs for the branch ruleset.

The four required checks (lint, unit, docs, browser gate) must be green
before merging.

## Workflow conventions

- Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Update `CHANGELOG.md` under **Unreleased** for any user-visible change.
- PR template in `.github/PULL_REQUEST_TEMPLATE.md` has the §21.4 checklist.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contributor guide.
- See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the Cloudflare Workers runbook (manual dashboard steps, build / deploy commands, custom domain attach, Worker Route).

## Worktree isolation (parallel sessions)

Multiple Claude Code sessions may run in this repository concurrently.
Before modifying any file, switching branches, committing, or rebasing,
enter a dedicated git worktree (EnterWorktree, or
`git worktree add .claude/worktrees/<name> -b <branch> origin/main`) —
**never mutate the main checkout**: branch switches, commits, and resets
there are global and corrupt other sessions' state. Run
`pnpm install --frozen-lockfile` inside the worktree once before
building or testing (fast — hardlinked from the pnpm store). Pushes,
PRs, and other remote operations can be issued from anywhere; only
working-tree operations need isolation. Remove the worktree and delete
the local branch after its PR merges.

## Current focus

Core `0.3.0` + CLI `0.4.2` shipped (2026-08-29, `v0.3.0` /
`cli-v0.4.2` tags) — the **data-grid release**, PRs #487–#577: the
operations a business grid is actually used for. Eight new recipes
(`datagrid-sort` / `-filter` / `-prefs` / `-tree` / `-edit-errors` /
`-edit-conflict` / `-bulk-errors`, plus `row-detail`), the *Data grid
page* template, the `hc-filterbar` component, four new behaviors
(`installRangeValue` / `installMultiValue` / `installRowLink` /
`installSortList`), `.hc-fill`, and row ordinals.

**Minor, not patch**, for exactly one reason: `--hc-color-link` /
`-hover` / `-visited` and the bare-anchor rules in `@layer hc.base`
(#569, PR #574) re-colour every `<a>` outside a component, which had
been falling to the UA's `-webkit-link` blue and `:visited` purple. The
`:visited` half is baked per theme by the token build, because engines
refuse to resolve `var()` in a visited-dependent declaration — that is
the one part of a theme a consumer cannot express by hand. Links are
also the only accent value that is theme-dependent (no ramp step clears
4.5:1 on both surfaces), so each non-default accent gained a
`color.<name>.dark.tokens.json` under a compound selector.

The link work reached the **email** render target too (#577), and turned up
a defect there: the dark flavor had been leaving links and tables on their
light colours (2.77:1 and 1.21:1 on the dark container), because a fragment
is only reachable by the layout's dark media query if it carries an
`hc-em-*` class — and neither had one. It also caught a regression the link
tokens introduced in the theme builder, where `theme.dark` overlays the
custom accent and so began winning its link colour.

Everything else in the release is strictly additive.
`@hypermedia-components/editor-kit` is unchanged at `0.2.0`.

The previous release — Core `0.2.1` + CLI `0.4.1` (2026-08-08, `v0.2.1` /
`cli-v0.4.1` tags) — was the **business-app release**: seven themes from
the 2026-08-08 line-of-business gap analysis, 19 feature PRs
(#467–#485), each theme plan-first:

| Theme | Plan | Shipped |
| --- | --- | --- |
| A 入力基盤 | [`plans/hc-input-format-plan-en.md`](plans/hc-input-format-plan-en.md) | `installFormat`/`installNormalize` (formdata-event raw wire values), `installMask` (`postal-jp`), postal-address recipe |
| B フォーム安全 | [`plans/hc-form-safety-plan-en.md`](plans/hc-form-safety-plan-en.md) | `installDirtyGuard` + unsaved-changes recipe, autosave recipe (zero JS) |
| C 異常系 | [`plans/hc-error-paths-plan-en.md`](plans/hc-error-paths-plan-en.md) | `installSessionExpiry` (401→replay), edit-conflict recipe (409, zero JS), `fundamentals/errors` map |
| D グリッド運用 | [`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md) | datagrid-columns / saved-views / csv-import / datagrid-infinite — four zero-JS contracts |
| E 印刷 | — | opt-in `hc.print.css` (`./css/print`) + `fundamentals/print` |
| F 時刻 | — | `installTime` (`<time data-hc-time>` Intl localization) |
| G テンプレート | — | `templates/data-entry` composing the whole stack |

Assembly hardening worth remembering: OOB units must never replace an
`data-hc-close-*-on-success` carrier mid-request (datagrid-columns);
`revealed` is window-based, so infinite grids require
`--hc-datagrid-max-height: none` (datagrid-infinite); dialog-open axe
scans emulate reduced motion (#342 pattern).

Previous milestones follow.

`0.1.0` shipped (npm `latest`, 2026-06-12) — the alpha-graduation
release that closed out the **TesseraQL improvement brief** (all 7
themes, one PR each, #192–#198):

| Doc | Purpose |
| --- | --- |
| [`plans/tesseraql-2026-06-brief.md`](plans/tesseraql-2026-06-brief.md) | The brief as received (7 themes; markup-as-wire-contract framing). |
| [`plans/tesseraql-2026-06-response-en.md`](plans/tesseraql-2026-06-response-en.md) | Our response: what already existed in alpha.0 vs. what each theme PR added. |

The docs site is deployed at
`hypermedia-components.ichimura-12c.workers.dev`. The
[v0.8 maintenance & quality plan](plans/hc-maintenance-quality-plan-v0.8-en.md)
**shipped in full** (PRs #210–#239, 2026-06-12): shadow tokens
(`--hc-shadow-*` + stylelint guard), docs truth, links validation in CI,
unit tests for the shared internals, hygiene, the TesseraQL docs
follow-ups, weekly Lighthouse runs (`perf.yml`), and the recipe CLI
(`@hypermedia-components/cli` `0.1.0`, on npm `latest` since 2026-06-12
— first publish was manual by necessity; later releases go through
`cli-v*` tags). No active workstream; the post-0.1.0 quality work
shipped as core `0.1.1` (2026-06-12, `v0.1.1` tag).

Core `0.1.2` (2026-06-13, `v0.1.2` tag) followed: the three TesseraQL
downstream form-pattern issues (#244 mutating-form recipe, #245 boolean
field-pattern docs + the field-errors visible-control fix, #246
`installCsrfHeader()`), plus the datagrid multi-row keyboard-nav fix
(#248). CLI shipped `0.1.1` (`cli-v0.1.1` tag) to re-bundle the new
recipe.

Core `0.1.3` (2026-06-17, `v0.1.3` tag) followed: the four TesseraQL
component issues — `hc-code` (read-only code block + line-number /
coverage gutter + unified diff, #253/#256), `hc-sparkline`
(scriptless inline trend, #254), and the editable `hc-code` field with
`installCodeEditor()` (#255). All strictly additive, so a patch per
VERSIONING.md.

Core `0.1.4` (2026-06-17, `v0.1.4` tag) followed: opt-in, server-tokenized
syntax highlighting for the read-only `hc-code` surfaces — the
`hc-code__tok[data-tok]` markup contract and the `--hc-code-tok-*` palette
(#261, Phase A). Additive, so a patch.

Core `0.1.5` (2026-06-17, `v0.1.5` tag) followed: live syntax highlighting
for the editable `hc-code` field (#264, Phase B) — `installCodeEditor()`'s
opt-in `data-lang` overlay, a pluggable `registerCodeLanguage()` API with
built-in `sql` / `json` / `yaml` / `html` grammars, and the additive
`property` / `tag` / `attribute` syntax tokens (which also enrich the Phase A
read-only path). Additive, so a patch.

Core `0.1.6` (2026-06-19, `v0.1.6` tag) followed: the three TesseraQL
Studio platform-UX issues, one PR each — `installCopy()` / `data-hc-copy`
clipboard behavior (#270, PR #273), the `hc-toc` component +
`installSpy()` scrollspy (#271, PR #274), and `installNavCurrent()` /
`data-hc-nav-current` active-link marking (#272, PR #275). All CSP-safe
(declarative markup, no inline JS) and strictly additive, so a patch.
Also a fix (#276): the CSS Anchor Positioning JS fallback now clears
`position-area` / `position-try-fallbacks` / `position-anchor` and resets
insets with the physical `inset: auto` before writing `top`/`left`, so it
stays authoritative under Chrome 149 (surfaced by the Playwright 1.61
dev-dependencies bump, #268). Routine dependency bumps landed too
(#267 actions/checkout 7, #269 astro 6.4.8, #268 dev-deps group).

Core `0.1.7` (2026-07-03, `v0.1.7` tag) followed — six workstreams,
each with its own plan doc under `plans/` (plan PR → implementation
PRs, #279–#297): the **datagrid-bulk-actions** recipe +
`installDatagridActions()` + post-swap selection sync (#279–#281); the
**SSE recipes** (`sse-updates`, `sse-toast`) + `installSseDispatch()` +
the vendored htmx SSE extension (#282–#284); **`hc validate`** —
machine-checked recipe contracts, `checks.json` in every recipe, the
self-validation keystone test, CLI test suite wired into CI (#285,
#286); **VRT** — Playwright screenshot sheets ×14 baselines in the
browser job (#287, #288); the **undo-delete** recipe (tombstone
restore, zero new JS; blessed `\uXXXX`-escaping for `HX-Trigger`
headers) (#293, #294); and the **file-upload** recipe +
`installUploadProgress()` (monotonic progress, OOB fresh-form reset)
(#295–#297). Fixes along the way: `.hc-toolbar[hidden]` actually hides,
the inline-edit scaffold's missing `outerHTML`, and the
upload-progress ancestor-re-dispatch guard. All additive + fixes →
patch. **CLI `0.2.0`** (`cli-v0.2.0` tag) ships `validate` + the five
new recipe scaffolds, with linkedom as its first (lazy-loaded) runtime
dependency.

Core `0.1.8` (2026-07-04, `v0.1.8` tag) followed — the largest patch
yet, all additive: `hc-dropzone` + the file-upload dropzone variant
(#300, #301); `hc-stepper` + the `multi-step-form` wizard recipe
(#303, #304); chart Tiers 2 and 3 (#308, #309); `hc-tree` +
`installTree()` + the `lazy-tree` recipe (#311, #312); the complete
Japanese docs mirror (`/ja/`, phases 1–12, #313–#325); the v0.9
breadth set — `hc-meter`, `hc-rating`, the `hc-separator` label
variant, `hc-timeline` (#327–#331); and the v0.10 form patterns —
`hc-range` + `installRange()`, the `transfer` recipe (+`hc-transfer`
CSS), and the `cascading-select` recipe (#332–#335). **CLI `0.2.1`**
(`cli-v0.2.1` tag, published 2026-07-04) re-bundled the two new
recipes.

Post-0.1.8 (2026-07-04, PRs #338–#346, in **Unreleased**): a
quality-hardening batch, no new npm release yet — cross-browser
Playwright CI (Chromium / Firefox / WebKit matrix legs + a gate job
that keeps the required-check name; VRT stays Chromium-only), the
docs-i18n drift check (en page changes must touch their `ja/` twin),
the VRT sheets grown with the 0.1.8 components, two test-flake root
fixes (datagrid-lazy timer race; axe sampling theme transitions
mid-flight — theme-toggling axe specs must emulate
`reducedMotion: 'reduce'`), weekly-Lighthouse failure auto-issues,
and `/llms.txt` on the docs site. The
[road-to-1.0 audit](plans/hc-road-to-1.0-en.md) found **zero breaking
debt** across the whole public API surface and proposes skipping
`0.2.0`; the `1.0.0` go/no-go and timing rest with the maintainer.
A second wave (#347–#354) followed the same day: the plans status
sweep, the component-index consistency fix, and the
[docs clarity plan](plans/hc-docs-clarity-plan-en.md) **shipped in
full** — every copy-paste-broken example fixed, one template across
the component pages, recipe contract tables + the CLI aside
everywhere, the fundamentals cheat sheet / behaviors reference /
CDN path / tokens landing, and the toast Escape-dismiss fix
(the review's one component-side finding).

The [chat & streaming plan](plans/hc-chat-streaming-plan-en.md)
(#358) shipped next (2026-07-05), one PR per phase: `hc-chat` +
`hc-attachment` + `installChatScroll()` (#359), the `chat-messages`
recipe — one POST appends the user message + the aria-busy assistant
placeholder, 422 re-renders only the composer (#360), and the
`streaming-response` recipe — the placeholder owns its SSE connection,
`chunk` appends while aria-busy defers, `done`/`error` swap the final
message and close the stream (#361). All additive.

[`VERSIONING.md`](VERSIONING.md) defines the public API surface
(class names, data attributes, custom properties, exports, events) and
the deprecation-alias rule — renames need aliases now that alpha.0 has
shipped; the pre-alpha "no back-compat" rule is over.
