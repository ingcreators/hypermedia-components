# hc-chart — recipe + behavior plan (Observable Plot)

Status: **shipped in full — PR 1 (Tier 1), PR 2 (Tier 2, #308), PR 3 (Tier 3 + SSR path, #309).** Net-new scope; charts are
not mentioned in the v0.4 or v0.5 plans. Tier 1 (bar/line/area/combo) ships
the `chart` recipe, `installChart`, `hc-chart.css`, and `--hc-chart-*`
tokens. All three tiers shipped; the linkedom SSR path is documented in the contract.
A 2026-08 extension (§13, user-approved follow-up scope) adds the
interaction/axis options + escape hatch, horizontal bars, and waterfall.

## 1. Goal

A declarative, hypermedia-native chart pattern: the **server returns a
semantic `<table>`** (or embedded JSON), and a thin client behavior reads
the fixed table contract and renders an SVG chart with **Observable Plot**.
No per-chart JavaScript — chart type and per-series marks are declared in
markup (`data-hc-chart`, `<th data-mark>`).

Non-goal: re-implementing a charting engine. Plot owns the drawing; we own
the table→data contract, theming, htmx wiring, and progressive enhancement.

## 2. Why this shape (alignment with HC principles)

| HC principle | How hc-chart honours it |
| --- | --- |
| Data in HTML | The `<table>` IS the data source and the no-JS fallback. |
| Light DOM only | Plot emits inline `<svg>` into the light DOM. |
| Progressive enhancement | JS off → accessible table. JS on → table hidden (`hc-visually-hidden`), chart shown. |
| Behaviors stay small / never `fetch()` | Data arrives via htmx swap; the behavior only renders. |
| Behaviors return uninstallers / idempotent | `installChart()` follows the existing `INSTALL_KEY` + `WeakSet` pattern. |
| Semantic classes + `data-*` | `class="hc-chart"`, `data-hc-chart="bar"`, `data-mark="line"`. |
| DTCG tokens → `--hc-*` | New `--hc-chart-*` series/grid/axis tokens; series colours via `currentColor` + token palette. |

## 3. Critical architectural decision — Observable Plot is a PEER dependency

`packages/core` ships **zero runtime dependencies** today. Observable Plot
pulls in many `d3-*` packages (~hundreds of KB). Bundling it into core is
unacceptable.

**Resolution:** the behavior is **renderer-agnostic / Plot-injected.**

- `installChart(root, { plot })` accepts a Plot namespace, OR auto-detects
  `globalThis.Plot` (the UMD build loaded via `<script>`/CDN).
- If no Plot is found, the behavior **no-ops and leaves the table visible**
  (graceful degradation — still a valid, accessible page).
- Plot is declared as an **optional `peerDependency`** in
  `packages/core/package.json` (`peerDependenciesMeta: { optional: true }`).
- `installChart` is a **named, opt-in export** from the main entry. It is
  **NOT** added to the `behaviors.js` auto-init (which must work with zero
  deps loaded).

This keeps core dependency-free, the bundle tiny, and the chart strictly
opt-in — consistent with "macros are optional; never the only way."

## 4. Deliverables

1. **Tokens** — `src/tokens/component.tokens.json`: `component.chart.*`
   → `--hc-chart-*` (series palette, grid, axis, label, sizing).
2. **CSS** — `src/css/hc-chart.css` (+ register in `hc.layers.css` /
   bundle, add `./css/chart` export wiring as other components do).
3. **Behavior** — `src/js/chart.js` exporting `installChart`; add to
   `index.js` (named export) **only** (not `behaviors.js`).
4. **Recipe** — `recipes/chart/{recipe.html, expanded.html, contract.md}`.
5. **Docs** — `apps/docs/src/content/docs/recipes/chart.mdx` (or under a
   `components/` page if we treat it as a component — see §10).
6. **Tests** — Vitest (parsing, idempotency, uninstall) + Playwright
   (render, htmx:load re-scan, axe a11y scan, no-Plot degradation).
7. **CHANGELOG** — Unreleased entry.

## 5. The table contract (fixed per chart type)

Universal "tidy-from-table" convention for cartesian categorical charts:

- **Column 1 = x** (category / label).
- **Columns 2..N = series** (`<thead>` cell text = series name).
- Each `<td>` is coerced to a number (`+text`, stripping thousands sep).

Per-series mark via `<th data-mark="bar|line|area">` enables combo charts.
`data-hc-chart` on the figure is the **default mark** for columns without
an explicit `data-mark`.

```html
<figure class="hc-chart" data-hc-chart="combo" data-y-label="Sales ($k)">
  <table class="hc-table">
    <thead>
      <tr><th>Month</th><th data-mark="bar">Sales</th><th data-mark="line">Target</th></tr>
    </thead>
    <tbody>
      <tr><td>Jan</td><td>120</td><td>150</td></tr>
      <tr><td>Feb</td><td>200</td><td>160</td></tr>
    </tbody>
  </table>
</figure>
```

Charts whose axes are not "category × series" (scatter, histogram) define
their **own** fixed table shape, documented in `contract.md`. Embedded-JSON
variant (`<script type="application/json" class="hc-chart-data">`) is an
optional alternative source for multi-series / config-heavy cases, with the
`<` → `<` escaping requirement called out.

## 6. Supported chart types (tiered)

Each type = one entry in a **mark registry** `{ type → (data, opts) => Plot.Mark[] }`.

| Tier | Types | Plot marks | Table shape |
| --- | --- | --- | --- |
| **1 (MVP)** | `bar`, `line`, `area`, `combo` | `barY`, `lineY`, `areaY` (+`ruleY`, `dot`) | cat × series; combo via `data-mark` |
| **2** | `bar-stacked`, `bar-grouped`, `scatter`, `sparkline` | `barY`+stack, `barY`+`fx` facet, `dot`, `lineY` no-axis preset | as above; scatter = 2 numeric cols (+r, +category) |
| **3** | `histogram`, `heatmap` | `rectY`+`binX`, `cell` | numeric col; matrix |

**Known Plot limitation — pie / donut:** Plot is cartesian and has **no
arc/pie mark**. Out of scope for this recipe; if needed later it is a
custom SVG-path mark, documented separately. We state this explicitly
rather than implying full coverage (per the "no silent caps" habit).

**Dual y-axis (combo):** Plot has a single y scale. When series value
ranges differ by orders of magnitude, the secondary series is manually
rescaled into the primary range and a right-anchored `Plot.axisY` with the
inverse `tickFormat` is added, gated behind `data-secondary="<series>"`.
Same-axis combo needs no extra code.

## 7. Behavior design (`src/js/chart.js`)

Mirrors `toast.js` / `datagrid.js` conventions:

- `const INSTALL_KEY = '__hcChartUninstall'` — idempotent install.
- Scans `root.querySelectorAll('[data-hc-chart]')` on install.
- Subscribes to **`htmx:load`** on `document.body` to render charts that
  arrive via swap (matches the htmx re-scan pattern other behaviors use).
- `WeakSet` of already-rendered figures prevents double-draw.
- `readTable(figure)` → tidy rows `{ x, series, mark, value }` with numeric
  coercion and optional `data-x-type="date"` parsing.
- `buildMarks(type, rows, opts)` via the registry.
- `render(figure)` calls `plot.plot({ width, height, x, y, color, marks })`,
  appends the SVG, adds `hc-visually-hidden` to the source table (kept in
  DOM for screen readers + no-JS), sets `role="img"` + `aria-label`.
- Uninstaller removes the `htmx:load` listener and clears the registry;
  it does **not** rip out rendered SVGs (consistent with leaving
  user-rendered DOM alone).
- Configuration via `data-*`: `data-width`, `data-height`, `data-y-label`,
  `data-stacked`, `data-secondary`, `data-x-type`, `data-legend`.

## 8. Tokens & theming

Add to `component.tokens.json` (namespace dropped on emit → `--hc-chart-*`):

- `--hc-chart-series-1` … `--hc-chart-series-6` — series palette, sourced
  from existing accent + complete colour ramps (reuse primitives; see the
  "complete the colour ramps" preference rather than `color-mix`).
- `--hc-chart-grid`, `--hc-chart-axis`, `--hc-chart-label`,
  `--hc-chart-tick` — chrome colours from neutral/semantic tokens.
- `--hc-chart-height` (default plot height), `--hc-chart-font`.

`hc-chart.css` maps Plot's generated structure to these (Plot lets us pass
`className`; axis/grid/series styled via CSS custom properties so the chart
follows the active theme + density and the Theme Builder previews it).
Series marks use the token palette; single-series can fall back to
`currentColor` for trivial theming.

