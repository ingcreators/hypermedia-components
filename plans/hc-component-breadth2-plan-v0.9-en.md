# HC Component-Breadth Plan v0.9 — business-app gaps (meter, rating, timeline, separator label)

Status: **shipped in full** — plan #327, `hc-meter` #328, `hc-rating`
#329, separator label variant #330, `hc-timeline` #331 (2026-07-04).
One concern per PR, merged sequentially.

Where [v0.7](./hc-component-breadth-plan-v0.7-en.md) closed the shadcn/ui
gap (parity reached; every "genuinely missing" candidate shipped), this
plan closes the highest-value gaps against the **business-app** component
libraries — Ant Design, PrimeVue, MUI, SAP Fiori / UI5, Polaris — that HC's
admin-screen consumers actually meet.

## Gap analysis (business-app libraries → HC), July 2026

Cross-referencing Ant Design / PrimeVue / MUI / Fiori against HC's current
59 component stylesheets:

### In scope (this plan)

| Candidate | Peer equivalents | Why it fits HC |
| --- | --- | --- |
| `hc-meter` | Ant Progress(gauge-ish) · Fiori RadialMicroChart · Polaris | Native `<meter>` skin — quota / score / disk-usage displays. The natural sibling of `hc-progress` (`<progress>`); pure CSS. |
| `hc-rating` | Ant Rate · MUI Rating · PrimeVue Rating | A radio group styled as stars — a real form control that serializes natively. Pure CSS (`:has()`, Baseline 2023). |
| `hc-separator` label variant | Ant Divider with text | "or" dividers between auth options, section splits. Additive variant on the existing component. |
| `hc-timeline` | Ant Timeline · PrimeVue Timeline · Flowbite | Audit logs / activity history — a business-app staple. Pure CSS list; composes with `hc-item` content conventions. |

### Deferred to a future recipes plan (server-driven shapes)

`Transfer` (dual listbox — htmx round-trips fit better than client state) ·
`Cascader` (compose `hc-tree` + combobox) · dual-thumb range slider
(needs a behavior; native `<input type=range>` is single-thumb).

### Already covered / rejected

Statistic → blocks stat cards · Descriptions → `hc-table[data-variant=kv]` ·
Result → `hc-empty` · Segmented → `hc-toggle-group` · Anchor → `hc-toc` +
scrollspy · Popconfirm → `confirm-action` · Tour, virtualization, masked
input, QRCode, watermark → out by principle.

## Principles alignment

| HC principle | How these four honour it |
| --- | --- |
| Native first | `<meter>` and radio groups are the platform's own controls; the timeline is an `<ol>`. |
| Pure CSS, no behavior | All four ship zero JavaScript. |
| Semantic classes + `data-*` | `hc-meter`, `hc-rating__star`, `data-variant`, `data-size`. |
| State in HTML attributes | `<meter>` value/low/high/optimum; `:checked` radios; `data-variant` markers. |
| DTCG tokens → `--hc-*` | New `meter.*` / `rating.*` / `timeline.*` (+ `separator.label-*`) tokens referencing `{semantic.*}`. |
| Logical properties / RTL | All layout in logical properties; rating fill direction follows `dir`. |

## Tracks

### M1 — `hc-meter`

A skin for the native `<meter>` element (scalar measurement within a
known range), completing the `<progress>` / `<meter>` pair.

```html
<label for="quota">Storage used</label>
<meter class="hc-meter" id="quota" min="0" max="100"
       low="70" high="90" optimum="10" value="82">82%</meter>
```

- Styling via `appearance: none` + the engine pseudo-elements
  (`::-webkit-meter-*-value`, `::-moz-meter-bar`), mirroring the
  technique `hc-progress` already uses for `<progress>`.
- The three native regions map to tokens: optimum → `semantic.color.success`,
  suboptimum → `warning`, even-less-good → `error`; track/radius/height
  tokens shared shape with `hc-progress`.
- `data-size="sm|lg"` height presets.
- A11y: the element carries its own role/value semantics; document
  labelling (`<label>` / `aria-label`) and the fallback text child.
