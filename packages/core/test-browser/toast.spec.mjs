import { test, expect } from '@playwright/test';

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

  test('danger variant uses role="alert" / aria-live="assertive"', async ({ page }) => {
    await page.getByTestId('toast-danger').click();
    const toast = page.locator('.hc-toast').first();
    await expect(toast).toHaveAttribute('data-variant', 'danger');
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
});
