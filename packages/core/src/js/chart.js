// installChart — behavior for the `chart` recipe.
//
// Upgrades a server-rendered semantic data table into an Observable Plot
// SVG chart. It never touches the network: the table arrives via a normal
// page load or an htmx swap and IS the data source + the no-JS / no-Plot
// accessible fallback.
//
//   <figure class="hc-chart" data-hc-chart="bar|line|area|combo">
//     <table class="hc-table">
//       <thead><tr><th>月</th><th data-mark="bar">売上</th><th data-mark="line">目標</th></tr></thead>
//       <tbody><tr><td>1月</td><td>120</td><td>150</td></tr>…</tbody>
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
  return type === 'line' || type === 'area' ? type : 'bar';
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

  const xType = (figure.getAttribute('data-x-type') || 'category').toLowerCase();
  const fallbackMark = defaultMarkOf(figure);

  const headCells = [...head.cells];
  const xName = (headCells[0] ? headCells[0].textContent : '').trim();
  const series = headCells.slice(1).map((th) => ({
    name: th.textContent.trim(),
    mark: markFor(th, fallbackMark),
  }));
  if (!series.length) return null;

  const rows = [];
  for (const tr of body.rows) {
    const cells = [...tr.cells];
    if (!cells.length) continue;
    const x = toX(cells[0].textContent, xType);
    series.forEach((s, i) => {
      const cell = cells[i + 1];
      if (!cell) return;
      rows.push({ x, series: s.name, mark: s.mark, value: toNumber(cell.textContent) });
    });
  }
  if (!rows.length) return null;

  return { xName, xType, series, rows };
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

  const node = plot.plot({
    width,
    height,
    className: 'hc-chart__plot',
    style: { background: 'transparent', color: 'inherit', fontFamily: 'inherit' },
    title: title || undefined,
    x: { label: data.xName || undefined, type: xScaleType(data.xType) },
    y: { label: figure.getAttribute('data-y-label') || undefined, grid: true },
    color: range ? { range, legend } : { legend },
    marks: buildMarks(plot, data.rows),
  });

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