- Out of scope: radial gauges, animated fills.

### R1 — `hc-rating`

A star rating as a **radio group** — serializes natively, keyboard
navigation for free.

```html
<fieldset class="hc-rating">
  <legend class="hc-sr-only">Rate this article</legend>
  <input class="hc-rating__input" type="radio" name="rate" value="1" id="r1">
  <label class="hc-rating__star" for="r1" aria-label="1 of 5">★</label>
  <!-- … ×5 -->
</fieldset>
```

- Fill-up-to-checked and hover preview in pure CSS via `:has()` /
  sibling selectors (Baseline 2023, already required by shell/aspect).
- Read-only display form: `<span class="hc-rating" data-readonly>` with
  filled/empty star spans and a single `aria-label` ("4 of 5 stars").
- `data-size`, `data-variant` accent; glyph inherits `currentColor` so
  theming is one declaration.
- A11y: visually-hidden radios stay focusable; per-star labels; the
  group is named by `<legend>` (or `role="radiogroup"` + `aria-label`).
- Out of scope: half stars, custom glyph slots (the label content is the
  glyph — authors can swap the character/SVG freely).

### S1 — `hc-separator` label variant

```html
<div class="hc-separator" role="separator" aria-orientation="horizontal">
  <span class="hc-separator__label">or</span>
</div>
```

- When the separator contains `.hc-separator__label`, it becomes a flex
  row: hairline `::before`/`::after` grow around the muted label.
- The existing `<hr class="hc-separator">` form is untouched (additive);
  the label form documents `role="separator"` since `<div>` carries no
  implicit semantics. Horizontal only (a labelled vertical divider has
  no established pattern).

### T1 — `hc-timeline`

A vertical activity/audit timeline: marker rail + connector + content.

```html
<ol class="hc-timeline">
  <li class="hc-timeline__item" data-variant="success">
    <span class="hc-timeline__marker" aria-hidden="true"></span>
    <div class="hc-timeline__content">
      <time class="hc-timeline__time" datetime="2026-07-03T09:14">09:14</time>
      <span class="hc-timeline__title">Deploy finished</span>
      <p class="hc-timeline__description">v2.4 to production.</p>
    </div>
  </li>
  …
</ol>
```

- Two-column grid per item (marker rail / content), all logical
  properties (RTL flips for free). Connector line via `::before`; the
  last item's connector stops.
- `data-variant="success|warning|error|info"` colours the marker via the
  status tokens; a glyph/emoji may be placed inside the marker.
- Semantics: it *is* a list — no ARIA needed beyond what authors add.
- Out of scope: alternating left/right layout, horizontal orientation,
  collapse/lazy-load (compose with `hc-collapsible` / htmx as needed).

## Definition of Done (every track)

Component DoD (v0.4 plan §17.3) plus the repo-current specifics:

1. Tokens in `component.tokens.json` referencing `{semantic.*}`;
   `pnpm build` regenerates `--hc-*` custom properties.
2. CSS file registered in `scripts/bundle-css.mjs` (wildcard `./css/*`
   export covers the per-component entry automatically).
3. Docs page **in English and Japanese** (the i18n plan mandates ja
   counterparts for all new pages), sidebar entry in `astro.config.mjs`,
   and a kitchen-sink section (en + ja).
4. Playwright spec + fixture (`test-browser/`) incl. an axe scan.
5. CHANGELOG under **Unreleased**; all additive → next release is a
   patch per VERSIONING.md.
6. VRT sheets deliberately **not** extended (curated baseline set);
   candidates for a future sheet refresh.

## PR sequence

| PR | Content |
| --- | --- |
| 1 | This plan document. |
| 2 | M1 `hc-meter`. |
| 3 | R1 `hc-rating`. |
| 4 | S1 separator label variant. |
| 5 | T1 `hc-timeline`. |

Each PR branches from `origin/main` after the previous one merges
(sequential; avoids stacked-PR hazards). Sidebar placement: meter →
Feedback (after progress); rating → Forms (after slider); timeline →
Data display (after sparkline).
