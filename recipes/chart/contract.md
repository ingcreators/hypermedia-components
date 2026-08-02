# chart — server response contract

Purpose: render a chart from a server-sent **semantic data table**. The
table is the data source, the no-JavaScript fallback, and the
screen-reader data. `installChart()` (from `@hypermedia-components/core`)
reads it and draws an [Observable Plot](https://observablehq.com/plot/)
SVG. Plot is an optional peer dependency — load it yourself (CDN UMD
global or a bundled import); without it the table simply stays visible.

This recipe **needs a behavior**: `installChart(document, { plot })`. It is
**not** part of the auto-init `@hypermedia-components/core/behaviors`
entry, because Plot is not bundled.

## Required client markup

- `<figure class="hc-chart" data-hc-chart="<type>">` wrapping a
  `<table class="hc-table">`.
- A `<thead>` whose first cell is the **x category** and whose remaining
  cells name the **series**.
- A `<tbody>` of rows: first cell = x value, the rest = series values.
- Optional `<caption>` — used as the chart title.

```html
<figure class="hc-chart" data-hc-chart="line" data-y-label="Sales ($k)">
  <table class="hc-table">
    <caption>Monthly sales</caption>
    <thead><tr><th>Month</th><th>Tokyo</th><th>Osaka</th></tr></thead>
    <tbody>
      <tr><td>Jan</td><td>120</td><td>80</td></tr>
      <tr><td>Feb</td><td>200</td><td>140</td></tr>
    </tbody>
  </table>
</figure>
```

## Chart types (`data-hc-chart`)

| Value   | Renders                                                        |
| ------- | ------------------------------------------------------------- |
| `bar`   | Vertical bars. Multiple series **stack**.                     |
| `line`  | Lines with node dots, one per series.                         |
| `area`  | Filled areas with a line edge, one per series.                |
| `combo` | Per-column marks — set each `<th data-mark="bar\|line\|area">`. |
| `bar-stacked` | Explicitly stacked bars (same rendering as multi-series `bar`, stated intent). |
| `bar-grouped` | Bars grouped side-by-side per category (faceted; the category axis carries the labels). |
| `bar-x` | **Horizontal** bars — the ranking shape. Categories go on y (long labels stay readable), values on x; multiple series stack. `data-y-label`, `data-y-min` / `data-y-max` and `data-y-format` configure the **value** axis (x there); a bare `data-tip` snaps along the category axis. |
| `bar-x-grouped` | Horizontal bars grouped side-by-side per category (faceted on the row axis). Same value-axis mapping as `bar-x`. |
| `scatter` | Dots on two numeric axes — `data-x-type` defaults to `number`; each series column is one dot set; an optional `<th data-role="r">` column drives the dot radius. |
| `sparkline` | A compact Plot-styled trend: no axes, no grid, no legend, 48 px tall unless `data-height` says otherwise. For a dependency-free inline trend, prefer the standalone `hc-sparkline` component. |
| `histogram` | Bins **one numeric column** (extra columns are ignored) into count bars; `data-bins` caps the bin count. |
| `heatmap` | The matrix shape: row categories on y, column headers on x, cell values drive a **continuous** fill (`data-scheme` picks the Plot color scheme; the categorical series palette does not apply). |
| `waterfall` | The financial bridge: **one signed-delta column** (extra columns are ignored); bars float from the running total before each delta to the total after it. `<tr data-total>` rows are absolute anchors (see below). Colours come from `--hc-chart-waterfall-increase` / `-decrease` / `-total`; the legend is on unless `data-legend="false"`. |

`data-hc-chart` is the **default mark** for any column without its own
`data-mark`. For `combo` the default is `bar`. So `bar`/`line`/`area` are
just the special case where every column shares one mark. The Tier 2
types (`bar-stacked`, `bar-grouped`, `bar-x`, `bar-x-grouped`, `scatter`,
`sparkline`) are **whole-figure presets** — per-column `data-mark`
combos don't apply to them.

## Waterfall rows (`data-total`)

The waterfall table is step label + **signed delta** (`+80`, `-30`; the
usual coercion applies). A row marked `<tr data-total>` is an **absolute
anchor**: its cell holds the real total — so the no-JavaScript table
stays truthful — the bar runs from 0 to that value, and the running
total resets to it. Use anchors for opening / closing balances and
audited subtotals.

```html
<figure class="hc-chart" data-hc-chart="waterfall" data-y-label="Cash ($k)">
  <table class="hc-table">
    <caption>Cash bridge</caption>
    <thead><tr><th>Step</th><th>Amount</th></tr></thead>
    <tbody>
      <tr data-total><td>Opening</td><td>100</td></tr>
      <tr><td>Sales</td><td>+80</td></tr>
      <tr><td>Costs</td><td>-30</td></tr>
      <tr data-total><td>Closing</td><td>150</td></tr>
    </tbody>
  </table>
</figure>
```

With `data-tip` the tooltip shows the step, the running total (y) and
the delta. Connector lines between steps are a possible future addition.

## Per-column mark (combo)

```html
<thead>
  <tr>
    <th>Month</th>
    <th data-mark="bar">Sales</th>
    <th data-mark="line">Target</th>
  </tr>
</thead>
```

## Options (figure attributes)

| Attribute              | Default      | Effect                                            |
| ---------------------- | ------------ | ------------------------------------------------- |
| `data-y-label`         | _(none)_     | y-axis label.                                     |
| `data-title`           | `<caption>`  | Chart title (falls back to the table caption).    |
| `data-x-type`          | `category`   | `category` \| `number` \| `date` — x value coercion. |
| `data-width`           | container    | Plot width in px.                                 |
| `data-height`          | `--hc-chart-height` (320px) | Plot height in px.                 |
| `data-legend`          | auto         | `false` hides the colour legend.                  |
| `data-tip`             | off          | Hover tooltip. Bare/`true` picks per type (`x` snap; scatter `xy`); or `x` \| `y` \| `xy` explicitly; `false` off. |
| `data-y-min` / `data-y-max` | data extent | Pin the y domain (e.g. `data-y-max="100"` for percentages). A missing bound falls back to the data extent (min floored at 0). With **stacked** bars set both — the raw-value extent ignores stacking. The zero baseline rule is dropped when 0 leaves the domain. |
| `data-y-format`        | Plot default | y-axis tick format, a [d3-format](https://d3js.org/d3-format) string (`"s"` → `1.2k`, `".0%"`, `",.0f"`). |

Cell values are coerced to numbers; thousands separators, currency
symbols, and `%` signs are stripped (`"1,200"` → `1200`). Bars expect a
`category` x; `number` / `date` x suit `line` / `area`.

## Tooltips (`data-tip`)

`data-tip` renders **one** hover tooltip per figure (a single Plot `tip`
mark driven by a pointer transform, so combo charts never show two
tooltips at once). It shows the x value, the y value, and — with multiple
series — the series name; `scatter` includes the `r` column when present.
`histogram` and `heatmap` tip their own mark instead (bin extent + count;
row × column + value). Tooltips are client-side interactivity: they do
**not** apply to the server-rendered (linkedom SSR) path.

```html
<figure class="hc-chart" data-hc-chart="line" data-tip data-y-label="Sales ($k)">
```

## Escape hatch (`buildOptions`)

High-frequency needs stay declarative (the attributes above). Everything
else goes through the install-time hook, called with the final Plot spec
and the figure just before rendering:

```js
installChart(document, {
  plot: Plot,
  buildOptions: (spec, figure) => ({ ...spec, marginLeft: 60 }),
});
```

Return the (new or mutated) spec; returning nothing keeps the built one.

## Server response

Return the `<figure class="hc-chart">…</figure>` fragment (or just the
inner table for an existing figure target). The **same** endpoint must
return a usable table for a non-htmx request (full page load) so the
no-JavaScript path works — detect htmx via the `HX-Request: true` header
if you wrap fragments in a layout.

```html
<!-- GET /reports/sales -->
<figure class="hc-chart" data-hc-chart="bar" data-y-label="Sales ($k)">
  <table class="hc-table">
    <caption>Monthly sales</caption>
    <thead><tr><th>Month</th><th>Sales</th></tr></thead>
    <tbody>
      <tr><td>Jan</td><td>120</td></tr>
      <tr><td>Feb</td><td>200</td></tr>
    </tbody>
  </table>
</figure>
```

`installChart` listens for `htmx:load`, so a chart swapped into the page
renders automatically — no per-swap JavaScript.

Status: `200 OK` with the fragment for htmx requests *and* for the
full-page (no-JavaScript) request. A non-2xx response is not swapped
(htmx ≥ 2 default), so the previous chart stays.

## Optional: embedded JSON source

For many series or config-heavy charts you may prefer embedding the data
as JSON instead of (or alongside) the table. This recipe's behavior reads
the **table**; if you adopt a JSON source, **escape `<` as `<`** when
serializing server-side to avoid breaking out of the `<script>` element
(an XSS vector with user data). Keep a visually-hidden table for the
no-JavaScript / screen-reader path.

## Progressive enhancement

- **No JavaScript** → the `<table class="hc-table">` renders as a normal,
  readable data table.
- **JavaScript, no Plot** → same: `installChart` is a no-op without Plot.
- **JavaScript + Plot** → the table is moved into the accessibility tree
  (`.hc-sr-only`) and the SVG chart is shown.

## Accessibility

- The source table is **kept** (hidden with `.hc-sr-only`, not removed),
  so assistive tech reads the full tabular data.
- The rendered `<svg>` is `aria-hidden="true"` — it is a decorative
  duplicate of the table, so it is not announced twice.
- Give the table a `<caption>` describing the chart.

## Server-side rendering (alternative)

Charts can also be rendered to SVG on the server with Plot under a DOM
shim (linkedom) and returned inline, with **no client Plot**. Set
explicit `marginLeft` / `marginBottom` then, since server DOM shims do not
measure text for automatic axis margins. This recipe implements the
client-side path; the SSR path is documented for completeness.

## Server-side rendering (linkedom)

Plot renders wherever a DOM exists — pass it a `document`. On the
server, [linkedom](https://github.com/WebReflection/linkedom) provides
one, so the SVG can ship inside the response and the page needs **no
client-side Plot at all**:

```js
import { parseHTML } from 'linkedom';
import * as Plot from '@observablehq/plot';

const { document } = parseHTML('<!doctype html><html><body></body></html>');
const svg = Plot.plot({
  document,
  marks: [Plot.barY(rows, { x: 'month', y: 'sales' })],
  // Tokens are client-side CSS — pass explicit colors when SSR'ing:
  color: { range: ['#4f6df5', '#22a06b'] },
});
```

Emit the figure with `data-state="rendered"`, the table (kept,
`hc-sr-only`), and the SVG (`class="hc-chart__plot"`,
`aria-hidden="true"`). `installChart()` recognizes a figure that is
already rendered (`data-state="rendered"` or an existing child `<svg>`)
and leaves it alone, so SSR'd and client-rendered charts coexist on one
page.
