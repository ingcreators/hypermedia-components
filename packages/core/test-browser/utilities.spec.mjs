import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const rect = (loc) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  });

test.describe('layout utilities', () => {
  test('.hc-stack stacks children in a flex column', async ({ page }) => {
    const { display, direction } = await page
      .getByTestId('util-stack')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { display: cs.display, direction: cs.flexDirection };
      });
    expect(display).toBe('flex');
    expect(direction).toBe('column');

    const tops = await page
      .getByTestId('util-stack')
      .evaluate((el) =>
        [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)),
      );
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
  });

  test('.hc-cluster is a wrapping flex row', async ({ page }) => {
    const { display, wrap } = await page
      .getByTestId('util-cluster')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { display: cs.display, wrap: cs.flexWrap };
      });
    expect(display).toBe('flex');
    expect(wrap).toBe('wrap');
  });

  test('.hc-grid lays out columns when wide and collapses to one when narrow', async ({
    page,
  }) => {
    const grid = page.getByTestId('util-grid');
    expect(await grid.evaluate((el) => getComputedStyle(el).display)).toBe('grid');

    // Wide: first two cells share a row (same top, different left).
    await page.setViewportSize({ width: 1280, height: 720 });
    const wide = await grid.evaluate((el) => {
      const a = el.children[0].getBoundingClientRect();
      const b = el.children[1].getBoundingClientRect();
      return { sameRow: Math.abs(a.top - b.top) < 2, differLeft: b.left > a.left + 1 };
    });
    expect(wide.sameRow).toBe(true);
    expect(wide.differLeft).toBe(true);

    // Narrow: cells stack into a single column (different tops).
    await page.setViewportSize({ width: 360, height: 720 });
    const stacked = await grid.evaluate((el) => {
      const a = el.children[0].getBoundingClientRect();
      const b = el.children[1].getBoundingClientRect();
      return b.top > a.top + 1;
    });
    expect(stacked).toBe(true);
  });

  test('.hc-container is centred with a max width', async ({ page }) => {
    const { maxWidth, marginLeft, marginRight } = await page
      .getByTestId('util-container')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          maxWidth: cs.maxWidth,
          marginLeft: cs.marginLeft,
          marginRight: cs.marginRight,
        };
      });
    expect(maxWidth).toMatch(/^\d+(\.\d+)?px$/); // resolved from max-inline-size
    expect(maxWidth).not.toBe('none');
    expect(marginLeft).toBe(marginRight); // margin-inline: auto → symmetric
  });

  test('.hc-sidebar sits side-by-side when wide and wraps when narrow', async ({
    page,
  }) => {
    const aside = page.getByTestId('util-sidebar-aside');
    const main = page.getByTestId('util-sidebar-main');

    await page.setViewportSize({ width: 1280, height: 720 });
    const wideAside = await rect(aside);
    const wideMain = await rect(main);
    expect(Math.abs(wideAside.top - wideMain.top)).toBeLessThan(2); // same row
    expect(wideMain.left).toBeGreaterThan(wideAside.left + 1);

    await page.setViewportSize({ width: 360, height: 720 });
    const narrowAside = await rect(aside);
    const narrowMain = await rect(main);
    expect(narrowMain.top).toBeGreaterThan(narrowAside.top + 1); // wrapped: main below
  });

  test('.hc-sr-only collapses to a 1px clipped box but stays in the a11y tree', async ({
    page,
  }) => {
    const { width, height } = await rect(page.getByTestId('util-sr-only'));
    expect(width).toBeLessThanOrEqual(1.5);
    expect(height).toBeLessThanOrEqual(1.5);
    // Still reachable by accessible name (not display:none).
    await expect(
      page.getByText('screen-reader only label'),
    ).toBeAttached();
  });

  test('.hc-spacer pushes the following content to the inline end', async ({ page }) => {
    const row = await page.getByTestId('util-spacer-row').boundingBox();
    const end = await page.getByTestId('util-spacer-end').boundingBox();
    // The trailing item hugs the row's end edge (within the 8px gap).
    expect(row.x + row.width - (end.x + end.width)).toBeLessThanOrEqual(1);
  });

  test('.hc-hidden is removed from layout', async ({ page }) => {
    const display = await page
      .getByTestId('util-hidden')
      .evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('axe finds no violations in the utilities section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-utilities')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
