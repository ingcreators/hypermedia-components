import { test, expect } from '@playwright/test';

// installRemoteDialog opens a <dialog> that htmx swaps into a host marked
// with data-hc-remote-dialog-root. The fixture simulates the htmx swap
// (inject markup + dispatch htmx:afterSwap) — the behavior never fetches,
// so this covers the full browser path without a network round-trip.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('installRemoteDialog', () => {
  test('opens the swapped-in dialog modally on htmx:afterSwap', async ({ page }) => {
    const dialog = page.getByTestId('rd-dialog');
    await expect(dialog).toHaveCount(0);

    await page.getByTestId('rd-open').click();

    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open', '');
    const modal = await dialog.evaluate((el) => el.matches(':modal'));
    expect(modal).toBe(true);
  });

  test('leaves a swap into an unmarked host closed', async ({ page }) => {
    await page.getByTestId('rd-open-unmarked').click();

    // The dialog markup is present but the behavior must not open it,
    // because the host lacks data-hc-remote-dialog-root.
    const dialog = page.getByTestId('rd-dialog');
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute('open', '');
  });

  test('reopens after the dialog is closed (idempotent across swaps)', async ({ page }) => {
    const dialog = page.getByTestId('rd-dialog');

    await page.getByTestId('rd-open').click();
    await expect(dialog).toBeVisible();

    await page.getByTestId('rd-close').click();
    await expect(dialog).toBeHidden();

    // A second swap into the same root opens the fresh dialog again.
    await page.getByTestId('rd-open').click();
    await expect(page.getByTestId('rd-dialog')).toBeVisible();
  });
});
