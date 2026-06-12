import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-table key-value variant', () => {
  test('keys take the fixed inline size with muted text', async ({ page }) => {
    const key = page.getByTestId('kv-key');
    const width = await key.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(160); // --hc-table-kv-key-width: 10rem

    const keyColor = await key.evaluate((el) => getComputedStyle(el).color);
    const valueColor = await page
      .getByTestId('kv-value')
      .evaluate((el) => getComputedStyle(el).color);
    expect(keyColor).not.toBe(valueColor); // muted key vs body value
  });

  test('rows do not highlight on hover (nothing to act on)', async ({ page }) => {
    const row = page.getByTestId('kv-key').locator('..');
    const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(before);
  });

  test('axe finds no violations in the key-value table section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-table-kv').analyze();
    expect(results.violations).toEqual([]);
  });
});
