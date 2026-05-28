# Hypermedia Components — Next Phase Plan (v0.5)

**Project:** Hypermedia Components
**Predecessor plan:** [`hc-hypermedia-components-implementation-plan-v0.4-en.md`](hc-hypermedia-components-implementation-plan-v0.4-en.md) — implemented and merged in PR #1 (squash commit `be72271`, 2026-05-28).
**Date:** 2026-05-28

---

## 0. Executive summary

The v0.4 plan delivered the full MVP component / behavior / recipe /
docs / test surface. This document plans the work needed to take the
project from "pre-alpha, all functionality in place" to "published
`0.0.1-alpha.0` with a deployed docs site and a polished MVP."

The work splits into four tracks:

1. **Release readiness** — unblock the first npm publish and docs deploy.
2. **MVP polish** — finish the remaining items from the v0.4 plan that
   were deliberately deferred.
3. **Quality** — visual regression, expanded browser test coverage,
   build optimization.
4. **P3 backlog** — stretch work that can land any time after the
   alpha.

Tracks 1–3 should be tackled roughly in order. Track 4 can be picked
from at any time when capacity allows.

---

## 1. Snapshot of what's done

The post-merge state is described in
[`CLAUDE.md`](../CLAUDE.md#implemented-surface-post-pr-1) and the
Unreleased section of [`CHANGELOG.md`](../CHANGELOG.md). Highlights:

```text
13 CSS components       button, input, field, card, table, badge, alert,
                        dialog, popover, spinner, toast, toolbar, pagination
209 --hc-* variables    primitive / semantic / component / theme.dark
5 behaviors             confirm, toast, close-dialog, close-popover, remote-dialog
2 macros                <hc-confirm-action>, <hc-live-search>
9 recipes               request-action, confirm-action, live-search, toast,
                        remote-dialog, filter-popover, data-region, inline-edit,
                        lazy-panel
5 integration guides    Thymeleaf, Django, Rails, Go, Razor
40 docs pages
73 unit tests           Vitest + jsdom
31 browser tests        Playwright + Chromium (incl. 6 axe-core a11y scans)
4-job CI                lint, unit, docs, browser — all on Node 24 LTS
```

Every component meets §17.3 DoD; every recipe meets §17.4 DoD.

---

## 2. What is deliberately deferred from v0.4

These were skipped in PR #1 and are the natural backlog. They are
re-prioritized into the tracks below.

| Item | Plan ref | Status |
| --- | --- | --- |
| `hc-checkbox` | §11.1 | Not built |
| `hc-radio` | §11.1 | Not built |
| Density modes (`comfortable` / `compact` / `dense`) | §9.3 | Semantic spec exists; no JSON / no CSS |
| Hyperscript integration docs | §7.5 IA | Not authored |
| Hyperscript alternative behaviors | §13.1 | Not authored |
| `recipes/<name>/` HTML source format | §15.1 | Directories exist; files empty |
| `integrations/plain-html.mdx` | §7.5 IA | Not authored |
| `integrations/htmx.mdx` | §7.5 IA | Not authored |
| TypeScript `.d.ts` generation | — | `exports.types` points at a missing file |
| Cloudflare Pages deployment | §8 | No project provisioned |
| npm publish | §20 | `release.yml` drafted, untested |
| Visual regression tests | §17.1 | Not configured |
| Browser tests for close-dialog / close-popover / remote-dialog | — | jsdom unit tests only |

---

## 3. Track 1 — Release readiness

**Goal:** make `0.0.1-alpha.0` publishable to npm and serve docs at a
public URL. Pick this up first.

### 3.1 Resolve the `exports.types` entry

`packages/core/package.json` declares `"types": "./dist/index.d.ts"`
but no `.d.ts` file is produced. Two options:

- **Option A (recommended):** generate types from JSDoc with
  `tsc --emitDeclarationOnly --allowJs` and a minimal `tsconfig.json`.
  No source migration needed; the JSDoc added in v0.4 is the input.
- **Option B:** drop the `"types"` entry until we genuinely ship
  types. Less work but every TypeScript consumer sees an "any" import.

Acceptance:
- `pnpm --filter @hypermedia-components/core build` writes
  `dist/index.d.ts` covering at least all `installXxx` exports.
- A small TS smoke file under `test/` imports from the package and
  type-checks cleanly via `pnpm exec tsc --noEmit`.

### 3.2 Dry-run the release workflow

`.github/workflows/release.yml` publishes on `v*` tag push but has
never run end-to-end.

Acceptance:
- `npm pack` on `packages/core` produces a tarball whose `files` field
  matches the package's intended surface (no test files, no `src/js`).
- Tag `v0.0.0-rc.0` (or similar) on a throwaway branch and dispatch
  `release.yml` against a private dist-tag (`alpha-rc`) to confirm the
  pipeline works without committing to npm latest.

### 3.3 Provision Cloudflare Pages

Per plan §8: choose between Worker proxy and subdomain. Recommended
launch sequence (§8.5):

1. Create the Cloudflare Pages project pointed at the GitHub repo.
2. Build command: `pnpm install --frozen-lockfile && pnpm -w run docs:build`. Output: `apps/docs/dist`.
3. Land on the default `*.pages.dev` URL first to verify the
   Starlight `base: '/hypermedia-components'` routing.
4. Once green, attach `hypermedia-components.ingcreators.com` (subdomain
   route) as the operational fallback URL.
5. Layer the Worker route for `ingcreators.com/hypermedia-components/*`
   when the rest of the deploy is stable.

Acceptance:
- Public docs URL serves the live build of `main`.
- A PR triggers a Cloudflare preview deployment.

### 3.4 Cut `0.0.1-alpha.0`

When 3.1–3.3 are green:

1. Move `Unreleased` → `[0.0.1-alpha.0] - YYYY-MM-DD` in `CHANGELOG.md`.
2. Bump `packages/core/package.json` `version` to `0.0.1-alpha.0`.
3. Tag, push tag, observe `release.yml`.
4. Smoke-test the published artifact via a fresh consumer:
   ```bash
   mkdir /tmp/hc-consumer && cd /tmp/hc-consumer
   npm init -y
   npm install @hypermedia-components/core@alpha
   node -e "import('@hypermedia-components/core').then(m => console.log(Object.keys(m)))"
   ```

---

## 4. Track 2 — MVP polish

**Goal:** close the remaining items from the v0.4 plan that were
deferred. These are largely incremental authoring work.

### 4.1 `hc-checkbox` and `hc-radio`

Components listed in §11.1 but skipped. They are styled controls, not
behaviors — keep the native input semantics.

Approach:
- Use `appearance: none` plus a custom check/dot via `::before`.
- Variants: `default`, `success`, `danger` (mirroring `data-variant`
  family used elsewhere).
- States: `:checked`, `:focus-visible`, `:disabled`, `[aria-invalid]`.
- Group helper: optional `.hc-field` parent for label + helper text
  pattern (works with the existing `hc-field` styles).

Each gets a docs page following the §7.7 template plus a Playwright
spec validating keyboard activation and Space-to-toggle.

### 4.2 Density modes

Plan §9.3 already specifies the JSON shape:

```text
:root, [data-density="comfortable"]   --hc-control-height: 40px;  --hc-control-padding-x: 16px;
[data-density="compact"]              --hc-control-height: 32px;  --hc-control-padding-x: 12px;
[data-density="dense"]                --hc-control-height: 28px;  --hc-control-padding-x: 8px;
```

Acceptance:
- Three new files under `packages/core/src/tokens/`:
  `density.comfortable.tokens.json`, `density.compact.tokens.json`,
  `density.dense.tokens.json`.
- `scripts/build-tokens.mjs` emits each as its own selector block.
- A new docs page `tokens/density.mdx` shows the attribute toggle.
- A Vitest token-transform test asserts the three density blocks
  appear in the output.

### 4.3 Hyperscript story

Plan §13.1 lets hyperscript stay an optional alternative — the
default behavior implementations are vanilla. The gap is documentation:

- `integrations/hyperscript.mdx` — how to mount hyperscript alongside
  Hypermedia Components.
- A "hyperscript equivalent" section in `recipes/confirm-action.mdx`
  showing the same flow expressed in `_hyperscript`.

### 4.4 `recipes/<name>/` source format

Plan §15.1 says each recipe ships `recipe.html`, `expanded.html`, and
`contract.md` in the source repo. Today the directories are scaffolded
but mostly empty. Fill in the nine recipes that have mdx docs.

Acceptance:
- `recipes/<name>/recipe.html` is the short recommended snippet.
- `recipes/<name>/expanded.html` is the full htmx-wired HTML.
- `recipes/<name>/contract.md` documents the server response shape.
- Optional: add a docs-build hook that imports `recipe.html` /
  `expanded.html` into the corresponding mdx page so they stay in
  sync.

### 4.5 Meta-integration docs

Three thin pages to round out the integrations section:

- `integrations/plain-html.mdx` — copy-paste the assets, no template
  engine.
- `integrations/htmx.mdx` — htmx-specific notes (configuration,
  request headers, `htmx:configRequest`, `HX-Trigger`) that the
  framework guides currently repeat.
- `integrations/hyperscript.mdx` (see §4.3).

---

## 5. Track 3 — Quality

### 5.1 Browser tests for the remaining behaviors

`installCloseDialog`, `installClosePopover`, and `installRemoteDialog`
currently only have jsdom unit tests. Promote each to a Playwright
spec that exercises a real htmx round-trip via the example server
(or a minimal fixture that simulates htmx event dispatch).

### 5.2 Visual regression

Use `page.screenshot` against the fixture to baseline each component
in light + dark themes. Store baselines under
`test-browser/__snapshots__/` and gate on diff.

Decisions to make:
- Single resolution (1280×800) or matrix?
- Mask the focus ring or include it?
- Where to store baselines — committed or downloaded artifact?

Acceptance:
- A `visual.spec.mjs` covers at least button / input / field / card /
  alert / badge / table / dialog open / popover open / toast visible.

### 5.3 a11y in the examples

Currently axe runs only on the test fixture. Extend coverage:
- `examples/plain-html` — every section.
- `examples/htmx` — after each htmx swap, re-run axe on the affected
  region.

### 5.4 Build optimization

- Minified `hc.min.css` variant (current bundle is ~29 KB raw).
- Real bundler for behaviors (esbuild) to ship a single
  `dist/hc.behaviors.min.js`. The current `bundle-js.mjs` just copies
  modules, which leaves the relative-import shape exposed to consumers
  and the dist files unminified.
- Publish size baseline in the docs (`tokens/overview.mdx` or new
  `reference/size.mdx`).

---

## 6. Track 4 — P3 backlog

No specific milestone — pick from when capacity allows.

- **CLI for copying recipes** — `npx @hypermedia-components/cli add confirm-action` copies the `recipes/<name>/` files into a target directory. Useful once §4.4 lands.
- **Package split** — `@hypermedia-components/tokens`, `/css`, `/behaviors`, `/macros` once the API surface stabilizes (plan §5.4 lists candidates).
- **Japanese i18n** — translate the first 10 docs pages (§7.6) after the English IA settles.
- **Additional components** — `hc-tabs`, `hc-tooltip`, `hc-progress`, `hc-breadcrumbs`. Not in plan §11.1 but commonly requested.
- **Style Dictionary migration** — replace the bespoke token transformer (plan §9.5 mentions this as an option). Defer until the JSON sources stabilize.
- **Performance benchmarks** — lighthouse + CWV scores on the deployed docs.

---

## 7. Roadmap suggestion

Loose week-shaped buckets, mirroring the v0.4 plan §18 cadence. Adjust freely.

### Week 5 — Track 1 (release readiness)

- Types or `types`-entry cleanup (§3.1).
- Cloudflare Pages provisioning (§3.3).
- Release workflow dry-run (§3.2).
- Cut `0.0.1-alpha.0` (§3.4).

Deliverables: published alpha on npm, public docs URL.

### Week 6 — Track 2 (MVP polish, first half)

- `hc-checkbox` + `hc-radio` (§4.1).
- Density modes (§4.2).
- `recipes/<name>/` source format (§4.4).

### Week 7 — Track 2 (second half) + Track 3 (kickoff)

- Hyperscript docs + alternatives (§4.3).
- Meta-integration pages (§4.5).
- Browser tests for the three remaining behaviors (§5.1).
- a11y in examples (§5.3).

### Week 8 — Track 3 (continue)

- Visual regression (§5.2).
- Build optimization (§5.4).
- Cut `0.0.1-alpha.1` with bug fixes and the new components.

### Week 9+ — Track 4 picks

Choose CLI, additional components, or i18n based on user demand.

---

## 8. Acceptance criteria for an "alpha-1 done" milestone

A reasonable definition of "first usable release" once Tracks 1–2
land:

- [ ] `@hypermedia-components/core@0.0.1-alpha.X` installable from npm.
- [ ] Docs live at a public URL (the final IA path can land later).
- [ ] `hc-checkbox` + `hc-radio` complete the §11.1 MVP list.
- [ ] Density modes attribute-toggleable.
- [ ] Every recipe has both an mdx docs page **and** a `recipes/<name>/`
      source-format directory.
- [ ] Hyperscript integration page lives next to the framework guides.
- [ ] CI still 4-job green on every push.
- [ ] CHANGELOG has dated entries; semver continues to apply.

---

## 9. Risks (carried forward from v0.4 §22)

The risks called out in §22 of the v0.4 plan still apply:

| Risk | Mitigation status |
| --- | --- |
| Core APIs become domain-specific | Watched. v0.4 stayed neutral; review new components before merge. |
| Macro layer becomes a framework | Watched. Macros remain optional, documented expanded HTML. |
| CSS grows too large | 29 KB unminified is acceptable; §5.4 will measure post-minify. |
| htmx examples become too magical | The framework integration guides showed both raw and macro forms. Keep that. |
| Cloudflare path deployment causes asset issues | §3.3 attacks this first by landing on `*.pages.dev` before the production path. |
| DTCG tooling compatibility | The hand-rolled transformer is small (~150 lines) and isolated; revisit Style Dictionary in Track 4. |

Add to the list during this phase: **npm tarball surface area** —
double-check `packages/core/package.json` `files` includes only what
the published surface needs.

---

## 10. How to start the next session

A fresh agent picking this up cold should:

1. Pull `main` and verify the project state still matches the
   `Implemented surface` section in `CLAUDE.md`. The verify script
   under [`memory/project_hypermedia_components.md`](../../.claude/projects/...)
   (or equivalent commands in `CLAUDE.md`) runs in under a minute.
2. Read §2 of this document to confirm what is _not_ done.
3. Pick Track 1 first unless directed otherwise — the rest of the
   tracks become more useful once an alpha exists to publish patches
   against.
4. Open a new branch with a `feat/` or `chore/` prefix per item; keep
   PRs scoped to one track section where possible.
