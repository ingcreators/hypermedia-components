import { test, expect } from '@playwright/test';

// Form-validation depth: the CSS `:user-invalid` hooks style controls after
// the user interacts (no JS), and installValidation() surfaces the native
// validationMessage into the field with ARIA wiring.
test.beforeEach(async ({ page }) => {
  await page.goto('/validation.html');
});

test.describe('form validation', () => {
  test('clicking the label focuses its control (native for/id association)', async ({ page }) => {
    await page.getByTestId('email-label').click();
    await expect(page.getByTestId('email')).toBeFocused();
  });

  test('a required field shows an asterisk on its label (CSS)', async ({ page }) => {
    const content = await page
      .getByTestId('email-label')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(content).toContain('*');

    // The optional field has no asterisk.
    const none = await page
      .getByTestId('nick-label')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(none === 'none' || none === '' || none === 'normal').toBe(true);
  });

  test('submitting with an empty required field blocks submit and shows the native message', async ({ page }) => {
    await page.getByTestId('submit').click();

    // Native validation blocked the submit handler.
    expect(await page.evaluate(() => window.__submitted)).toBeUndefined();

    const email = page.getByTestId('email');
    // CSS hook is active…
    expect(await email.evaluate((el) => el.matches(':user-invalid'))).toBe(true);
    // …and the behavior wired ARIA + the message.
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    const error = page.locator('.hc-field:has(#email) .hc-field__error');
    await expect(error).toHaveText(/.+/); // non-empty native message
    // aria-describedby points at the error and keeps the existing help id.
    const describedby = await email.getAttribute('aria-describedby');
    const errorId = await error.getAttribute('id');
    expect(describedby).toContain('email-help');
    expect(describedby).toContain(errorId);
  });

  test('fixing the field clears the error and lets the form submit', async ({ page }) => {
    await page.getByTestId('submit').click();
    const email = page.getByTestId('email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    await email.fill('person@example.com');
    // live clear on input
    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
    const error = page.locator('.hc-field:has(#email) .hc-field__error');
    await expect(error).toHaveText('');

    await page.getByTestId('submit').click();
    expect(await page.evaluate(() => window.__submitted)).toBe(true);
  });

  test('blur validates a single field without touching the others', async ({ page }) => {
    const email = page.getByTestId('email');
    await email.click();
    await email.fill('not-an-email');
    await page.getByTestId('nick').click(); // blur email

    await expect(email).toHaveAttribute('aria-invalid', 'true');
    // The untouched optional field stays clean.
    await expect(page.getByTestId('nick')).not.toHaveAttribute('aria-invalid', 'true');
  });
});
