// installChart — behavior for the `chart` recipe.
//
// Upgrades a server-rendered semantic data table into an Observable Plot
// SVG chart. It never touches the network: the table arrives via a normal
// page load or an htmx swap and IS the data source + the no-JS / no-Plot
// accessible fallback.
//
//   <figure class="hc-chart" data-hc-chart="bar|line|area|combo
//                                 |bar-stacked|bar-grouped|scatter|sparkline
//                                 |histogram|heatmap">
//     <table class="hc-table">
//       <thead><tr><th>Month</th><th data-mark="bar">Sales</th><th data-mark="line">Target</th></tr></thead>
//       <tbody><tr><td>Jan</td><td>120</td><td>150</td></tr>…</tbody>
//     </table>
//   </figure>
//
// Table contract (cartesian categorical charts):
//   - Column 1 is the x category; columns 2..N are series.
//   - `<thead>` cell text is the series name.
//   - `<th data-mark="bar|line|area">` sets that series' mark, enabling
//     combo charts. `data-hc-chart` is the default mark for unmarked
//     columns ('bar' for "combo"/unknown, otherwise the named type).
//   - Cell text is coerced to a number (thousands separators / currency /
//     percent signs are stripped).
//
// Observable Plot is an OPTIONAL peer dependency, never bundled into core.
// Pass it explicitly — installChart(document, { plot: Plot }) — or expose
// it as the `Plot` global (the UMD build via a CDN <script>). With no Plot
// available the behavior is a no-op: the table stays visible.
//
// installChart(root = document, options = {}) returns an uninstaller.
// Repeated calls on the same root return the same uninstaller (idempotent).

const INSTALL_KEY = '__hcChartUninstall';

// Resolve the Plot namespace: an explicit option wins, else the UMD global.
function resolvePlot(options) {
  if (options && options.plot) return options.plot;
  if (typeof globalThis !== 'undefined' && globalThis.Plot) return globalThis.Plot;
  return null;
}

// The mark a column without an explicit `data-mark` should use.
function defaultMarkOf(figure) {
  const type = (figure.getAttribute('data-hc-chart') || 'bar').toLowerCase();
  if (type === 'line' || type === 'area') return type;
  if (type === 'sparkline' || type === 'scatter') return 'line';
  return 'bar'; // incl. histogram / heatmap (unused by their presets)
}

function markFor(th, fallback) {
  const m = (th.getAttribute('data-mark') || '').toLowerCase();
  return m === 'bar' || m === 'line' || m === 'area' ? m : fallback;
}

// Coerce a table cell to a number, tolerating "1,200", "¥1200", "12%".
function toNumber(text) {
  const cleaned = String(text).replace(/[^0-9.+-]/g, '');
  if (cleaned === '' || cleaned === '+' || cleaned === '-' || cleaned === '.') return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Coerce an x value per the figure's `data-x-type` (category | number | date).
function toX(text, xType) {
  const raw = String(text).trim();
  if (xType === 'number') return toNumber(raw);
  if (xType === 'date') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d;
  }
  return raw;
}

