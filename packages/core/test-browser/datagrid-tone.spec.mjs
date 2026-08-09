import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-tone.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

const bgImage = (loc) =>
  loc.evaluate((el) => getComputedStyle(el).backgroundImage);
const bgColor = (loc) =>
  loc.evaluate((el) => getComputedStyle(el).backgroundColor);
const fgColor = (loc) => loc.evaluate((el) => getComputedStyle(el).color);

test.describe('data-tone conditional formatting', () => {
  test('a toned datagrid cell paints a gradient tint + tone color', async ({ page }) => {
    expect(await bgImage(page.getByTestId('cell-success'))).toContain('linear-gradient');
    const plainFg = await fgColor(page.getByTestId('grid').locator('.hc-datagrid__cell').first());
    expect(await fgColor(page.getByTestId('cell-error'))).not.toBe(plainFg);
  });

  test('a row-level tone tints every cell of the row', async ({ page }) => {
    expect(await bgImage(page.getByTestId('row-warning-first'))).toContain('linear-gradient');
  });

  test('different tones resolve to different tints', async ({ page }) => {
    const success = await bgImage(page.getByTestId('cell-success'));
    const error = await bgImage(page.getByTestId('cell-error'));
    expect(success).not.toBe(error);
  });

  test('hc-table tones paint background + tone color, row-level included', async ({ page }) => {
    const plain = await bgColor(page.getByTestId('table').locator('td').first());
    expect(await bgColor(page.getByTestId('t-success'))).not.toBe(plain);
    expect(await bgColor(page.getByTestId('t-row-error-first'))).not.toBe(plain);
  });

  test('tones flip with the dark theme', async ({ page }) => {
    const light = await bgImage(page.getByTestId('cell-success'));
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const dark = await bgImage(page.getByTestId('cell-success'));
    expect(dark).not.toBe(light);
  });

  test('axe finds no violations (incl. tone contrast)', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
