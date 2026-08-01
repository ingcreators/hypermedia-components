import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/chart.html');
});

test.describe('hc-chart (installChart)', () => {
  test('renders an svg, hides the table for sight, keeps it for AT', async ({ page }) => {
    const figure = page.getByTestId('chart-bar');
    await expect(figure).toHaveAttribute('data-state', 'rendered');

    const svg = figure.locator('svg');
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute('aria-hidden', 'true');

    // The source table is preserved (screen-reader data) but visually hidden.
    const table = figure.locator('table');
    await expect(table).toHaveClass(/hc-sr-only/);
  });

  test('resolves the series palette and grid options from tokens', async ({ page }) => {
    const info = await page.evaluate(() =>
      window.__plotOpts.map((o) => ({
        markNames: o.marks.map((m) => m && m.name),
        rangeLen: o.color && o.color.range ? o.color.range.length : 0,
        grid: !!(o.y && o.y.grid),
        height: o.height,
        yLabel: o.y && o.y.label,
      })),
    );

    // First chart is the bar figure (document order).
    expect(info[0].markNames).toContain('barY');
    expect(info[0].rangeLen).toBe(6); // --hc-chart-series-1..6
    expect(info[0].grid).toBe(true);
    expect(info[0].height).toBeGreaterThan(200);
    expect(info[0].yLabel).toBe('Sales');
  });

  test('combo splits series into bar + line marks by data-mark', async ({ page }) => {
    const combo = await page.evaluate(() => {
      const o = window.__plotOpts[1]; // second chart = combo
      return o.marks.map((m) => m && m.name);
    });
    expect(combo).toContain('barY');
    expect(combo).toContain('lineY');
    expect(combo).toContain('dot');
  });

  test('renders a chart swapped in via htmx:load', async ({ page }) => {
    const before = await page.evaluate(() => window.__plotOpts.length);
    await page.getByTestId('swap-btn').click();

    const swapped = page.getByTestId('chart-swapped');
    await expect(swapped).toHaveAttribute('data-state', 'rendered');
    await expect(swapped.locator('svg')).toHaveCount(1);

    const after = await page.evaluate(() => window.__plotOpts.length);
    expect(after).toBe(before + 1);
  });

  test('tier 2: grouped facets, scatter r-channel, sparkline chrome-off', async ({ page }) => {
    const opts = await page.evaluate(() => window.__plotOpts);
    const grouped = opts.find((o) => o.fx);
    expect(grouped.fx.label).toBe('Month');
    expect(grouped.fx.domain).toEqual(['Jan', 'Feb']);
    expect(grouped.x).toEqual({ axis: null });

    const spark = opts.find((o) => o.height === 48);
    expect(spark.y).toEqual({ axis: null, grid: false });
    expect(spark.color.legend).toBe(false);

    const marks = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="chart-scatter"] svg')].length);
    expect(marks).toBe(1); // scatter rendered

    // Every tier-2 figure keeps its table for AT and renders an svg.
    for (const id of ['chart-grouped', 'chart-scatter', 'chart-sparkline']) {
      await expect(page.locator(`[data-testid="${id}"] svg`)).toHaveCount(1);
      await expect(page.locator(`[data-testid="${id}"] table`)).toHaveClass(/hc-sr-only/);
    }
  });

  test('tier 3: histogram bins, heatmap cell + domains, SSR figures untouched', async ({ page }) => {
    const opts = await page.evaluate(() => window.__plotOpts);

    const heat = opts.find((o) => o.color && o.color.label === 'Visits');
    expect(heat.x.domain).toEqual(['Mon', 'Tue', 'Wed']);
    expect(heat.y.domain).toEqual(['Morning', 'Evening']);
    expect(heat.color.legend).toBe(true);

    await expect(page.locator('[data-testid="chart-histogram"] svg')).toHaveCount(1);
    await expect(page.locator('[data-testid="chart-heatmap"] svg')).toHaveCount(1);

    // The pre-rendered SSR figure kept its original svg — exactly one,
    // ours, and the behavior did not add a second plot for it.
    await expect(page.locator('[data-testid="chart-ssr"] svg')).toHaveCount(1);
    await expect(page.getByTestId('ssr-svg')).toBeAttached();
  });

  test('options: data-tip adds one tip mark; y domain/format + buildOptions apply', async ({ page }) => {
    const tipped = await page.evaluate(() => {
      const o = window.__plotOpts.find((x) => x.marginLeft === 77); // buildOptions marker
      return o && {
        markNames: o.marks.map((m) => m && m.name),
        tip: o.marks.find((m) => m && m.name === 'tip'),
        yDomain: o.y.domain,
        yFormat: o.y.tickFormat,
      };
    });
    expect(tipped).toBeTruthy();
    expect(tipped.markNames.filter((n) => n === 'tip')).toHaveLength(1);
    expect(tipped.tip.opts).toMatchObject({ pointer: 'x', x: 'x', y: 'value' });
    expect(tipped.yDomain).toEqual([10, 90]);
    expect(tipped.yFormat).toBe('s');
    // 0 is outside [10, 90] → the zero baseline rule is dropped.
    expect(tipped.markNames).not.toContain('ruleY');

    // The hook ran for every rendered figure on the page.
    const seen = await page.evaluate(() => window.__buildOptionsSeen.length);
    const rendered = await page.evaluate(() => window.__plotOpts.length);
    expect(seen).toBe(rendered);
  });

  test('horizontal: bar-x swaps the axes, bar-x-grouped facets on fy', async ({ page }) => {
    const info = await page.evaluate(() => {
      const barx = window.__plotOpts.find((o) =>
        o.marks.some((m) => m && m.name === 'barX' && !m.opts.fy));
      const grouped = window.__plotOpts.find((o) => o.fy);
      return {
        barx: barx && {
          markNames: barx.marks.map((m) => m && m.name),
          yDomain: barx.y.domain,
          yLabel: barx.y.label,
          xLabel: barx.x.label,
          xGrid: !!barx.x.grid,
          tip: barx.marks.find((m) => m && m.name === 'tip'),
        },
        grouped: grouped && {
          fyLabel: grouped.fy.label,
          fyDomain: grouped.fy.domain,
          yAxis: grouped.y.axis,
          xLabel: grouped.x.label,
        },
      };
    });

    expect(info.barx.markNames).toContain('ruleX');
    expect(info.barx.yDomain).toEqual(['Alpha', 'Beta']);
    expect(info.barx.yLabel).toBe('Product');
    expect(info.barx.xLabel).toBe('Sales ($k)');
    expect(info.barx.xGrid).toBe(true);
    expect(info.barx.tip.opts.pointer).toBe('y'); // snaps along the category axis

    expect(info.grouped.fyLabel).toBe('Quarter');
    expect(info.grouped.fyDomain).toEqual(['Q1', 'Q2']);
    expect(info.grouped.yAxis).toBeNull();
    expect(info.grouped.xLabel).toBe('Orders');

    for (const id of ['chart-barx', 'chart-barx-grouped']) {
      await expect(page.locator(`[data-testid="${id}"] svg`)).toHaveCount(1);
      await expect(page.locator(`[data-testid="${id}"] table`)).toHaveClass(/hc-sr-only/);
    }
  });

  test('axe finds no violations in the chart section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-chart')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
