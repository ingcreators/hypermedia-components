import { test, expect } from '@playwright/test';

// Sortable datagrid headers: click / Enter toggles aria-sort, updates the
// indicator, and emits hc:datagridsort for the server to sort the page.
test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-sort.html');
});

const indicator = (loc) =>
  loc.evaluate((el) => getComputedStyle(el, '::after').content);

test.describe('datagrid sortable headers', () => {
  test('a sortable header is focusable and shows the sort affordance', async ({ page }) => {
    const name = page.getByTestId('h-name');
    await expect(name).toHaveAttribute('tabindex', '0');
    await expect(name).toHaveAttribute('aria-sort', 'none');
    expect(await indicator(name)).toContain('↕');
  });

  test('clicking cycles aria-sort and the indicator', async ({ page }) => {
    const name = page.getByTestId('h-name');
    await name.click();
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
    expect(await indicator(name)).toContain('↑');
    await name.click();
    await expect(name).toHaveAttribute('aria-sort', 'descending');
    expect(await indicator(name)).toContain('↓');
    await name.click();
    await expect(name).toHaveAttribute('aria-sort', 'none');
  });

  test('emits hc:datagridsort with the column + direction', async ({ page }) => {
    await page.getByTestId('h-price').click(); // asc
    await page.getByTestId('h-price').click(); // desc
    const sorts = await page.evaluate(() => window.__sorts);
    expect(sorts).toEqual([
      { col: 'price', direction: 'asc' },
      { col: 'price', direction: 'desc' },
    ]);
  });

  test('is single-column — sorting one clears the other', async ({ page }) => {
    await page.getByTestId('h-name').click();
    await expect(page.getByTestId('h-name')).toHaveAttribute('aria-sort', 'ascending');
    await page.getByTestId('h-price').click();
    await expect(page.getByTestId('h-price')).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByTestId('h-name')).toHaveAttribute('aria-sort', 'none');
  });

  test('keyboard: focus + Enter sorts', async ({ page }) => {
    const name = page.getByTestId('h-name');
    await name.focus();
    await page.keyboard.press('Enter');
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
  });
});
