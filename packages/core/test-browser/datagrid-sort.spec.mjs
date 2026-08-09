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
    // Engines serialize the computed content differently — Chromium
    // resolves attr() into one string ("↑1"), WebKit keeps separate
    // quoted parts ("↑" "1"), Firefox returns the unresolved specified
    // value ("↑" attr(data-sort-index)). Normalize away quotes and
    // whitespace and accept either the resolved ordinal or the attr()
    // wiring — the data-sort-index assertions above pin the ordinal.
    const norm = (s) => s.replace(/["'\s]/g, '');
    const c1 = norm(await indicator(name));
    const c2 = norm(await indicator(price));
    expect(c1.includes('↑1') || c1.includes('attr(')).toBe(true);
    expect(c2.includes('↑2') || c2.includes('attr(')).toBe(true);
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

  test('data-sortable="client" reorders the rendered page rows', async ({ page }) => {
    await page.evaluate(() => {
      document
        .querySelector('[data-testid="h-name"]')
        .setAttribute('data-sortable', 'client');
    });
    const names = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.hc-datagrid__body > tr')].map((r) =>
          r.children[1].textContent.trim(),
        ),
      );
    await page.getByTestId('h-name').click(); // ascending
    const asc = await names();
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    await page.getByTestId('h-name').click(); // descending
    const desc = await names();
    expect(desc).toEqual([...asc].reverse());
    // The instruction event still fires for observers.
    const last = await page.evaluate(() => window.__sorts.at(-1));
    expect(last).toMatchObject({ col: 'name', direction: 'desc' });
  });

  test('keyboard: focus + Enter sorts', async ({ page }) => {
    const name = page.getByTestId('h-name');
    await name.focus();
    await page.keyboard.press('Enter');
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
  });
});
