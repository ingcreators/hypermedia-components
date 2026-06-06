import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-menubar', () => {
  test('is a single tab stop with roving arrow-key navigation', async ({ page }) => {
    await expect(page.getByTestId('mbar-file')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('mbar-edit')).toHaveAttribute('tabindex', '-1');

    await page.getByTestId('mbar-file').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('mbar-edit')).toBeFocused();
    await expect(page.getByTestId('mbar-edit')).toHaveAttribute('tabindex', '0');

    await page.keyboard.press('Home');
    await expect(page.getByTestId('mbar-file')).toBeFocused();
  });

  test('installMenu wires aria-haspopup / aria-expanded on the top items', async ({ page }) => {
    const file = page.getByTestId('mbar-file');
    await expect(file).toHaveAttribute('aria-haspopup', 'menu');
    await expect(file).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking a top item opens its menu', async ({ page }) => {
    await page.getByTestId('mbar-file').click();
    await expect(page.getByTestId('mb-file')).toBeVisible();
    await expect(page.getByTestId('mbar-file')).toHaveAttribute('aria-expanded', 'true');
  });

  test('ArrowDown on a top item opens its menu and focuses the first item', async ({ page }) => {
    await page.getByTestId('mbar-file').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('mb-file')).toBeVisible();
    await expect(page.getByTestId('mb-file-new')).toBeFocused();
  });

  test('with a menu open, ArrowRight switches to the adjacent menu', async ({ page }) => {
    await page.getByTestId('mbar-file').click();
    await expect(page.getByTestId('mb-file')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('mb-edit')).toBeVisible();
    await expect(page.getByTestId('mb-file')).toBeHidden();
    await expect(page.getByTestId('mb-edit-undo')).toBeFocused();
  });

  test('Escape closes the open menu and returns focus to its top item', async ({ page }) => {
    await page.getByTestId('mbar-file').click();
    await expect(page.getByTestId('mb-file')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mb-file')).toBeHidden();
    await expect(page.getByTestId('mbar-file')).toBeFocused();
  });

  test('axe finds no violations (closed and open)', async ({ page }) => {
    let results = await new AxeBuilder({ page }).include('#section-menubar').analyze();
    expect(results.violations).toEqual([]);

    await page.getByTestId('mbar-file').click();
    await expect(page.getByTestId('mb-file')).toBeVisible();
    results = await new AxeBuilder({ page }).include('#section-menubar').analyze();
    expect(results.violations).toEqual([]);
  });
});
