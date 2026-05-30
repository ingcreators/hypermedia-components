import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/responsive.html', { waitUntil: 'domcontentloaded' });
});

test.describe('responsive — table scroll wrapper', () => {
  test('.hc-table-scroll confines a wide table to a horizontal scroll strip', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 700 });
    const wrap = page.getByTestId('table-scroll');

    const overflowX = await wrap.evaluate((el) => getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflowX);

    const { scrollW, clientW } = await wrap.evaluate((el) => ({
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));
    // The table is wider than the wrapper → the wrapper scrolls, the page
    // does not overflow.
    expect(scrollW).toBeGreaterThan(clientW);

    // The wrapper itself stays within the viewport.
    const right = await wrap.evaluate((el) => el.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(400 + 1);
  });

  test('the scroll region is keyboard-focusable (axe clean)', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 });
    const results = await new AxeBuilder({ page })
      .include('#section-table-scroll')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('responsive — pagination wrap', () => {
  test('pagination wraps onto multiple rows when the container is narrow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    const tops = await page
      .getByTestId('pagination')
      .evaluate((el) =>
        [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)),
      );
    const distinctRows = new Set(tops).size;
    expect(distinctRows).toBeGreaterThan(1); // wrapped
  });

  test('stays on one row when there is room', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    // Remove the narrow cap so the row has space.
    await page
      .getByTestId('section-pagination')
      .evaluate((el) => {
        el.style.maxInlineSize = 'none';
      });
    const tops = await page
      .getByTestId('pagination')
      .evaluate((el) =>
        [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)),
      );
    expect(new Set(tops).size).toBe(1);
  });
});
