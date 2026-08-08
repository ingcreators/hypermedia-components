import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-item', () => {
  test('lays out media, content and actions in a row in order', async ({ page }) => {
    const item = page.getByTestId('item-basic');
    await expect(item).toHaveCSS('display', 'flex');

    const media = await page.getByTestId('item-media').boundingBox();
    const title = await page.getByTestId('item-title').boundingBox();
    const actions = await page.getByTestId('item-actions').boundingBox();

    // Media is left of the content, actions are at the far end.
    expect(media.x).toBeLessThan(title.x);
    expect(title.x).toBeLessThan(actions.x);
  });

  test('the title sits above the description (content is a column)', async ({ page }) => {
    const title = await page.getByTestId('item-title').boundingBox();
    const desc = await page.getByTestId('item-desc').boundingBox();
    expect(title.y).toBeLessThan(desc.y);
  });

  test('a selected item gets a non-transparent background', async ({ page }) => {
    const bg = await page
      .getByTestId('item-selected')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
  });

  test('aria-current="page" gets the selected treatment (nav lists)', async ({ page }) => {
    const current = await page
      .getByTestId('item-nav-current')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const other = await page
      .getByTestId('item-nav-other')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(current).not.toBe('rgba(0, 0, 0, 0)');
    expect(other).toBe('rgba(0, 0, 0, 0)');
  });

  test('data-variant="error" tints the title', async ({ page }) => {
    expect(await cssColor(page.getByTestId('item-error-title'), 'color')).toBe('rgb(206, 14, 24)');
  });

  test('axe finds no violations across the item examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-item').analyze();
    expect(results.violations).toEqual([]);
  });
});
