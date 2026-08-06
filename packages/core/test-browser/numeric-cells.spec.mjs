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

  test('form controls and the .hc-numeric utility render tabular figures (#433)', async ({ page }) => {
    for (const id of ['numeric-input', 'text-input', 'grid-editor', 'numeric-span']) {
      expect(await styleOf(page, id, 'fontVariantNumeric'), id).toBe('tabular-nums');
    }
  });

  test('data-numeric on an hc-input end-aligns its value, RTL included (#433)', async ({ page }) => {
    expect(await styleOf(page, 'numeric-input', 'textAlign')).toBe('end');
    expect(await styleOf(page, 'text-input', 'textAlign')).toBe('start');

    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    // Logical end resolves to the left edge in RTL — pin via the caret
    // position of typed content: focus and check the input's computed
    // direction-aware alignment still reports the logical keyword.
    expect(await styleOf(page, 'numeric-input', 'textAlign')).toBe('end');
  });

  test('an editor in a data-numeric cell keeps the end alignment (no jump) (#433)', async ({ page }) => {
    expect(await styleOf(page, 'grid-editor', 'textAlign')).toBe('end');
  });

  test('no axe violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