// Read the table into tidy rows: { x, series, mark, value }.
function readTable(figure, table) {
  const head = table.tHead && table.tHead.rows[0];
  const body = table.tBodies && table.tBodies[0];
  if (!head || !body) return null;

  const type = (figure.getAttribute('data-hc-chart') || 'bar').toLowerCase();
  const xType = (figure.getAttribute('data-x-type')
    || (type === 'scatter' || type === 'histogram' ? 'number' : 'category')).toLowerCase();
  const fallbackMark = defaultMarkOf(figure);

  const headCells = [...head.cells];
  const xName = (headCells[0] ? headCells[0].textContent : '').trim();
  // An optional `<th data-role="r">` column feeds the dot radius
  // (scatter); it is not a series.
  const columns = headCells.map((th, index) => ({
    index,
    role: (th.getAttribute('data-role') || '').toLowerCase(),
    name: th.textContent.trim(),
    mark: markFor(th, fallbackMark),
  }));
  const rColumn = columns.slice(1).find((c) => c.role === 'r') || null;
  const series = columns.slice(1).filter((c) => c !== rColumn);

  // Histogram reads ONE numeric column: every body row's first cell is a
  // sample; any extra columns are ignored (documented).
  if (type === 'histogram') {
    const rows = [];
    for (const tr of body.rows) {
      const cell = tr.cells[0];
      if (!cell) continue;
      const n = toNumber(cell.textContent);
      if (n == null) continue;
      rows.push({ x: n, series: xName || 'value', mark: 'bar', value: n });
    }
    if (!rows.length) return null;
    return { xName, xType: 'number', series: [], rows, hasR: false };
  }

  if (!series.length) return null;

  const rows = [];
  for (const tr of body.rows) {
    const cells = [...tr.cells];
    if (!cells.length) continue;
    const x = toX(cells[0].textContent, xType);
    const r = rColumn && cells[rColumn.index]
      ? toNumber(cells[rColumn.index].textContent)
      : undefined;
    for (const s of series) {
      const cell = cells[s.index];
      if (!cell) continue;
      const row = { x, series: s.name, mark: s.mark, value: toNumber(cell.textContent) };
      if (r != null) row.r = r;
      rows.push(row);
    }
  }
  if (!rows.length) return null;

  return { xName, xType, series, rows, hasR: !!rColumn };
}

// Build the Plot marks for the tidy rows, layering area → bar → line so a
// combo (bar + line, area + line, …) renders in a sensible z-order.
function buildMarks(plot, rows) {
  const pick = (mark) => rows.filter((d) => d.mark === mark && d.value != null);
  const marks = [plot.ruleY([0])];

  const area = pick('area');
  if (area.length) {
    marks.push(plot.areaY(area, {
      x: 'x', y: 'value', z: 'series', fill: 'series', fillOpacity: 0.2, curve: 'monotone-x',
    }));
    marks.push(plot.lineY(area, {
      x: 'x', y: 'value', z: 'series', stroke: 'series', curve: 'monotone-x',
    }));
  }

  const bar = pick('bar');
  if (bar.length) {
    marks.push(plot.barY(bar, { x: 'x', y: 'value', fill: 'series' }));
  }

  const line = pick('line');
  if (line.length) {
    marks.push(plot.lineY(line, {
      x: 'x', y: 'value', z: 'series', stroke: 'series', curve: 'monotone-x',
    }));
    marks.push(plot.dot(line, { x: 'x', y: 'value', z: 'series', fill: 'series', r: 2.5 }));
  }

  return marks;
}

function validRows(rows) {
  return rows.filter((d) => d.value != null);
}

function figure_y_label(figure) {
  return figure.getAttribute('data-y-label') || null;
}

