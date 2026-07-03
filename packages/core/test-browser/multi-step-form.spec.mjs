import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed multi-step-form recipe against real htmx: whole-step
// swaps re-render the stepper, back (formnovalidate) escapes an invalid
// step and drafts round-trip losslessly, a 422 on next preserves the
// user's in-progress DOM values, and the final next completes via
// HX-Redirect. The /mock/wizard/* routes (serve.mjs) hold the draft.

test.beforeEach(async ({ page }) => {
  await page.request.get('/mock/wizard/reset');
  await page.goto('/multi-step-form.html');
});

const current = (page) => page.locator('.hc-stepper__step[aria-current="step"]');

test.describe('multi-step form', () => {
  test('next advances: the stepper re-renders with step 1 complete', async ({ page }) => {
    await page.getByTestId('email').fill('ada@example.com');
    await page.getByTestId('next').click();

    await expect(page.getByTestId('step-title')).toHaveText('Profile');
    await expect(current(page)).toContainText('Profile');
    const first = page.locator('.hc-stepper__step').first();
    await expect(first).toHaveAttribute('data-state', 'complete');
    await expect(first.locator('.hc-stepper__marker')).toHaveText('✓');
  });

  test('back escapes an invalid step (formnovalidate) and the draft round-trips losslessly', async ({ page }) => {
    await page.getByTestId('email').fill('ada@example.com');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('step-title')).toHaveText('Profile');

    // Leave the required name half-typed and go back — native
    // validation must NOT trap us here.
    await page.getByTestId('name').fill('Ad');
    await page.getByTestId('back').click();

    await expect(page.getByTestId('step-title')).toHaveText('Account');
    await expect(page.getByTestId('email')).toHaveValue('ada@example.com'); // draft round-trip

    await page.getByTestId('next').click();
    await expect(page.getByTestId('step-title')).toHaveText('Profile');
    await expect(page.getByTestId('name')).toHaveValue('Ad'); // the unvalidated draft came back
  });

  test('a 422 on next keeps the in-progress DOM values and stays on the step', async ({ page }) => {
    // Passes native type=email checks, fails the server's rule.
    await page.getByTestId('email').fill('ada@evil.example.net');
    await page.getByTestId('next').click();

    await expect(page.locator('#wizard-errors .hc-alert')).toContainText('email');
    await expect(page.getByTestId('email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('email')).toHaveValue('ada@evil.example.net'); // not re-rendered
    await expect(page.getByTestId('step-title')).toHaveText('Account');
  });

  test('the final next completes via HX-Redirect after the review step', async ({ page }) => {
    await page.getByTestId('email').fill('ada@example.com');
    await page.getByTestId('next').click();
    await page.getByTestId('name').fill('Ada Lovelace');
    await page.getByTestId('next').click();

    await expect(page.getByTestId('step-title')).toHaveText('Review');
    await expect(page.getByTestId('review')).toContainText('ada@example.com');
    await expect(page.getByTestId('review')).toContainText('Ada Lovelace');

    await page.getByTestId('next').click();
    await page.waitForURL('**/mock/wizard/done');
    await expect(page.getByTestId('done-page')).toBeVisible();
  });

  test('axe finds no violations on every step', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByTestId('email').fill('ada@example.com');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('step-title')).toHaveText('Profile');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByTestId('name').fill('Ada');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('step-title')).toHaveText('Review');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
