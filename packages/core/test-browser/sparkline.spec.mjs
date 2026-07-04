import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-sparkline (installSparkline) — a tiny inline trend drawn from
// `data-values` with the DOM API (CSP-safe, no charting dependency). The
// stroke uses currentColor, so `data-variant` re-colours the whole mark and
// it re-resolves under `data-theme`.
test.beforeEach(async ({ page }) => {
  // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
  // so the dark flip applies instantly and axe samples final palettes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sparkline.html');
});

const strokeColor = (locator) =>
  locator.locator('polyline.hc-sparkline__line').evaluate(
    (el) => getComputedStyle(el).stroke,
  );

test.describe('hc-sparkline', () => {
  test('renders a polyline with one point per value', async ({ page }) => {
    const svg = page.getByTestId('default').locator('svg.hc-sparkline__svg');
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute('aria-hidden', 'true');

    const points = await page
      .getByTestId('default')
      .locator('polyline')
      .getAttribute('points');
    expect(points.trim().split(/\s+/)).toHaveLength(6);
  });

  test('a labelled sparkline is exposed as role="img"; a bare one is decorative', async ({
    page,
  }) => {
    await expect(page.getByTestId('default')).toHaveAttribute('role', 'img');
    await expect(page.getByTestId('decorative')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('decorative')).not.toHaveAttribute('role', 'img');
  });

  test('data-area adds a filled polygon', async ({ page }) => {
    await expect(
      page.getByTestId('success').locator('polygon.hc-sparkline__area'),
    ).toHaveCount(1);
    await expect(
      page.getByTestId('default').locator('polygon.hc-sparkline__area'),
    ).toHaveCount(0);
  });

  test('variants colour the stroke distinctly via currentColor', async ({ page }) => {
    const base = await strokeColor(page.getByTestId('default'));
    const success = await strokeColor(page.getByTestId('success'));
    const error = await strokeColor(page.getByTestId('error'));
    expect(success).not.toBe(base);
    expect(error).not.toBe(base);
    expect(success).not.toBe(error);
  });

  test('a server-rendered svg (markup convention) is left untouched', async ({ page }) => {
    const svgs = page.getByTestId('server').locator('svg.hc-sparkline__svg');
    await expect(svgs).toHaveCount(1);
    await expect(svgs).toHaveAttribute('data-server', '1');
  });

  test('stroke colour re-resolves under data-theme="dark"', async ({ page }) => {
    const light = await strokeColor(page.getByTestId('error'));
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await strokeColor(page.getByTestId('error'))).not.toBe(light);
  });

  test('axe finds no violations in light and dark', async ({ page }) => {
    expect(
      (await new AxeBuilder({ page }).include('#section-sparkline').analyze()).violations,
    ).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(
      (await new AxeBuilder({ page }).include('#section-sparkline').analyze()).violations,
    ).toEqual([]);
  });
});