// Figure-level Tier 2 presets. Each owns the whole figure: it returns the
// marks plus per-key overrides of the base plot options. Per-column
// `data-mark` combos remain a Tier 1 concept (bar/line/area only).
const TYPE_PRESETS = {
  // Plot's barY stacks same-x series implicitly — this type states the
  // intent explicitly (and stays correct with a single series).
  'bar-stacked': (plot, data) => ({
    marks: [
      plot.ruleY([0]),
      plot.barY(validRows(data.rows), { x: 'x', y: 'value', fill: 'series' }),
    ],
  }),

  // Facet by the category; series become the inner x. The facet axis
  // carries the category labels, so the inner axis is hidden.
  'bar-grouped': (plot, data, base) => ({
    marks: [
      plot.ruleY([0]),
      plot.barY(validRows(data.rows), { fx: 'x', x: 'series', y: 'value', fill: 'series' }),
    ],
    options: {
      x: { axis: null },
      fx: { label: base.x.label, domain: base.x.domain },
    },
  }),

  // Two numeric axes; each series column is one dot set. An optional
  // `<th data-role="r">` column drives the radius channel.
  scatter: (plot, data) => ({
    marks: [
      plot.dot(validRows(data.rows), {
        x: 'x',
        y: 'value',
        stroke: 'series',
        fill: 'series',
        fillOpacity: 0.4,
        ...(data.hasR ? { r: 'r' } : { r: 4 }),
      }),
    ],
  }),

  // Bin one numeric column into count bars. `data-bins` caps the bin
  // count (Plot's thresholds option).
  histogram: (plot, data, base, ctx) => {
    const bins = Number.parseInt(ctx.figure.getAttribute('data-bins') || '', 10);
    return {
      marks: [
        plot.ruleY([0]),
        plot.rectY(data.rows, plot.binX(
          { y: 'count' },
          { x: 'x', ...(Number.isFinite(bins) ? { thresholds: bins } : {}) },
        )),
      ],
      options: {
        color: { legend: false },
        y: { ...base.y, label: figure_y_label(ctx.figure) || 'count' },
      },
    };
  },

  // Matrix heat: row categories on y, column headers on x, the cell value
  // drives a CONTINUOUS fill (the categorical series palette does not
  // apply). `data-scheme` picks a Plot color scheme.
  heatmap: (plot, data, base, ctx) => ({
    marks: [
      plot.cell(validRows(data.rows), { x: 'series', y: 'x', fill: 'value' }),
    ],
    options: {
      x: { label: null, domain: data.series.map((s) => s.name) },
      y: { label: data.xName || null, domain: base.x.domain, grid: false },
      color: {
        legend: true,
        label: figure_y_label(ctx.figure) || undefined,
        ...(ctx.figure.getAttribute('data-scheme')
          ? { scheme: ctx.figure.getAttribute('data-scheme') }
          : {}),
      },
    },
  }),

  // A Plot-styled inline trend: no axes, no grid, no legend, compact
  // height. (For a dependency-free inline trend, hc-sparkline is usually
  // the better fit — this preset exists for Plot-consistent dashboards.)
  sparkline: (plot, data, base, ctx) => ({
    marks: [
      plot.lineY(validRows(data.rows), {
        x: 'x', y: 'value', z: 'series', stroke: 'series', curve: 'monotone-x',
      }),
    ],
    options: {
      height: ctx.explicitHeight != null ? ctx.explicitHeight : 48,
      x: { ...base.x, axis: null, label: null },
      y: { axis: null, grid: false },
      color: { ...base.color, legend: false },
    },
  }),
};

// Parse a CSS length ("320", "320px", "20rem") to pixels.
function parseDim(value, base = 16) {
  const m = String(value || '').trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 'rem' || m[2] === 'em' ? n * base : n;
}

// Resolve the --hc-chart-series-1..6 palette into a colour range for Plot.
function resolveSeriesRange(figure) {
  if (typeof getComputedStyle !== 'function') return null;
  const cs = getComputedStyle(figure);
  const range = [];
  for (let i = 1; i <= 6; i += 1) {
    const v = cs.getPropertyValue(`--hc-chart-series-${i}`).trim();
    if (v) range.push(v);
  }
  return range.length ? range : null;
}

function xScaleType(xType) {
  if (xType === 'date') return 'utc';
  if (xType === 'number') return 'linear';
  return undefined; // category → Plot infers band / point
}

