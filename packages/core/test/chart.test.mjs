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
  const calls = { barY: [], lineY: [], areaY: [], dot: [], ruleY: [], plot: [] };
  const mark = (name) => (data, opts) => {
    calls[name].push({ data, opts });
    return { mark: name };
  };
  const plot = {
    barY: mark('barY'),
    lineY: mark('lineY'),
    areaY: mark('areaY'),
    dot: mark('dot'),
    ruleY: mark('ruleY'),
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
