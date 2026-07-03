import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed undo-delete recipe against real htmx: the tombstone
// preserves the row's position, the toast's Undo button fires the
// server-generated pairing event, pairing keys don't cross between two
// pending undos, and restore-after-expiry follows the 200-with-truth
// shape. The /mock/items/* routes (serve.mjs) stand in for the server's
// soft-delete handler.

test.beforeEach(async ({ page }) => {
  await page.goto('/undo-delete.html');
});

const names = (page) =>
  page.getByTestId('rows').locator('tr:not([hidden]) td:first-child').allTextContents();

test.describe('undo delete', () => {
  test('delete swaps in the tombstone and shows the undo toast', async ({ page }) => {
    await page.getByTestId('delete-2').click();

    await expect(page.getByTestId('row-2')).toBeHidden();
    expect(await names(page)).toEqual(['Anvil', 'Tornado seeds']);

    const toast = page.locator('.hc-toast');
    await expect(toast).toContainText('"Rocket skates" deleted');
    await expect(toast.locator('.hc-toast__action')).toHaveText('Undo');

    // The tombstone kept the slot: hidden, wired for restore.
    const tombstone = page.locator('#undo-item-2');
    await expect(tombstone).toHaveAttribute('data-hx-trigger', 'item-2:restore from:body');
  });

  test('Undo restores the row at its original position and updates the toast in place', async ({ page }) => {
    await page.getByTestId('delete-2').click();
    await expect(page.locator('.hc-toast__action')).toHaveText('Undo');

    await page.locator('.hc-toast__action').click();

    await expect(page.getByTestId('row-2')).toBeVisible();
    expect(await names(page)).toEqual(['Anvil', 'Rocket skates', 'Tornado seeds']); // original order

    const toast = page.locator('.hc-toast');
    await expect(toast).toContainText('"Rocket skates" restored');
    await expect(toast.locator('.hc-toast__action')).toHaveCount(0); // Undo gone
  });

  test('two pending undos: undoing the second restores only that row', async ({ page }) => {
    await page.getByTestId('delete-1').click();
    await expect(page.locator('.hc-toast')).toHaveCount(1);
    await page.getByTestId('delete-2').click();
    await expect(page.locator('.hc-toast')).toHaveCount(2);
    expect(await names(page)).toEqual(['Tornado seeds']);

    // The newest toast (item 2) sits in the region alongside item 1's.
    const toast2 = page.locator('.hc-toast', { hasText: 'Rocket skates' });
    await toast2.locator('.hc-toast__action').click();

    await expect(page.getByTestId('row-2')).toBeVisible();
    expect(await names(page)).toEqual(['Rocket skates', 'Tornado seeds']); // item 1 stays deleted
    await expect(page.getByTestId('row-1')).toBeHidden();
  });

  test('restore after the grace period: 200 with the truth — row stays gone, error toast', async ({ page }) => {
    await page.getByTestId('delete-3').click(); // item 3 is flagged expired in the mock
    await page.locator('.hc-toast__action').click();

    const toast = page.locator('.hc-toast');
    await expect(toast).toContainText('permanently deleted');
    await expect(page.getByTestId('row-3')).toBeHidden();
    expect(await names(page)).toEqual(['Anvil', 'Rocket skates']);

    // The page stays functional — another delete + undo still works.
    await page.getByTestId('delete-1').click();
    await page.locator('.hc-toast__action').last().click();
    await expect(page.getByTestId('row-1')).toBeVisible();
  });

  test('axe finds no violations with the undo toast visible', async ({ page }) => {
    await page.getByTestId('delete-1').click();
    await expect(page.locator('.hc-toast__action')).toHaveText('Undo');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
