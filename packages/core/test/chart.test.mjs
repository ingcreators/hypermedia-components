import { describe, it, expect, afterEach } from 'vitest';
import { installChart } from '../src/js/chart.js';

let uninstall = () => {};

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

// A minimal fake Observable Plot namespace that records mark calls and
// returns a real <svg> from plot(), so we can assert what installChart
// reads from the table without depending on Plot itself.
function fakePlot() {
  const calls = { barY: [], barX: [], lineY: [], areaY: [], dot: [], ruleY: [], ruleX: [], rectY: [], cell: [], binX: [], tip: [], plot: [] };
  const mark = (name) => (data, opts) => {
    calls[name].push({ data, opts });
    return { mark: name };
  };
  const pointer = (mode) => (opts) => ({ pointer: mode, ...opts });
  const plot = {
    barY: mark('barY'),
    barX: mark('barX'),
    ruleX: mark('ruleX'),
    lineY: mark('lineY'),
    areaY: mark('areaY'),
    dot: mark('dot'),
    ruleY: mark('ruleY'),
    rectY: mark('rectY'),
    cell: mark('cell'),
    tip: mark('tip'),
    pointer: pointer('xy'),
    pointerX: pointer('x'),
    pointerY: pointer('y'),
    binX: (outputs, opts) => {
      calls.binX.push({ outputs, opts });
      return { transform: 'binX', outputs, opts };
    },
    plot: (opts) => {
      calls.plot.push(opts);
      return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    },
  };
  return { plot, calls };
}

function mount(html) {
  document.body.innerHTML = html;
  return document.querySelector('.hc-chart');
}

const BAR = `
  <figure class="hc-chart" data-hc-chart="bar">
    <table class="hc-table">
      <caption>Sales</caption>
      <thead><tr><th>Month</th><th>Sales</th></tr></thead>
      <tbody>
        <tr><td>Jan</td><td>1,200</td></tr>
        <tr><td>Feb</td><td>200</td></tr>
      </tbody>
    </table>
  </figure>`;

const COMBO = `
  <figure class="hc-chart" data-hc-chart="combo">
    <table class="hc-table">
      <thead><tr><th>Month</th><th data-mark="bar">Sales</th><th data-mark="line">Target</th></tr></thead>
      <tbody><tr><td>Jan</td><td>120</td><td>150</td></tr></tbody>
    </table>
  </figure>`;

