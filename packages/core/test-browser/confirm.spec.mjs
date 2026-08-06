import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('confirm-action behavior', () => {
  test('shows the shared dialog with the configured message and labels', async ({ page }) => {
    await page.getByTestId('trigger-confirm').click();

    const dialog = page.locator('.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#hc-confirm-title')).toHaveText('Delete?');
    await expect(dialog.locator('#hc-confirm-message')).toHaveText('Delete item 42?');
    await expect(dialog.locator('[data-hc-confirm-ok]')).toHaveText('Delete');
    await expect(dialog.locator('[data-hc-confirm-cancel]')).toHaveText('Keep');

    // The OK button inherits the source's data-variant (error here).
    await expect(dialog.locator('[data-hc-confirm-ok]')).toHaveAttribute('data-variant', 'error');
  });

  test('focuses the Cancel button by default — safer for destructive actions', async ({ page }) => {
    await page.getByTestId('trigger-confirm').click();
    const cancel = page.locator('[data-hc-confirm-cancel]');
    await expect(cancel).toBeFocused();
  });

  test('closing the dialog returns focus to the trigger (cancel and confirm)', async ({ page }) => {
    // Native dialog.close() restores focus to the previously focused
    // element — the behavior adds no focus code; this pins the contract
    // documented on the confirm-action recipe page.
    const trigger = page.getByTestId('trigger-confirm');

    await trigger.click();
    await page.locator('[data-hc-confirm-cancel]').click();
    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.locator('[data-hc-confirm-ok]').click();
    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('dispatching "confirm" closes the dialog and fires `hc:confirmed` on the source', async ({ page }) => {
    const result = page.getByTestId('confirm-result');
    await expect(result).toHaveText('');

    await page.getByTestId('trigger-confirm').click();
    await page.locator('[data-hc-confirm-ok]').click();

    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    await expect(result).toHaveAttribute('data-confirmed', 'true');
    await expect(result).toHaveText('confirmed');
  });

  test('cancelling does NOT fire `hc:confirmed`', async ({ page }) => {
    const result = page.getByTestId('confirm-result');

    await page.getByTestId('trigger-confirm').click();
    await page.locator('[data-hc-confirm-cancel]').click();

    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    await expect(result).not.toHaveAttribute('data-confirmed', 'true');
  });

  test('Escape closes the dialog without firing `hc:confirmed`', async ({ page }) => {
    const result = page.getByTestId('confirm-result');

    await page.getByTestId('trigger-confirm').click();
    await page.keyboard.press('Escape');

    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    await expect(result).not.toHaveAttribute('data-confirmed', 'true');
  });

  test('reuses the shared dialog across repeated clicks', async ({ page }) => {
    await page.getByTestId('trigger-confirm').click();
    await page.locator('[data-hc-confirm-cancel]').click();
    await page.getByTestId('trigger-confirm').click();

    const dialogs = page.locator('.hc-confirm-dialog');
    await expect(dialogs).toHaveCount(1);
  });

  test('a confirmed submit button in a plain form submits it, with the button as submitter (#421)', async ({ page }) => {
    await page.getByTestId('trigger-confirm-form').click();
    await expect(page.locator('.hc-confirm-dialog')).toBeVisible();

    await page.locator('[data-hc-confirm-ok]').click();

    // The GET submission navigates; the button's own name/value pair is
    // present only when it was passed to requestSubmit() as submitter.
    await page.waitForURL(/deleted=42/);
    expect(page.url()).toContain('via=submitter');
  });

  test('cancelling submits nothing in a plain form', async ({ page }) => {
    await page.getByTestId('trigger-confirm-form').click();
    await page.locator('[data-hc-confirm-cancel]').click();

    await expect(page.locator('.hc-confirm-dialog')).toBeHidden();
    expect(new URL(page.url()).search).toBe('');
  });
});
