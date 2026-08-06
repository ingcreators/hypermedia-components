// Numeric-column contract (#430): tabular figures by default on
// hc-table / hc-datagrid cells; data-numeric end-aligns (logical, so
// RTL flips free).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function styleOf(page, testId, prop) {
  return page.getByTestId(testId).evaluate(
    (el, p) => getComputedStyle(el)[p],
    prop,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/numeric-cells.html');
});

test.describe('numeric columns', () => {
  test('cells render tabular figures by default', async ({ page }) => {
    for (const id of ['table-text-cell', 'table-num-cell', 'grid-text-cell', 'grid-num-cell']) {
      expect(await styleOf(page, id, 'fontVariantNumeric'), id).toBe('tabular-nums');
    }
  });

  // Where the text actually paints inside the cell (Chromium computes
  // `text-align` to the logical keyword, so assert geometry, not the
  // keyword).
  function gapsOf(page, testId) {
    return page.getByTestId(testId).evaluate((el) => {
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      const cell = el.getBoundingClientRect();
      return { leftGap: text.left - cell.left, rightGap: cell.right - text.right };
    });
  }

  test('data-numeric end-aligns cells and headcells (LTR: right)', async ({ page }) => {
    for (const id of ['table-num-head', 'table-num-cell', 'grid-num-head', 'grid-num-cell']) {
      expect(await styleOf(page, id, 'textAlign'), id).toBe('end');
      const { leftGap, rightGap } = await gapsOf(page, id);
      expect(rightGap, id).toBeLessThan(leftGap);
    }
    // Non-numeric cells keep start alignment.
    for (const id of ['table-text-cell', 'grid-text-cell']) {
      const { leftGap, rightGap } = await gapsOf(page, id);
      expect(leftGap, id).toBeLessThan(rightGap);
    }
  });

  test('data-numeric flips to the left in RTL (logical end)', async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    for (const id of ['table-num-cell', 'grid-num-cell']) {
      const { leftGap, rightGap } = await gapsOf(page, id);
      expect(leftGap, id).toBeLessThan(rightGap);
    }
  });

  test('no axe violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