describe('installChart', () => {
  it('reads the table into tidy rows and coerces numbers', () => {
    mount(BAR);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(calls.barY.length).toBe(1);
    expect(calls.barY[0].data).toEqual([
      { x: 'Jan', series: 'Sales', mark: 'bar', value: 1200 },
      { x: 'Feb', series: 'Sales', mark: 'bar', value: 200 },
    ]);
    // No line/area marks for a pure bar chart.
    expect(calls.lineY.length).toBe(0);
    expect(calls.areaY.length).toBe(0);
  });

  it('partitions combo series by per-column data-mark', () => {
    mount(COMBO);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(calls.barY[0].data).toEqual([
      { x: 'Jan', series: 'Sales', mark: 'bar', value: 120 },
    ]);
    expect(calls.lineY[0].data).toEqual([
      { x: 'Jan', series: 'Target', mark: 'line', value: 150 },
    ]);
    // Line series also get node dots.
    expect(calls.dot.length).toBe(1);
  });

  it('pins the categorical x domain to the table row order (no alpha sort)', () => {
    mount(`
      <figure class="hc-chart" data-hc-chart="bar">
        <table><thead><tr><th>Month</th><th>Sales</th></tr></thead>
        <tbody>
          <tr><td>Mar</td><td>1</td></tr>
          <tr><td>Jan</td><td>2</td></tr>
          <tr><td>Feb</td><td>3</td></tr>
        </tbody></table>
      </figure>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    // Row order is preserved, not sorted alphabetically (Feb/Jan/Mar).
    expect(calls.plot[0].x.domain).toEqual(['Mar', 'Jan', 'Feb']);
  });

  it('uses data-hc-chart as the default mark (line)', () => {
    mount(`
      <figure class="hc-chart" data-hc-chart="line">
        <table><thead><tr><th>M</th><th>A</th></tr></thead>
        <tbody><tr><td>Jan</td><td>5</td></tr></tbody></table>
      </figure>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(calls.lineY.length).toBe(1);
    expect(calls.barY.length).toBe(0);
  });

  it('renders: hides the table (sr-only), aria-hides the svg, marks state', () => {
    const figure = mount(BAR);
    const table = figure.querySelector('table');
    const { plot } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(table.classList.contains('hc-sr-only')).toBe(true);
    const svg = figure.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(figure.getAttribute('data-state')).toBe('rendered');
  });

  it('is a no-op without Plot: the table stays visible', () => {
    const figure = mount(BAR);
    const table = figure.querySelector('table');
    uninstall = installChart(document, {}); // no plot provided, no global

    expect(figure.querySelector('svg')).toBeNull();
    expect(table.classList.contains('hc-sr-only')).toBe(false);
    expect(figure.hasAttribute('data-state')).toBe(false);
  });

  it('is idempotent: a second install returns the same uninstaller and does not re-render', () => {
    mount(BAR);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    const again = installChart(document, { plot });

    expect(again).toBe(uninstall);
    expect(calls.plot.length).toBe(1);
  });

  it('renders charts swapped in via htmx:load', () => {
    mount(BAR); // first chart
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot.length).toBe(1);

    const wrap = document.createElement('div');
    wrap.innerHTML = COMBO;
    document.body.appendChild(wrap);
    wrap.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true }));

    expect(calls.plot.length).toBe(2);
    expect(document.querySelectorAll('.hc-chart[data-state="rendered"]').length).toBe(2);
  });

  it('uninstall stops the htmx:load listener', () => {
    mount(BAR);
    const { plot, calls } = fakePlot();
    const stop = installChart(document, { plot });
    expect(calls.plot.length).toBe(1);

    stop();
    uninstall = () => {};

    const wrap = document.createElement('div');
    wrap.innerHTML = COMBO;
    document.body.appendChild(wrap);
    wrap.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true }));

    expect(calls.plot.length).toBe(1); // no new render after uninstall
  });
});


function fig(type, tableInner, extra = '') {
  return `
  <figure class="hc-chart" data-hc-chart="${type}" ${extra}>
    <table class="hc-table">${tableInner}</table>
  </figure>`;
}

