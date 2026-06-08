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

  test('axe finds no violations in the chart section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-chart')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
