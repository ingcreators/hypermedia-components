import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-navmenu', () => {
  test('wires aria-haspopup / aria-expanded on triggers', async ({ page }) => {
    const t = page.getByTestId('nm-products-t');
    await expect(t).toHaveAttribute('aria-haspopup', 'true');
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await expect(t).toHaveAttribute('aria-controls', 'nm-products');
  });

  test('hover opens the panel', async ({ page }) => {
    await page.getByTestId('nm-products-t').hover();
    await expect(page.getByTestId('nm-products')).toBeVisible();
    await expect(page.getByTestId('nm-products-t')).toHaveAttribute('aria-expanded', 'true');
  });

  test('ArrowDown opens the panel and focuses the first link', async ({ page }) => {
    await page.getByTestId('nm-products-t').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('nm-products')).toBeVisible();
    await expect(page.getByTestId('nm-analytics')).toBeFocused();
  });

  test('only one panel is open at a time', async ({ page }) => {
    await page.getByTestId('nm-products-t').hover();
    await expect(page.getByTestId('nm-products')).toBeVisible();
    await page.getByTestId('nm-company-t').hover();
    await expect(page.getByTestId('nm-company')).toBeVisible();
    await expect(page.getByTestId('nm-products')).toBeHidden();
  });

  test('Escape closes the panel and returns focus to the trigger', async ({ page }) => {
    await page.getByTestId('nm-products-t').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('nm-products')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nm-products')).toBeHidden();
    await expect(page.getByTestId('nm-products-t')).toBeFocused();
  });

  test('panel links are real anchors that navigate', async ({ page }) => {
    await page.getByTestId('nm-products-t').click();
    await expect(page.getByTestId('nm-products')).toBeVisible();
    await page.getByTestId('nm-analytics').click();
    await expect(page).toHaveURL(/#nm-analytics$/);
  });

  test('axe finds no violations (closed and open)', async ({ page }) => {
    let results = await new AxeBuilder({ page }).include('#section-navmenu').analyze();
    expect(results.violations).toEqual([]);

    await page.getByTestId('nm-products-t').click();
    await expect(page.getByTestId('nm-products')).toBeVisible();
    results = await new AxeBuilder({ page }).include('#section-navmenu').analyze();
    expect(results.violations).toEqual([]);
  });
});
