import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('toast behavior', () => {
  test('lazily creates a region and renders the success variant', async ({ page }) => {
    await expect(page.locator('[data-hc-toast-region]')).toHaveCount(0);

    await page.getByTestId('toast-success').click();

    const region = page.locator('[data-hc-toast-region]');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAttribute('aria-label', 'Notifications');

    const toast = region.locator('.hc-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-variant', 'success');
    await expect(toast).toHaveAttribute('role', 'status');
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expect(toast.locator('.hc-toast__title')).toHaveText('Saved');
    await expect(toast.locator('.hc-toast__body')).toHaveText('Changes saved.');
  });

  test('error variant uses role="alert" / aria-live="assertive"', async ({ page }) => {
    await page.getByTestId('toast-error').click();
    const toast = page.locator('.hc-toast').first();
    await expect(toast).toHaveAttribute('data-variant', 'error');
    await expect(toast).toHaveAttribute('role', 'alert');
    await expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  test('auto-dismisses after the configured duration (200ms)', async ({ page }) => {
    await page.getByTestId('toast-quick').click();
    const toast = page.locator('.hc-toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveCount(0, { timeout: 1_500 });
  });

  test('duration=0 keeps the toast forever (sticky)', async ({ page }) => {
    await page.getByTestId('toast-sticky').click();
    const toast = page.locator('.hc-toast');
    await expect(toast).toHaveCount(1);
    // Still present after a moment.
    await page.waitForTimeout(800);
    await expect(toast).toHaveCount(1);
  });

  test('multiple toasts stack inside the region', async ({ page }) => {
    await page.getByTestId('toast-sticky').click();
    await page.getByTestId('toast-sticky').click();
    await page.getByTestId('toast-sticky').click();

    const region = page.locator('[data-hc-toast-region]');
    const toasts = region.locator('.hc-toast');
    await expect(toasts).toHaveCount(3);
  });

  test('the action button fires a bubbling event and dismisses the toast', async ({ page }) => {
    await page.getByTestId('toast-undo').click();
    const toast = page.locator('.hc-toast');
    const action = toast.locator('.hc-toast__action');
    await expect(action).toHaveText('Undo');

    await action.click();
    await expect(page.getByTestId('toast-undo-fired')).toHaveText('undone'); // hc:undo caught
    await expect(toast).toHaveCount(0); // dismissed after the action
  });

  test('Escape dismisses the toast that contains the focus', async ({ page }) => {
    await page.getByTestId('toast-undo').click(); // sticky toast with an action button
    const toast = page.locator('.hc-toast');
    await expect(toast).toHaveCount(1);

    await toast.locator('.hc-toast__action').focus();
    await page.keyboard.press('Escape');
    await expect(toast).toHaveCount(0);
    // The action event did NOT fire — Escape dismisses without acting.
    await expect(page.getByTestId('toast-undo-fired')).not.toHaveText('undone');
  });

  test('a second toast with the same id updates in place (no duplicate)', async ({ page }) => {
    await page.getByTestId('toast-start').click();
    const toast = page.locator('.hc-toast');
    await expect(toast).toHaveCount(1);
    await expect(toast.locator('.hc-toast__body')).toHaveText('Saving…');

    await page.getByTestId('toast-finish').click();
    await expect(toast).toHaveCount(1); // updated, not stacked
    await expect(toast.locator('.hc-toast__body')).toHaveText('Saved!');
    await expect(toast).toHaveAttribute('data-variant', 'success');
  });

  test('axe finds no violations with a toast (and action) showing', async ({ page }) => {
    await page.getByTestId('toast-undo').click();
    await expect(page.locator('.hc-toast')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).include('[data-hc-toast-region]').analyze();
    expect(results.violations).toEqual([]);
  });
});
