import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/filterbar.html', { waitUntil: 'domcontentloaded' });
});

test.describe('hc-filterbar', () => {
  test('stays on one line and scrolls instead of wrapping', async ({ page }) => {
    const m = await page.getByTestId('list').evaluate((el) => {
      const items = [...el.querySelectorAll('.hc-filterbar__item')];
      return {
        scrolls: el.scrollWidth > el.clientWidth + 1,
        // One line: every item shares the first one's top edge.
        tops: new Set(items.map((i) => Math.round(i.getBoundingClientRect().top))).size,
      };
    });
    expect(m).toEqual({ scrolls: true, tops: 1 });
  });

  test('the bar does not push its container wide', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBe(0);
  });

  test('clear-all stays reachable without scrolling the bar', async ({ page }) => {
    const before = await page.getByTestId('clear').boundingBox();
    await page.getByTestId('list').evaluate((el) => {
      el.scrollLeft = 9999;
    });
    const after = await page.getByTestId('clear').boundingBox();
    expect(Math.round(after.x)).toBe(Math.round(before.x));
    // …and it is inside the viewport, not off the trailing edge.
    expect(after.x + after.width).toBeLessThanOrEqual(800);
  });

  test('a chip opens its own editor', async ({ page }) => {
    await expect(page.getByTestId('pop-buyer')).toBeHidden();
    await page.getByTestId('chip-buyer').click();
    await expect(page.getByTestId('pop-buyer')).toBeVisible();
    // The editor holds that condition's current values.
    await expect(page.getByTestId('pop-buyer').locator('textarea')).toHaveValue(
      /ZAB001000000\ntest1\ntest2/,
    );
  });

  test('remove is a real link to the URL without that condition', async ({ page }) => {
    const remove = page.getByTestId('remove-buyer');
    await expect(remove).toHaveAttribute('href', '/orders?f-ship-from=2026-08-01');
    // Named, not a bare ×.
    await expect(remove).toHaveAttribute('aria-label', 'Remove Buyer code filter');
  });

  test('a long value truncates inside its chip', async ({ page }) => {
    const m = await page.getByTestId('value-long').evaluate((el) => ({
      clipped: el.scrollWidth > el.clientWidth + 1,
      width: Math.round(el.getBoundingClientRect().width),
    }));
    expect(m.clipped).toBe(true);
    // --hc-filterbar-value-max is 12rem = 192px.
    expect(m.width).toBeLessThanOrEqual(192);
  });

  test('a condition with no remove control keeps both ends round', async ({ page }) => {
    const radii = await page.getByTestId('chip-locked').evaluate((el) => {
      const cs = getComputedStyle(el);
      return [cs.borderStartStartRadius, cs.borderStartEndRadius];
    });
    expect(radii[0]).toBe(radii[1]);
  });

  test('an empty bar collapses', async ({ page }) => {
    await expect(page.getByTestId('empty-bar')).toBeHidden();
    await expect(page.getByTestId('bar')).toBeVisible();
  });

  test('axe: no violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations).toEqual([]);
  });
});
