import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-input-group', () => {
  test('the inner input drops its own border; the group owns it', async ({ page }) => {
    const group = page.getByTestId('ig-search');
    const input = page.getByTestId('ig-search-input');
    await expect(group).toHaveCSS('border-top-width', '1px');
    await expect(input).toHaveCSS('border-top-width', '0px');
  });

  test('focusing the field shows one shared ring on the group (:focus-within)', async ({
    page,
  }) => {
    const group = page.getByTestId('ig-search');
    // No ring before focus.
    await expect(group).toHaveCSS('box-shadow', 'none');

    await page.getByTestId('ig-search-input').focus();
    const shadow = await group.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });

  test('the trailing button submits the form', async ({ page }) => {
    await page.getByTestId('ig-search-input').fill('widgets');
    await page.getByTestId('ig-search-submit').click();
    await expect(page.getByTestId('ig-search-result')).toHaveText('searched:widgets');
  });

  test('the password-reveal button toggles the field type and aria-pressed', async ({ page }) => {
    const input = page.getByTestId('ig-pw-input');
    const toggle = page.getByTestId('ig-pw-toggle');

    await expect(input).toHaveAttribute('type', 'password');
    // installPasswordToggle (auto-init) set the initial state.
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Show password');

    await toggle.click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Hide password');

    await toggle.click();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('axe finds no violations across the input-group examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-input-group').analyze();
    expect(results.violations).toEqual([]);
  });
});
