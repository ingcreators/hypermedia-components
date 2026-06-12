# HC Maintenance & Quality Plan v0.8 — post-0.1.0 quality debt, docs truth, CI guards

Status: **shipped** (created and fully executed on 2026-06-12; PRs
#210–#239, one per item). All twenty items landed: Track Q #212 / #214 /
#215 · R #211 / #221 / #222 · S #220 / #213 · T #223 / #225 / #227 ·
U #229 / #231 / #233 · V #234 / #235 / #236 · W #237 / #238 / #239 —
plus one unplanned flake fix found en route (#232, spinner bounding-box
measurement). `@hypermedia-components/cli` `0.1.0` reached npm `latest`
on 2026-06-12 (manual first publish — npm trusted publishing cannot
create a package; later releases are `cli-v*` tag-driven). Residuals
deliberately not picked up here: the two sub-100 docs-page Lighthouse
scores recorded on the reference/performance baseline (kitchen-sink
A11y 94, theme-builder A11y 93 / SEO 92). Originally: created after
`0.1.0` shipped to npm `latest` on 2026-06-12, PRs up to #209.

Where [v0.6](./hc-component-depth-plan-v0.6-en.md) and
[v0.7](./hc-component-breadth-plan-v0.7-en.md) grew the component surface,
this plan pays down the debt that growth left behind: a full-repo audit
(2026-06-12) found quality gaps that appear in **no existing plan** —
hard-coded shadows that bypass the token system, a README that undersells
the library ~4×, untested shared internals — plus stale plan-status
bookkeeping. It also picks two P3 items from the
[v0.5 backlog](./hc-next-phase-plan-v0.5-en.md) (Lighthouse benchmarks,
recipe CLI) now that the release machinery is proven. Companion to:

- [`hc-hypermedia-components-implementation-plan-v0.4-en.md`](./hc-hypermedia-components-implementation-plan-v0.4-en.md) — design principles, naming, DoDs.
- [`hc-next-phase-plan-v0.5-en.md`](./hc-next-phase-plan-v0.5-en.md) — release readiness + the P3 backlog this plan draws from.
- [`tesseraql-2026-06-response-en.md`](./tesseraql-2026-06-response-en.md) — the 0.1.0 response whose small docs-first promises Track V closes.
- [`VERSIONING.md`](../VERSIONING.md) — the public-API and semver rules every item below must respect.

## Guiding constraints (updated post-alpha)

Every item below MUST stay inside these lines (CLAUDE.md):

- **Vanilla JS (ESM)** behaviors — idempotent `installXxx(root=document)`
  returning an uninstaller; no TypeScript.
- **Native-first / Light DOM only**; state in HTML attributes
  (`aria-*` / `data-*` / native validity), not JS state objects.
- **Semantic classes + `data-variant` / `data-size`**; DTCG tokens →
  `--hc-*` custom properties.
- **htmx owns the network.** Behaviors never wrap `fetch()`.
- **Macros optional**; every macro documents its expanded HTML.
- **VERSIONING.md now governs** (the pre-alpha "no back-compat" rule ended
  at `0.0.1-alpha.0`): 0.x **patch** releases are strictly additive — new
  tokens / exports / components are fine, renames and removals are not;
  renames need a deprecation alias for ≥1 minor. CSS *declaration values*
  are explicitly **not** public API (VERSIONING §"What is NOT covered"),
  which is what makes the Track Q shadow normalization patch-safe.
- **Check the web-standard baseline** before adopting any new CSS/HTML
  primitive; gate bleeding-edge features behind a documented baseline and
  a JS fallback where it matters.
- Per-component **Definition of Done** (v0.4 plan §17.3 / §17.4) for any
  new docs page or CSS surface.

## Workflow (unchanged)

One concern per PR. Branch off **fresh `origin/main`** each time (no stacked
PRs). Verify locally before commit: `build`, `lint`, `test` (Vitest),
`typecheck`, `docs:build`, and the **full** Playwright browser suite. Commit
only when asked; merge only on the user's "マージして"; stop before merge and
report CI. Reply in Japanese; keep identifiers/code English. Never commit
the dev-only `.claude/` directory. Update `CHANGELOG.md` (Unreleased) for
every user-visible change. Confirm priority with the user before each track.

---

## Audit summary (verified against the working tree, 2026-06-12)

What the audit established, with the evidence trail:

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| 1 | **13 component stylesheets hard-code `box-shadow` colors** (`rgb(0, 0, 0, …)` literals) instead of going through the token pipeline: dialog, drawer, popover, menu, combobox, multicombobox, command, navmenu, hovercard, toast, datagrid, switch, tabs. Not themeable; black shadows are wrong on dark surfaces; violates the DTCG single-source-of-truth rule. The `--hc-shadow-*` namespace is unused (no collision with `--hc-scroll-area-shadow*` / `--hc-datagrid-freeze-shadow`). | `grep -rn "box-shadow" packages/core/src/css \| grep -E "rgba?\("` | HIGH |
| 2 | **README.md is badly stale**: claims 13 CSS components / 5 behaviors / 9 recipes / 5 guides / "Pre-alpha" / 3 CI jobs. Reality: **53** component stylesheets, **32** `install*` exports, **12** recipes, **8** integration guides, `0.1.0` on `latest`, 4 CI jobs. CLAUDE.md has the same drift (52→53 stylesheets, 71→77 Playwright specs, header says "Deploy: Cloudflare Pages" — it's Workers). | `ls packages/core/src/css/hc-*.css \| wc -l` etc. | HIGH |
| 3 | **Docs coverage**: `hc-anchored.css` is reachable through the public `./css/*` export and has real opt-in API (`data-side` / `data-align`, `--hc-anchored-offset/arrow-*`) but no docs page. `hc-chart.css` having no *component* page is **by design** (v0.7 "Explicitly OUT"; the recipe page is the contract). `context-menu.mdx` without its own CSS is fine — the page says "no new CSS — reuses `.hc-menu`". | `apps/docs/src/content/docs/` vs `packages/core/src/css/` | HIGH (anchored only) |
| 4 | **Shared internal modules have no unit tests**: `anchor-fallback.js` (positioning fallback under tooltip/popover/hovercard/combobox/navmenu — browser-tested only), `field-error-core.js` (shared by `installValidation` + `installFieldErrors`), `menu-core.js` (shared by menu/context-menu/menubar). One regression breaks several behaviors at once. | `ls packages/core/test/` | MEDIUM |
| 5 | **No docs link checking in CI** — broken internal links ship silently. | `.github/workflows/ci.yml`, `apps/docs/astro.config.mjs` | MEDIUM |
| 6 | Hygiene: `.devcontainer/devcontainer-lock.json` untracked; no `.github/ISSUE_TEMPLATE/`; 2 unused `eslint-disable` directives in `test-browser/`; `examples/README.md` presents all six dirs as runnable while 4 are `.gitkeep`-only stubs. | `git status`, `.github/`, `examples/` | LOW |
| 7 | Plan bookkeeping: `hc-docs-polish-plan-v0.1-en.md` still says "proposed" although most of it demonstrably shipped (PRs #138–#183: `Demo.astro`, grouped sidebar, `ComponentGallery.astro`). The v0.5 "deferred items" table is similarly overtaken (checkbox/radio/progress/tooltip, the integration guides, recipes, d.ts, npm publish, Cloudflare deploy — all done). | `plans/`, git log | LOW |

Decisions taken with the user (2026-06-12): scope = maintenance **plus two
P3 feature picks** (W1 benchmarks, W2 recipe CLI); the four empty example
scaffolds are **deleted**, not implemented (U3).

---

## Tracks & backlog

Ordered by value ÷ cost. Each item is one PR unless noted. Sizes: **S**
(hours), **M** (a day), **L** (multi-day).

### Track Q — shadows through the token pipeline (flagship)

- **Q1. Elevation scale `--hc-shadow-*` + adoption.**
  `feat(tokens)` · **M** · patch-safe
  Add a `shadow` group to `packages/core/src/tokens/semantic.tokens.json`
  (elevation is UI meaning, like the existing `color.overlay`):

  ```json
  "shadow": {
    "sm":      { "$type": "shadow", "$value": "0 1px 2px rgb(0, 0, 0, 0.15)" },
    "md":      { "$type": "shadow", "$value": "0 4px 12px rgb(0, 0, 0, 0.1)" },
    "lg":      { "$type": "shadow", "$value": "0 8px 24px rgb(0, 0, 0, 0.12)" },
    "overlay": { "$type": "shadow", "$value": "0 10px 30px rgb(0, 0, 0, 0.15)" }
  }
  ```

  and dark overrides at the same paths in `theme.dark.tokens.json`
  (stronger alphas ≈0.45–0.6 so elevation stays legible on dark surfaces —
  final values eyeballed on the kitchen sink in the PR). Values are **CSS
  string composites**, the transformer's intended shape (`token-transform.mjs`
  stringifies `$value`; `color.overlay` and `scroll-area.shadow` are prior
  art) — this deliberately does *not* prejudge the deferred Style Dictionary
  question. Because both files already exist, `build-tokens.mjs`,
  `CORE_NAMESPACES`, and the docs ThemeBuilder pick the group up with
  **zero changes**, and the vars land in `hc.tokens.core.css` for free.
  No per-component aliases: component CSS reads `var(--hc-shadow-lg)`
  directly, the same way it reads `var(--hc-color-focus-ring)`
  (CONTRIBUTING: "a value used once is not yet a token").

  Replacement map (mechanical; declaration values are not public API, so
  small normalizations are allowed):

  | File | Current literal | Becomes |
  | --- | --- | --- |
  | `hc-switch.css` (thumb) | `0 1px 2px rgb(0, 0, 0, 0.15)` | `var(--hc-shadow-sm)` (identical) |
  | `hc-toast.css` | `0 4px 12px rgb(0, 0, 0, 0.08)` | `var(--hc-shadow-md)` (α 0.08→0.1) |
  | `hc-popover.css` | `0 6px 20px rgb(0, 0, 0, 0.12)` | `var(--hc-shadow-lg)` (6/20→8/24) |
  | `hc-menu.css` / `hc-combobox.css` / `hc-multicombobox.css` / `hc-command.css` / `hc-navmenu.css` | `0 8px 24px rgb(0, 0, 0, 0.12)` | `var(--hc-shadow-lg)` (identical) |
  | `hc-hovercard.css` | `0 8px 24px rgb(0, 0, 0, 0.14)` | `var(--hc-shadow-lg)` (α 0.14→0.12) |
  | `hc-datagrid.css` (drag ghost) | `0 4px 12px rgb(0, 0, 0, 0.25)` | `var(--hc-shadow-lg)` (confirm visually) |
  | `hc-dialog.css` | `0 10px 30px rgb(0, 0, 0, 0.15)` | `var(--hc-shadow-overlay)` (identical) |
  | `hc-drawer.css` | `0 0 30px rgb(0, 0, 0, 0.2)` | `var(--hc-shadow-overlay)` — geometry changes from ambient to directional; check edge-attached drawers with screenshots, and if it regresses keep a local `--hc-drawer-shadow: var(--hc-shadow-overlay)` hook instead |

  Docs: add `--hc-shadow-*` to the full-theme-override guidance in
  `tokens/themes.mdx`; update `packages/core/src/tokens/README.md`.
  CHANGELOG (Unreleased): *Added* — elevation token scale, shadows now
  themeable and dark-mode-aware; *Changed* — note the minor visual
  normalization.
  *DoD:* tokens build (var count grows by 4 + 4 dark overrides);
  `test/tokens.test.mjs` asserts via `buildRealTokens()` that
  `--hc-shadow-overlay` appears in both the light and `[data-theme="dark"]`
  blocks with different values; a browser spec asserts the computed
  `box-shadow` of `.hc-dialog` / `.hc-menu` is non-`none` and differs
  between themes; after this PR the only literal-color shadows left are
  the tabs/datagrid edge hints (Q2's job); kitchen sink eyeballed in
  light + dark.

- **Q2. Scroll-edge shadow color token (tabs + datagrid).**
  `feat(tokens)` · **S** · patch-safe
  The tabs scroll fades and the datagrid freeze shadows are mirrored /
  directional — geometry stays in CSS; tokenize **only the color**. Add
  `shadow.edge` (`$type: "color"`) to `semantic.tokens.json`
  (`rgb(0, 0, 0, 0.2)`) + `theme.dark.tokens.json` (`rgb(0, 0, 0, 0.5)`),
  then swap the color term in `hc-tabs.css` and in the
  `--hc-datagrid-freeze-shadow` declarations (`2px 0 4px -2px
  var(--hc-shadow-edge)`; datagrid α 0.25→0.2 is an accepted
  normalization). Leave `component.scroll-area.shadow` alone (already a
  token). Separate PR from Q1 — different mechanism (color-only token vs
  composite scale).
  *DoD:* same treatment as Q1 scaled down; `grep` for literal-color
  `box-shadow` in `src/css` returns **zero**.

- **Q3. Stylelint guard — no literal colors in `box-shadow`.**
  `chore(lint)` · **S** · dev-only · **after Q1+Q2 merge** (fails before)
  In `packages/core/.stylelintrc.json`:

  ```json
  "declaration-property-value-disallowed-list": [
    { "box-shadow": ["/rgba?\\(/", "/hsla?\\(/", "/oklch\\(/", "/#[0-9a-fA-F]/"] },
    { "message": "box-shadow colors must come from the token scale (--hc-shadow-*) — no literal colors." }
  ]
  ```

  Verified against the surviving legitimate patterns: `var(--hc-*)`,
  `none`, and the focus rings' `color-mix(in srgb, var(--hc-color-focus-ring) 35%, transparent)`
  all pass (no `rgb(`/`#` substring). Add one sentence to CONTRIBUTING's
  tokens section.
  *DoD:* `lint:css` green; a deliberate local violation confirms the rule
  fires.

### Track R — docs & meta truth

- **R1. Bring README.md and CLAUDE.md in line with 0.1.0.**
  `docs(meta)` · **S**
  README "What's included" becomes **rounded counts + stable links** (no
  count-generation script — CLAUDE.md itself says counts go stale; instead
  record the re-verification one-liners in the PR description): "50+ CSS
  components", "30+ behaviors", "12 recipes", "8 integration guides",
  token pipeline with the four runtime axes, "Vitest + Playwright + axe"
  for tests. Same PR (same concern — stale meta): README *Project status*
  (`0.1.0` on `latest`, link VERSIONING.md, drop "Pre-alpha"), CI section
  (four jobs incl. lint), repo-layout `plans/` line; CLAUDE.md
  "Implemented surface" rewritten with verified numbers + as-of date, and
  header `Deploy: Cloudflare Pages` → `Cloudflare Workers`. DEPLOYMENT.md
  already carries the Pages→Workers terminology note — verify the one
  dashboard-label string against the live dashboard and change only
  genuinely wrong text (possible no-op; record the outcome in the PR).
  *DoD:* every number in README/CLAUDE.md reproducible by a recorded
  one-liner; `docs:build` green.

- **R2. Fundamentals page for the anchored-positioning infrastructure.**
  `docs(fundamentals)` · **S**
  New `apps/docs/src/content/docs/fundamentals/anchored.mdx` (the
  Fundamentals sidebar group autogenerates — no config change): what
  `hc-anchored.css` + `anchor-fallback.js` are; the per-instance
  `data-side` / `data-align` API; shared knobs (`--hc-anchored-offset`,
  `--hc-anchored-arrow-border`, `--hc-anchored-arrow-size`); CSS Anchor
  Positioning baseline note + when the JS fallback engages; framing as
  "internal infrastructure — imported automatically by
  tooltip/popover/hovercard/navmenu, also reachable as
  `./css/hc-anchored`". Cross-link from the consuming component pages.
  Record here for posterity: **`hc-chart` gets no component page by
  design** — the chart recipe page is the documented contract (v0.7
  "Explicitly OUT").
  *DoD:* page builds, sidebar shows it, cross-links resolve (S1 validates
  them once it lands).

- **R3. Reconcile `hc-docs-polish-plan-v0.1` status.**
  `chore(plans)` · **S**
  Verify each P0–P2 item against the shipped docs (P0-1 `Demo.astro`,
  P0-3 grouped sidebar, P1-1 `ComponentGallery` already confirmed; check
  P0-2 preview canvas, P0-4 landing showcase, P1-2 examples-first
  structure, P2-1 typography, P2-2 expressive-code individually). Update
  its Status header to `shipped (PRs #138–#183) — residual: <list>` and
  move any true residuals into this plan's backlog. `plans/` only; no
  CHANGELOG.

### Track S — CI & lint guards

- **S1. Build-time docs link validation.**
  `ci(docs)` · **S**
  Add `starlight-links-validator` to `apps/docs` devDependencies and
  `plugins: [starlightLinksValidator()]` in the `starlight()` options of
  `astro.config.mjs`. Rationale vs lychee/linkinator: it runs at build
  time on the rendered route graph — no network, no new CI job, the
  existing docs job's `docs:build` simply starts failing on broken links;
  it understands the `/hypermedia-components` base path. Confirm the
  plugin release supports Starlight 0.40 (just upgraded in Unreleased).
  Fixing whatever rot the first run finds is part of this PR's concern.
  *DoD:* `docs:build` green with the validator on; at least the
  intentional-404 risk class is gone.

- **S2. ESLint directive hygiene.**
  `chore(lint)` · **S**
  Delete the two verified-unused disables —
  `test-browser/anchor-fallback.spec.mjs` (`no-global-assign` never fires
  on the `CSS.supports = …` member write) and
  `test-browser/datagrid.spec.mjs` (`no-await-in-loop` is not enabled) —
  and root-cause it: `linterOptions: { reportUnusedDisableDirectives:
  'error' }` in `packages/core/eslint.config.mjs`.
  *DoD:* `lint:js` green; re-adding a stray disable fails the lint.

### Track T — unit tests for shared internals (test-only; three PRs)

- **T1. `test/anchor-fallback.test.mjs`.** · **M**
  `supportsAnchorPositioning()` is false under jsdom (fallback path
  routes); `readSideAlign` parsing of `data-side`/`data-align` incl.
  defaults; `positionFloating` geometry with stubbed
  `getBoundingClientRect` (placement per side, flip on overflow, viewport
  clamping, RTL inline alignment); `trackFloating` cleanup detaches
  scroll/resize listeners and is idempotent. The Playwright
  `anchor-fallback.spec.mjs` stays the integration layer.

- **T2. `test/field-error-core.test.mjs`.** · **S**
  `fieldOf` closest-`.hc-field` resolution incl. null safety;
  `ensureDescribedBy` idempotent token append; `pruneDescribedBy` removes
  only its own token (and the attribute when empty); `getOrCreateError`
  creates/reuses the error node with stable id + `aria-live` wiring.
  Locks the contract shared by `installValidation` + `installFieldErrors`.

- **T3. `test/menu-core.test.mjs`.** · **S–M**
  `itemsOf` scoping (items inside `role="group"` included, nested submenu
  items excluded); `isEnabled`; `radioGroupOf`; `focusByOffset` wrap +
  disabled skip; `typeaheadStep`; `handleMenuNavKeydown` key map;
  `selectMenuItem` checkbox toggle, radio-group exclusivity, and the
  `hc:menuselect` detail shape (a public event contract, VERSIONING §5).

### Track U — repo hygiene

- **U1. Commit `devcontainer-lock.json`.** `chore(devcontainer)` · **S**
  The devcontainer docs recommend committing the lock file — it pins the
  two feature digests, matching the repo's pnpm-lock posture. Clears the
  standing `??` in `git status`.

- **U2. Issue templates.** `chore(github)` · **S**
  `.github/ISSUE_TEMPLATE/{bug_report,feature_request,docs}.yml` +
  `config.yml` (blank issues off; links to the docs site and SECURITY.md).
  The bug form asks for: version, consumption path (bundle / granular /
  CDN), htmx version, repro markup.

- **U3. Delete the four empty example scaffolds; truthful examples README.**
  `chore(examples)` · **S** · user-decided 2026-06-12
  Remove `examples/{go,java-thymeleaf,python-django,rails}/`
  (`.gitkeep`-only). Rewrite `examples/README.md`: "Runnable: plain-html
  (:4322), htmx (:4323)" + "Other frameworks: see the matching
  integration guide" with links. Fix the CLAUDE.md repo-layout line
  ("others scaffolded"). Grep docs for links into the deleted dirs first.
  Revive from the integration guides if demand appears.

### Track V — TesseraQL follow-ups (small docs-first promises from the 0.1.0 response)

- **V1. Page-header pattern.** `docs(blocks)` · **S**
  A documented back-link + title + actions header on `blocks.mdx`, built
  from the existing `.hc-cluster` + logical margins. New CSS only if
  unavoidable — then token-driven and under the component DoD.

- **V2. Confirm-flow focus management.** `docs(confirm)` · **S**
  State explicitly on the confirm-action recipe page where focus goes
  after confirm / cancel. If a behavior change (not just prose) turns out
  to be needed, add the Playwright assertion with it.

- **V3. Recipe contract consistency pass.** `docs(recipes)` · **S**
  Normalize the 12 `recipes/*/contract.md` files to one structure
  (headers, status codes, fragment shapes). Contracts are **public API**
  (VERSIONING §8): this pass may only *clarify* — any item that would
  change a shape leaves this plan and gets the deprecation treatment.

### Track W — P3 feature picks (user-selected)

- **W1. Lighthouse / CWV benchmarks on the deployed docs.**
  `ci(perf)` · **S–M**
  Measure the key pages on
  `hypermedia-components.ichimura-12c.workers.dev` — landing, one
  component page, kitchen sink, Blocks, theme builder — via a
  **non-blocking** scheduled / manually-dispatched workflow (not a PR
  gate; the deployed site is what's measured). Record scores in a new
  `reference/performance.mdx` shaped like `reference/size.mdx`. Tool
  choice (Lighthouse CI vs unlighthouse) and budget values decided in the
  PR.
  *DoD:* workflow runs green against the live site; scores page builds;
  budgets documented.

- **W2. Recipe-copying CLI (`@hypermedia-components/cli`).**
  `feat(cli)` · **M–L** · last; two PRs
  `npx @hypermedia-components/cli add <recipe>` copies
  `recipes/<name>/{recipe.html,expanded.html,contract.md}` into the
  target directory. Zero runtime deps; recipes bundled in the tarball
  (offline-friendly).
  **W2a** — new `packages/cli` workspace package: bin, `add` + `list`
  commands, recipe sync at build time, Vitest coverage, README. No
  publish yet.
  **W2b** — release wiring: extend `release.yml` OIDC trusted publishing
  to the second package and decide the versioning mode (independent vs
  lockstep with core).
  *DoD (W2a):* `pnpm --filter @hypermedia-components/cli test` green;
  `node packages/cli/bin/… add confirm-action` produces the three files.
  *DoD (W2b):* a dry-run publish succeeds; VERSIONING.md gains a short
  CLI section.

---

## Explicitly deferred (and why)

- **Package split** (`/tokens`, `/css`, `/behaviors`) — still no demand
  signal three days after `latest`; splitting multiplies release surface
  and `exports`-map risk for zero current consumer benefit (v0.5 §6 stance
  unchanged).
- **Style Dictionary migration** — the bespoke transformer is small,
  unit-tested, and **browser-importable** (the docs ThemeBuilder depends
  on that; Style Dictionary is Node-only, so migrating forces a
  theme-builder redesign). Q1 deliberately uses string composites so it
  does not force this decision. Revisit only if strict DTCG composite
  types become a requirement.
- **Japanese docs i18n** — sequence after the English IA fully settles
  (R3 residuals + S1 link validation de-risk it).
- **Chart Tiers 2/3** — owned by
  [`hc-chart-recipe-plan-en.md`](./hc-chart-recipe-plan-en.md); feature
  work, not maintenance.
- **Implementing go / java-thymeleaf / python-django / rails examples** —
  scaffolds deleted (U3); the integration guides remain the contract;
  implement on demand.
- **`tsconfig` strict / `checkJs`** — the public type surface is already
  strict-guarded by `tsconfig.smoke.json` + `test/types.smoke.ts`.
  Flipping `checkJs` over 39 vanilla-JS files is a large JSDoc project
  with no change to the emitted d.ts. Recorded spike instead: run
  `tsc --noEmit` with `checkJs`/`strict` once, note the error count, then
  decide; default is defer until a TS-migration or package-split decision
  forces it.

---

## Suggested sequencing (avoid stacked PRs)

Dependencies: **Q3 strictly after Q1+Q2** (the guard fails otherwise);
**S1 before or alongside R2/R3** (avoid double-fixing link rot). Everything
else is independent — each PR off fresh `origin/main`.

1. R1 README/CLAUDE.md truth (front door; cheapest high-value) →
2. Q1 elevation tokens (flagship) → 3. S2 eslint hygiene (tiny) →
4. Q2 edge-shadow token → 5. Q3 stylelint guard → 6. S1 links validator →
7. R2 anchored fundamentals → 8. R3 plan reconciliation →
9. T1 → 10. T2 → 11. T3 → 12. U1 → 13. U2 → 14. U3 →
15. V1 → 16. V2 → 17. V3 → 18. W1 → 19. W2a → 20. W2b.

**First batch: R1 + Q1 + S2.** After Q1–Q3 land, everything shipped is
additive → eligible to cut **`0.1.1`** per VERSIONING (Unreleased already
holds the Astro 6.4 Security entry). W2b's CLI publish is a separate
decision. Re-evaluate priority with the user before each track; ship one
PR at a time and stop before merge.
