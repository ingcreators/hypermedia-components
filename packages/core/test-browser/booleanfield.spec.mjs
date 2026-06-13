import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed boolean-field pattern (#245) — the exact markup the
// checkbox docs bless for code generators ("As a boolean form field"):
// hc-field stanza + hidden `false` input + same-name checkbox `true`.
// Every assertion here is a claim the docs make about submission shape
// and field-errors wiring.

const entries = (form) => form.evaluate((f) => [...new FormData(f).entries()]);

test.beforeEach(async ({ page }) => {
  await page.goto('/booleanfield.html');
});

test.describe('blessed boolean field (hidden false + checkbox true)', () => {
  test('unchecked submits exactly active=false', async ({ page }) => {
    expect(await entries(page.getByTestId('form'))).toEqual([
      ['active', 'false'],
      ['notify', 'false'],
    ]);
  });

  test('checked submits false then true — the server takes the last value', async ({ page }) => {
    await page.getByTestId('checkbox').check();
    expect(await entries(page.getByTestId('form'))).toEqual([
      ['active', 'false'],
      ['active', 'true'],
      ['notify', 'false'],
    ]);
  });

  test('the switch variant serialises identically', async ({ page }) => {
    await page.getByTestId('switch').check();
    expect(await entries(page.getByTestId('form'))).toEqual([
      ['active', 'false'],
      ['notify', 'false'],
      ['notify', 'true'],
    ]);
  });

  test('a field error wires to the checkbox, not the hidden input', async ({ page }) => {
    await page.getByTestId('swap-errors').click();

    const checkbox = page.getByTestId('checkbox');
    const error = page.locator('#active-field .hc-field__error');

    await expect(error).toHaveText('Must be enabled');
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    await expect(checkbox).toBeFocused();
    await expect(page.locator('#active-field')).toHaveAttribute('data-invalid', 'true');
    const hiddenInvalid = await page
      .locator('input[type="hidden"][name="active"]')
      .getAttribute('aria-invalid');
    expect(hiddenInvalid).toBeNull();

    // Toggling the checkbox clears the server error.
    await checkbox.check();
    await expect(checkbox).not.toHaveAttribute('aria-invalid', 'true');
    await expect(error).toHaveText('');
  });

  test('axe finds no violations, idle and with an error shown', async ({ page }) => {
    const idle = await new AxeBuilder({ page }).analyze();
    expect(idle.violations).toEqual([]);

    await page.getByTestId('swap-errors').click();
    const withError = await new AxeBuilder({ page }).analyze();
    expect(withError.violations).toEqual([]);
  });
});