## 9. Tests

**Vitest (jsdom)** — no real Plot needed; inject a fake `plot` spy:
- table → tidy rows (single + multi series, `data-mark` distribution).
- numeric / date coercion; malformed cell handling.
- idempotency (double `installChart`), uninstaller removes listener.
- no-Plot path leaves the table visible and untouched.

**Playwright (+ axe)** — real Plot via a fixture page:
- bar/line/area/combo render an `<svg>`; table becomes visually hidden.
- a chart injected through a simulated `htmx:load` swap renders.
- axe scan passes (the accessible table provides the data; `aria-label`
  on the figure; SVG `role="img"`).

## 10. Decisions (locked)

1. **Recipe vs component → RECIPE.** Ship as `recipes/chart/`; the table
   contract + server response are the core idea, with `hc-chart.css` +
   tokens as its styling.
2. **Plot delivery → docs use CDN, examples use import.** Docs snippets use
   the UMD `globalThis.Plot` via CDN `<script>` (zero build); a chart
   example under `examples/` (if added) imports Plot as a dep.
3. **MVP cut → Tier 1 only (bar/line/area/combo)** as the first PR; Tier
   2/3 as follow-up PRs (one concern per PR).
4. **SSR section → document briefly, implement client-side first.** The
   linkedom server-render path is noted in `contract.md` as an alternative;
   not implemented in PR 1.