// Render one figure. No-op if already rendered, if Plot is unavailable, or
// if the table is missing / empty (the table simply stays visible).
function renderFigure(figure, rendered, options) {
  if (rendered.has(figure)) return;
  // Server-rendered figures (the documented linkedom SSR path) arrive
  // with their SVG already in place — leave them alone.
  if (figure.getAttribute('data-state') === 'rendered' || figure.querySelector(':scope > svg')) {
    rendered.add(figure);
    return;
  }
  const plot = resolvePlot(options);
  if (!plot) return;

  const table = figure.querySelector('table');
  if (!table) return;

  const data = readTable(figure, table);
  if (!data) return;

  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(figure) : null;
  const width = parseDim(figure.getAttribute('data-width'))
    || figure.clientWidth
    || 640;
  const height = parseDim(figure.getAttribute('data-height'))
    || (cs && parseDim(cs.getPropertyValue('--hc-chart-height')))
    || 320;

  const seriesCount = new Set(data.rows.map((d) => d.series)).size;
  const legend = figure.getAttribute('data-legend') !== 'false' && seriesCount > 1;
  const range = resolveSeriesRange(figure);
  const title = figure.getAttribute('data-title')
    || (table.caption ? table.caption.textContent.trim() : undefined);

  // Preserve the table's row order on a categorical x axis. Plot sorts an
  // ordinal domain alphabetically by default, which would reorder e.g.
  // Jan/Feb/Mar → Feb/Jan/Mar; pin the domain to first-appearance order.
  const xDomain = data.xType === 'category'
    ? [...new Set(data.rows.map((d) => d.x))]
    : undefined;

  const base = {
    width,
    height,
    className: 'hc-chart__plot',
    style: { background: 'transparent', color: 'inherit', fontFamily: 'inherit' },
    title: title || undefined,
    x: { label: data.xName || undefined, type: xScaleType(data.xType), domain: xDomain },
    y: { label: figure.getAttribute('data-y-label') || undefined, grid: true },
    color: range ? { range, legend } : { legend },
  };

  const type = (figure.getAttribute('data-hc-chart') || 'bar').toLowerCase();
  const preset = TYPE_PRESETS[type];
  let marks;
  let overrides = null;
  if (preset) {
    // Only the data-height ATTRIBUTE counts as explicit here: the
    // --hc-chart-height custom property has a global token default
    // (20rem), which must not defeat a preset's own compact default.
    const explicitHeight = parseDim(figure.getAttribute('data-height'));
    ({ marks, options: overrides = null } = preset(plot, data, base, { figure, explicitHeight }));
  } else {
    marks = buildMarks(plot, data.rows);
  }

  const node = plot.plot({ ...base, ...(overrides || {}), marks });

  node.classList.add('hc-chart__plot');
  // The accessible data lives in the table (kept for assistive tech); hide
  // the decorative SVG from the accessibility tree to avoid duplication.
  node.setAttribute('aria-hidden', 'true');

  table.classList.add('hc-sr-only');
  figure.appendChild(node);
  figure.setAttribute('data-state', 'rendered');
  rendered.add(figure);
}

/**
 * Install the chart behavior on the given root.
 *
 * Scans for `[data-hc-chart]` figures and renders each one with Observable
 * Plot, reading the contained semantic `<table>` as the data source. Also
 * listens for `htmx:load` so charts that arrive via an htmx swap render
 * automatically. The source table is preserved (moved into the
 * accessibility tree via `.hc-sr-only`) as the screen-reader data and the
 * no-JavaScript fallback.
 *
 * Observable Plot is an optional peer dependency. Provide it via
 * `options.plot` or the `Plot` global; without it the behavior is a no-op
 * and tables stay visible.
 *
 * Repeated calls on the same root return the same uninstaller. Individual
 * figures are rendered at most once (tracked by a WeakSet).
 *
 * @param {Document|Element} [root=document]
 *   The scope to scan. Defaults to the global document when available.
 * @param {{ plot?: object }} [options]
 *   `plot` — the Observable Plot namespace to render with.
 * @returns {() => void}
 *   An uninstaller that removes the `htmx:load` listener. It leaves already
 *   rendered SVGs in place. A no-op when the behavior is not installed.
 */
export function installChart(
  root = (typeof document !== 'undefined' ? document : null),
  options = {},
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const rendered = new WeakSet();
  const scan = (scope) => {
    const nodes = scope && scope.querySelectorAll
      ? scope.querySelectorAll('[data-hc-chart]')
      : [];
    nodes.forEach((figure) => renderFigure(figure, rendered, options));
  };

  scan(root);

  // Render charts swapped in by htmx. `htmx:load` fires on the new subtree.
  const target = root.body || root;
  const onLoad = (event) => {
    const scope = event && event.target;
    if (scope && scope.querySelectorAll) scan(scope);
  };
  target.addEventListener('htmx:load', onLoad);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    target.removeEventListener('htmx:load', onLoad);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
