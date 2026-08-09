import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-group.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

test.describe('hc-datagrid — grouped rows', () => {
  test('a pre-collapsed group starts with hidden members and a ▸ caret', async ({ page }) => {
    await expect(page.getByTestId('g-fruit-cell')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('r-lemon')).toBeHidden();
    const caret = await page
      .getByTestId('g-citrus-cell')
      .evaluate((el) => getComputedStyle(el, '::before').content);
    expect(caret).toContain('▸');
  });

  test('clicking a heading collapses its group and emits hc:datagridgrouptoggle', async ({ page }) => {
    await page.evaluate(() => {
      window.__toggles = [];
      document.querySelector('.hc-datagrid').addEventListener(
        'hc:datagridgrouptoggle',
        (e) => window.__toggles.push(e.detail.expanded),
      );
    });
    await page.getByTestId('g-fruit-cell').click();
    await expect(page.getByTestId('g-fruit-cell')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('r-apple')).toBeHidden();
    await expect(page.getByTestId('g-citrus')).toBeHidden();
    // The next level-1 group is untouched.
    await expect(page.getByTestId('r-hammer')).toBeVisible();
    expect(await page.evaluate(() => window.__toggles)).toEqual([false]);

    // Re-expand: the collapsed sub-group stays collapsed.
    await page.getByTestId('g-fruit-cell').click();
    await expect(page.getByTestId('r-apple')).toBeVisible();
    await expect(page.getByTestId('g-citrus')).toBeVisible();
    await expect(page.getByTestId('r-lemon')).toBeHidden();
  });

  test('Enter on the focused heading toggles; arrows skip hidden rows', async ({ page }) => {
    await page.getByTestId('g-fruit-cell').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('g-fruit-cell')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowDown');
    const activeRow = await page.evaluate(
      () =>
        document
          .querySelector('.hc-datagrid__cell[data-active]')
          ?.closest('.hc-datagrid__row')
          ?.getAttribute('data-testid') ?? null,
    );
    expect(activeRow).toBe('g-tools');
  });

  test('select-all counts data rows only — and survives collapsing', async ({ page }) => {
    await page.evaluate(() => {
      window.__sel = [];
      document.querySelector('.hc-datagrid').addEventListener(
        'hc:datagridselectionchange',
        (e) => window.__sel.push(e.detail),
      );
    });
    await page.getByTestId('select-all').check();
    expect(await page.evaluate(() => window.__sel.at(-1))).toEqual({
      selected: 3,
      total: 3,
    });
    // Collapsing a group changes visibility, never the selection.
    await page.getByTestId('g-fruit-cell').click();
    expect(await page.evaluate(() => window.__sel.at(-1))).toEqual({
      selected: 3,
      total: 3,
    });
  });

  test('axe finds no violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('.hc-datagrid')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