## 11. Phasing (proposed PRs)

- **PR 1 — Tier 1 core:** tokens + `hc-chart.css` + `chart.js` (bar/line/
  area/combo) + `recipes/chart/` + docs page + tests + CHANGELOG.
- **PR 2 — Tier 2:** stacked/grouped bar, scatter, sparkline (+ tests/docs).
- **PR 3 — Tier 3 / SSR:** histogram, heatmap, documented linkedom SSR path.

Each PR is self-contained and independently mergeable (avoids stacked-PR
risk on fast merges).

## 12. Definition of Done (recipe — plan §17.4)

- [ ] `recipe.html` (short) + `expanded.html` (full htmx-wired) + `contract.md`.
- [ ] Basic HTML works without JS (accessible table fallback).
- [ ] htmx version (swap returns the table fragment; `htmx:load` re-render).
- [ ] Optional `data-hc-*` shorthand documented (`data-hc-chart`, `data-mark`).
- [ ] Optional macro? (out of scope for v1 — note as future.)
- [ ] Server response contract documented (table fragment shape per type).
- [ ] Progressive enhancement documented (table ↔ chart).
- [ ] Accessibility notes (visually-hidden data table, `role="img"`, label).
- [ ] Tests for the behavior (Vitest + Playwright + axe).
- [ ] Uses token references (`--hc-chart-*`); docs site builds.

## 13. 2026-08 extension (user-approved follow-up scope)

Additions beyond the original three tiers, driven by business-app usage.
All strictly additive (patch per VERSIONING.md); one concern per PR:

- **PR A — interaction & axis options:** `data-tip` (one standalone
  Plot `tip` mark per figure via a pointer transform — never two
  tooltips at once; `histogram`/`heatmap` tip their own mark),
  `data-y-min` / `data-y-max` (pin the y domain; the zero-baseline rule
  drops out when 0 leaves the domain), `data-y-format` (d3-format tick
  string), and the `buildOptions(spec, figure)` install-time escape
  hatch so the attribute surface stays small.
- **PR B — horizontal bars:** `bar-x` (stacked; ranking shape — long
  category labels on y, values on x) and `bar-x-grouped` (fy facet).
  `data-y-label` labels the **value** axis (x) there.
- **PR C — waterfall:** running-total bridge bars from one signed-delta
  column; `<tr data-total>` rows are absolute anchors (value kept in
  the cell so the no-JS table stays truthful); increase / decrease /
  total colours from dedicated tokens.

- **PR D — click-through (`data-link`):** clicks forward to
  server-authored markup via pointer-focus delegation — a first-column
  anchor (row granularity, real no-JS path) or a figure-wide form
  (category × series granularity, fields filled from the focused datum,
  htmx on the form owns the request). The chart stays URL- and
  network-free.

Pie/donut stays out of scope (Plot has no arc mark — documented; the
`bar-x` + `data-stack-offset`-style normalized composition or a waffle
are the recommended substitutes).
