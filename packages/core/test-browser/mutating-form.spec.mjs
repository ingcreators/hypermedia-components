import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed mutating-form recipe (#244) against real htmx:
// inline 4xx field errors, success redirect via HX-Redirect, the
// double-submit guard, and the confirmed destructive variant. Each
// assertion is a claim the recipe docs make. The /mock/form/* routes
// (serve.mjs) stand in for the server's mutation handler.

test.beforeEach(async ({ page }) => {
  await page.goto('/mutating-form.html');
});

test.describe('blessed mutating form', () => {
  test('a 4xx swaps the field-errors fragment and distributes it inline', async ({ page }) => {
    await page.getByTestId('submit-invalid').click();

    const email = page.getByTestId('email');
    const error = page.locator('#email-field .hc-field__error');
    await expect(error).toHaveText('email: already registered');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toBeFocused();
    await expect(page.locator('#email-field')).toHaveAttribute('data-invalid', 'true');
  });

  test('the submit button is disabled while the request is in flight, then re-enabled', async ({ page }) => {
    const submit = page.getByTestId('submit-invalid');
    await submit.click();
    // The mock delays 250ms; htmx adds the native disabled attribute for
    // the duration (double-submit guard).
    await expect(submit).toBeDisabled();
    // After the 422 settles, the guard is released.
    await expect(page.locator('#email-field .hc-field__error')).toHaveText(
      'email: already registered',
    );
    await expect(submit).toBeEnabled();
  });

  test('success sends HX-Redirect and the browser navigates to the destination', async ({ page }) => {
    await page.getByTestId('submit-valid').click();
    await page.waitForURL('**/mock/form/done');
    await expect(page.getByTestId('created-page')).toBeVisible();
  });

  test('the confirmed variant requests only after Confirm, then redirects', async ({ page }) => {
    await page.getByTestId('delete').click();
    // Gated: the confirm dialog opens; no navigation yet.
    const dialog = page.locator('dialog.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/mutating-form.html');

    await dialog.locator('[data-hc-confirm-ok]').click();
    await page.waitForURL('**/mock/form/done');
    await expect(page.getByTestId('created-page')).toBeVisible();
  });

  test('axe finds no violations, idle and with errors shown', async ({ page }) => {
    const idle = await new AxeBuilder({ page }).analyze();
    expect(idle.violations).toEqual([]);

    await page.getByTestId('submit-invalid').click();
    await expect(page.locator('#email-field .hc-field__error')).toHaveText(
      'email: already registered',
    );
    const withErrors = await new AxeBuilder({ page }).analyze();
    expect(withErrors.violations).toEqual([]);
  });
});