describe('Tier 2 presets', () => {
  it('bar-stacked renders one stacked barY over all series', () => {
    document.body.innerHTML = fig('bar-stacked', `
      <thead><tr><th>Month</th><th>Tokyo</th><th>Osaka</th></tr></thead>
      <tbody><tr><td>Jan</td><td>10</td><td>20</td></tr><tr><td>Feb</td><td>30</td><td>40</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.barY).toHaveLength(1);
    const { data, opts } = calls.barY[0];
    expect(data).toHaveLength(4);
    expect(opts).toMatchObject({ x: 'x', y: 'value', fill: 'series' });
    expect(opts.fx).toBeUndefined();
  });

  it('bar-grouped facets by the category and hides the inner axis', () => {
    document.body.innerHTML = fig('bar-grouped', `
      <thead><tr><th>Month</th><th>Tokyo</th><th>Osaka</th></tr></thead>
      <tbody><tr><td>Jan</td><td>10</td><td>20</td></tr><tr><td>Feb</td><td>30</td><td>40</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    const { opts } = calls.barY[0];
    expect(opts).toMatchObject({ fx: 'x', x: 'series', y: 'value' });
    const plotOpts = calls.plot[0];
    expect(plotOpts.x).toEqual({ axis: null });
    expect(plotOpts.fx.label).toBe('Month');
    expect(plotOpts.fx.domain).toEqual(['Jan', 'Feb']); // first-appearance order
  });

  it('scatter defaults x to number and maps a data-role="r" column to the radius channel', () => {
    document.body.innerHTML = fig('scatter', `
      <thead><tr><th>Height</th><th>Weight</th><th data-role="r">Count</th></tr></thead>
      <tbody><tr><td>150</td><td>52</td><td>3</td></tr><tr><td>172</td><td>70</td><td>9</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.dot).toHaveLength(1);
    const { data, opts } = calls.dot[0];
    expect(opts).toMatchObject({ x: 'x', y: 'value', r: 'r' });
    expect(data[0]).toMatchObject({ x: 150, value: 52, r: 3 }); // numeric x, r attached
    expect(calls.plot[0].x.type).toBe('linear');
  });

  it('scatter without an r column uses a fixed radius', () => {
    document.body.innerHTML = fig('scatter', `
      <thead><tr><th>X</th><th>Y</th></tr></thead>
      <tbody><tr><td>1</td><td>2</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.dot[0].opts.r).toBe(4);
  });

  it('sparkline strips axes/grid/legend and defaults to a compact height', () => {
    document.body.innerHTML = fig('sparkline', `
      <thead><tr><th>Day</th><th>Load</th></tr></thead>
      <tbody><tr><td>Mon</td><td>1</td></tr><tr><td>Tue</td><td>3</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.lineY).toHaveLength(1);
    const plotOpts = calls.plot[0];
    expect(plotOpts.height).toBe(48);
    expect(plotOpts.x.axis).toBeNull();
    expect(plotOpts.y).toEqual({ axis: null, grid: false });
    expect(plotOpts.color.legend).toBe(false);
  });

  it('sparkline honours an explicit data-height', () => {
    document.body.innerHTML = fig('sparkline', `
      <thead><tr><th>Day</th><th>Load</th></tr></thead>
      <tbody><tr><td>Mon</td><td>1</td></tr></tbody>`, 'data-height="80"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].height).toBe(80);
  });
});


describe('Tier 3 presets', () => {
  it('histogram reads one numeric column and bins it (data-bins → thresholds)', () => {
    document.body.innerHTML = fig('histogram', `
      <thead><tr><th>Response time</th></tr></thead>
      <tbody><tr><td>120</td></tr><tr><td>1,300</td></tr><tr><td>90</td></tr><tr><td>n/a</td></tr></tbody>`,
      'data-bins="12"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.rectY).toHaveLength(1);
    const { data, opts } = calls.rectY[0];
    expect(data.map((d) => d.x)).toEqual([120, 1300, 90]); // numeric, bad rows dropped
    expect(opts.transform).toBe('binX');
    expect(calls.binX[0].outputs).toEqual({ y: 'count' });
    expect(calls.binX[0].opts).toMatchObject({ x: 'x', thresholds: 12 });
    expect(calls.plot[0].x.type).toBe('linear');
    expect(calls.plot[0].color.legend).toBe(false);
  });

  it('heatmap maps the matrix to cell with a continuous fill and ordered domains', () => {
    document.body.innerHTML = fig('heatmap', `
      <thead><tr><th>Day</th><th>Mon</th><th>Tue</th></tr></thead>
      <tbody><tr><td>Morning</td><td>3</td><td>7</td></tr><tr><td>Evening</td><td>9</td><td>2</td></tr></tbody>`,
      'data-y-label="Visits" data-scheme="blues"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.cell).toHaveLength(1);
    const { opts } = calls.cell[0];
    expect(opts).toEqual({ x: 'series', y: 'x', fill: 'value' });
    const plotOpts = calls.plot[0];
    expect(plotOpts.x.domain).toEqual(['Mon', 'Tue']);
    expect(plotOpts.y.domain).toEqual(['Morning', 'Evening']);
    expect(plotOpts.color).toMatchObject({ legend: true, label: 'Visits', scheme: 'blues' });
  });

  it('leaves a server-rendered figure alone (the linkedom SSR path)', () => {
    document.body.innerHTML = fig('bar', `
      <thead><tr><th>Month</th><th>Sales</th></tr></thead>
      <tbody><tr><td>Jan</td><td>1</td></tr></tbody>`,
      'data-state="rendered"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot).toHaveLength(0); // untouched
  });
});


describe('Horizontal presets', () => {
  const RANKING = `
    <thead><tr><th>Product</th><th>Sales</th></tr></thead>
    <tbody>
      <tr><td>Long product name A</td><td>320</td></tr>
      <tr><td>Long product name B</td><td>180</td></tr>
    </tbody>`;
  const TWO_SERIES = `
    <thead><tr><th>Quarter</th><th>Store</th><th>Online</th></tr></thead>
    <tbody><tr><td>Q1</td><td>80</td><td>45</td></tr><tr><td>Q2</td><td>95</td><td>70</td></tr></tbody>`;

  it('bar-x puts categories on y (row order) and values on x with a zero ruleX', () => {
    document.body.innerHTML = fig('bar-x', RANKING, 'data-y-label="Sales ($k)"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(calls.barX).toHaveLength(1);
    expect(calls.barX[0].opts).toMatchObject({ y: 'x', x: 'value', fill: 'series' });
    expect(calls.ruleX).toHaveLength(1);
    expect(calls.ruleY).toHaveLength(0);

    const plotOpts = calls.plot[0];
    expect(plotOpts.y.domain).toEqual(['Long product name A', 'Long product name B']);
    expect(plotOpts.y.label).toBe('Product');
    // The value-axis config (label, grid) moved from y to x wholesale.
    expect(plotOpts.x.label).toBe('Sales ($k)');
    expect(plotOpts.x.grid).toBe(true);
  });

  it('bar-x honours the value-axis pins: data-y-min/max land on x and gate the zero rule', () => {
    document.body.innerHTML = fig('bar-x', RANKING, 'data-y-min="100" data-y-max="400"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].x.domain).toEqual([100, 400]);
    expect(calls.ruleX).toHaveLength(0); // 0 outside [100, 400]
  });

  it('bar-x data-tip defaults to snapping along y (the category axis)', () => {
    document.body.innerHTML = fig('bar-x', TWO_SERIES, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip).toHaveLength(1);
    expect(calls.tip[0].opts).toMatchObject({ pointer: 'y', y: 'x', x: 'value' });
    expect(calls.tip[0].opts.channels).toEqual({ series: 'series' });
  });

  it('bar-x-grouped facets on fy, hides the inner y axis, keeps first-appearance order', () => {
    document.body.innerHTML = fig('bar-x-grouped', TWO_SERIES, 'data-y-label="Orders" data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });

    expect(calls.barX[0].opts).toMatchObject({ fy: 'x', y: 'series', x: 'value' });
    const plotOpts = calls.plot[0];
    expect(plotOpts.y).toEqual({ axis: null });
    expect(plotOpts.fy.label).toBe('Quarter');
    expect(plotOpts.fy.domain).toEqual(['Q1', 'Q2']);
    expect(plotOpts.x.label).toBe('Orders');
    expect(calls.tip[0].opts).toMatchObject({ fy: 'x', y: 'series', x: 'value' });
    expect(calls.tip[0].opts.channels).toEqual({ Quarter: 'x' });
  });
});


describe('options: data-tip', () => {
  const TWO_SERIES = `
    <thead><tr><th>Month</th><th>Tokyo</th><th>Osaka</th></tr></thead>
    <tbody><tr><td>Jan</td><td>10</td><td>20</td></tr></tbody>`;

  it('is off by default (no tip mark)', () => {
    document.body.innerHTML = fig('bar', TWO_SERIES);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip).toHaveLength(0);
  });

  it('a bare data-tip adds one standalone tip mark snapping along x', () => {
    document.body.innerHTML = fig('bar', TWO_SERIES, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip).toHaveLength(1);
    const { data, opts } = calls.tip[0];
    expect(data).toHaveLength(2); // all valid rows, both series
    expect(opts).toMatchObject({ pointer: 'x', x: 'x', y: 'value' });
    expect(opts.channels).toEqual({ series: 'series' }); // multi-series → named
  });

  it('a single series omits the redundant series channel', () => {
    document.body.innerHTML = fig('line', `
      <thead><tr><th>Month</th><th>Sales</th></tr></thead>
      <tbody><tr><td>Jan</td><td>10</td></tr></tbody>`, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip[0].opts.channels).toBeUndefined();
  });

  it('data-tip="xy" and data-tip="false" are honoured', () => {
    document.body.innerHTML = fig('bar', TWO_SERIES, 'data-tip="xy"')
      + fig('bar', TWO_SERIES, 'data-tip="false"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip).toHaveLength(1);
    expect(calls.tip[0].opts.pointer).toBe('xy');
  });

  it('scatter defaults to xy pointing and carries the r channel', () => {
    document.body.innerHTML = fig('scatter', `
      <thead><tr><th>X</th><th>Y</th><th data-role="r">N</th></tr></thead>
      <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody>`, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip[0].opts).toMatchObject({ pointer: 'xy', r: 'r' });
  });

  it('bar-grouped tips point within the facet and surface the category', () => {
    document.body.innerHTML = fig('bar-grouped', TWO_SERIES, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip[0].opts).toMatchObject({ fx: 'x', x: 'series', y: 'value' });
    expect(calls.tip[0].opts.channels).toEqual({ Month: 'x' });
  });

  it('histogram and heatmap use the mark-level tip instead', () => {
    document.body.innerHTML = fig('histogram', `
      <thead><tr><th>ms</th></tr></thead>
      <tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody>`, 'data-tip')
      + fig('heatmap', TWO_SERIES, 'data-tip');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.tip).toHaveLength(0); // no standalone tip mark
    expect(calls.binX[0].opts.tip).toBe(true);
    expect(calls.cell[0].opts.tip).toBe(true);
  });
});


describe('options: y domain and format', () => {
  const ONE_SERIES = `
    <thead><tr><th>Month</th><th>Sales</th></tr></thead>
    <tbody><tr><td>Jan</td><td>40</td></tr><tr><td>Feb</td><td>80</td></tr></tbody>`;

  it('data-y-min + data-y-max pin the y domain', () => {
    document.body.innerHTML = fig('line', ONE_SERIES, 'data-y-min="20" data-y-max="100"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].y.domain).toEqual([20, 100]);
  });

  it('a one-sided bound falls back to the data extent (0-floored min)', () => {
    document.body.innerHTML = fig('line', ONE_SERIES, 'data-y-max="100"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].y.domain).toEqual([0, 100]);
  });

  it('drops the zero baseline rule when 0 is outside the domain', () => {
    document.body.innerHTML = fig('line', ONE_SERIES, 'data-y-min="20" data-y-max="100"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.ruleY).toHaveLength(0);
  });

  it('keeps the zero baseline when the domain includes 0', () => {
    document.body.innerHTML = fig('bar', ONE_SERIES, 'data-y-min="0" data-y-max="100"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.ruleY).toHaveLength(1);
  });

  it('no domain is set without the attributes', () => {
    document.body.innerHTML = fig('bar', ONE_SERIES);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].y.domain).toBeUndefined();
  });

  it('data-y-format flows into y.tickFormat', () => {
    document.body.innerHTML = fig('bar', ONE_SERIES, 'data-y-format="s"');
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot });
    expect(calls.plot[0].y.tickFormat).toBe('s');
  });
});


describe('options: buildOptions hook', () => {
  it('receives the final spec + figure and its return value wins', () => {
    document.body.innerHTML = fig('bar', `
      <thead><tr><th>M</th><th>V</th></tr></thead>
      <tbody><tr><td>Jan</td><td>1</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    const seen = [];
    uninstall = installChart(document, {
      plot,
      buildOptions: (spec, figure) => {
        seen.push({ spec, figure });
        return { ...spec, marginLeft: 99 };
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].figure.matches('.hc-chart')).toBe(true);
    expect(seen[0].spec.marks.length).toBeGreaterThan(0);
    expect(calls.plot[0].marginLeft).toBe(99);
  });

  it('a hook returning nothing keeps the built spec', () => {
    document.body.innerHTML = fig('bar', `
      <thead><tr><th>M</th><th>V</th></tr></thead>
      <tbody><tr><td>Jan</td><td>1</td></tr></tbody>`);
    const { plot, calls } = fakePlot();
    uninstall = installChart(document, { plot, buildOptions: () => {} });
    expect(calls.plot).toHaveLength(1);
    expect(calls.plot[0].width).toBeGreaterThan(0);
  });
});


