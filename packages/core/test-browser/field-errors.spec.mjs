import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// installFieldErrors: a server-sent validation fragment (the canonical
// field-errors recipe shape) swapped in next to a form is distributed to
// the fields it names, with the same ARIA wiring installValidation uses.
test.beforeEach(async ({ page }) => {
  await page.goto('/field-errors.html');
});

test.describe('field-errors behavior', () => {
  test('distributes a swapped-in fragment to the matching field with ARIA wiring', async ({ page }) => {
    await page.getByTestId('swap-errors').click();

    const email = page.getByTestId('email');
    const error = page.locator('#email-field .hc-field__error');

    await expect(error).toHaveText('email: duplicate');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    const describedby = await email.getAttribute('aria-describedby');
    expect(describedby).toContain('email-help');
    expect(describedby).toContain(await error.getAttribute('id'));
    await expect(page.locator('#email-field')).toHaveAttribute('data-invalid', 'true');

    // The distributed item is hidden in the summary; the unknown-field
    // item stays visible; the alert is stamped partial.
    const items = page.locator('.hc-alert__error');
    await expect(items.nth(0)).toBeHidden();
    await expect(items.nth(1)).toBeVisible();
    await expect(page.getByTestId('alert')).toHaveAttribute('data-distributed', 'partial');
  });

  test('focuses the first invalid control', async ({ page }) => {
    await page.getByTestId('swap-errors').click();
    await expect(page.getByTestId('email')).toBeFocused();
  });

  test('editing the field clears the server error', async ({ page }) => {
    await page.getByTestId('swap-errors').click();
    const email = page.getByTestId('email');
    await email.fill('other@example.com');

    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#email-field .hc-field__error')).toHaveText('');
    // The untouched field stays clean.
    await expect(page.getByTestId('name')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('resubmitting clears all server errors', async ({ page }) => {
    await page.getByTestId('swap-errors').click();
    await expect(page.getByTestId('email')).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('email')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('axe finds no violations with the error fragment distributed', async ({ page }) => {
    await page.getByTestId('swap-errors').click();
    await expect(page.locator('#email-field .hc-field__error')).toHaveText('email: duplicate');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
