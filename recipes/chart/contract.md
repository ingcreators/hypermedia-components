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
<figure class="hc-chart" data-hc-chart="line" data-y-label="売上 (万円)">
  <table class="hc-table">
    <caption>月次売上</caption>
    <thead><tr><th>月</th><th>東京</th><th>大阪</th></tr></thead>
    <tbody>
      <tr><td>1月</td><td>120</td><td>80</td></tr>
      <tr><td>2月</td><td>200</td><td>140</td></tr>
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

`data-hc-chart` is the **default mark** for any column without its own
`data-mark`. For `combo` the default is `bar`. So `bar`/`line`/`area` are
just the special case where every column shares one mark.

## Per-column mark (combo)

```html
<thead>
  <tr>
    <th>月</th>
    <th data-mark="bar">売上</th>
    <th data-mark="line">目標</th>
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

Cell values are coerced to numbers; thousands separators, currency
symbols, and `%` signs are stripped (`"1,200"` → `1200`). Bars expect a
`category` x; `number` / `date` x suit `line` / `area`.

## Server response

Return the `<figure class="hc-chart">…</figure>` fragment (or just the
inner table for an existing figure target). The **same** endpoint must
return a usable table for a non-htmx request (full page load) so the
no-JavaScript path works — detect htmx via the `HX-Request: true` header
if you wrap fragments in a layout.

```html
<!-- GET /reports/sales -->
<figure class="hc-chart" data-hc-chart="bar" data-y-label="売上 (万円)">
  <table class="hc-table">
    <caption>月次売上</caption>
    <thead><tr><th>月</th><th>売上</th></tr></thead>
    <tbody>
      <tr><td>1月</td><td>120</td></tr>
      <tr><td>2月</td><td>200</td></tr>
    </tbody>
  </table>
</figure>
```

`installChart` listens for `htmx:load`, so a chart swapped into the page
renders automatically — no per-swap JavaScript.

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
