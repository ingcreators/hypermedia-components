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

  test('emits hc:datagridsort with the column + direction + sorts', async ({ page }) => {
    await page.getByTestId('h-price').click(); // asc
    await page.getByTestId('h-price').click(); // desc
    const sorts = await page.evaluate(() => window.__sorts);
    expect(sorts).toEqual([
      { col: 'price', direction: 'asc', sorts: [{ col: 'price', direction: 'asc' }] },
      { col: 'price', direction: 'desc', sorts: [{ col: 'price', direction: 'desc' }] },
    ]);
  });

  test('a plain click is single-column — sorting one clears the other', async ({ page }) => {
    await page.getByTestId('h-name').click();
    await expect(page.getByTestId('h-name')).toHaveAttribute('aria-sort', 'ascending');
    await page.getByTestId('h-price').click();
    await expect(page.getByTestId('h-price')).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByTestId('h-name')).toHaveAttribute('aria-sort', 'none');
  });

  test('Shift+Click appends a second sort column with ordinals in the indicator', async ({ page }) => {
    const name = page.getByTestId('h-name');
    const price = page.getByTestId('h-price');
    await name.click();
    await price.click({ modifiers: ['Shift'] });
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
    await expect(price).toHaveAttribute('aria-sort', 'ascending');
    await expect(name).toHaveAttribute('data-sort-index', '1');
    await expect(price).toHaveAttribute('data-sort-index', '2');
    // Chromium resolves attr() in getComputedStyle content; Firefox and
    // WebKit return the unresolved specified value — accept both, the
    // data-sort-index attribute assertions above pin the actual ordinal.
    const c1 = await indicator(name);
    const c2 = await indicator(price);
    expect(c1).toContain('↑');
    expect(c2).toContain('↑');
    expect(c1.includes('↑1') || c1.includes('attr(data-sort-index)')).toBe(true);
    expect(c2.includes('↑2') || c2.includes('attr(data-sort-index)')).toBe(true);
    const last = await page.evaluate(() => window.__sorts.at(-1));
    expect(last.sorts).toEqual([
      { col: 'name', direction: 'asc' },
      { col: 'price', direction: 'asc' },
    ]);
    // Dropping back to one sorted column drops the ordinals.
    await price.click({ modifiers: ['Shift'] }); // desc
    await price.click({ modifiers: ['Shift'] }); // none
    await expect(name).not.toHaveAttribute('data-sort-index', /.+/);
  });

  test('keyboard: focus + Enter sorts', async ({ page }) => {
    const name = page.getByTestId('h-name');
    await name.focus();
    await page.keyboard.press('Enter');
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
  });
});
