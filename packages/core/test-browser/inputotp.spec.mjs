import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const slots = (page) => page.getByTestId('otp').locator('.hc-inputotp__slot');

test.describe('hc-inputotp', () => {
  test('renders one slot per data-length', async ({ page }) => {
    await expect(slots(page)).toHaveCount(6);
    await expect(page.getByTestId('otp-input')).toHaveAttribute('maxlength', '6');
  });

  test('typing fills the slots and advances the active caret', async ({ page }) => {
    await page.getByTestId('otp-input').click();
    await page.keyboard.type('123');
    await expect(slots(page).nth(0)).toHaveText('1');
    await expect(slots(page).nth(1)).toHaveText('2');
    await expect(slots(page).nth(2)).toHaveText('3');
    // The next (empty) slot is the active caret position.
    await expect(slots(page).nth(3)).toHaveAttribute('data-active', '');
  });

  test('strips characters outside the numeric pattern', async ({ page }) => {
    await page.getByTestId('otp-input').click();
    await page.keyboard.type('1a2b3');
    await expect(page.getByTestId('otp-input')).toHaveValue('123');
  });

  test('dispatches hc:otpcomplete when every slot is filled', async ({ page }) => {
    const done = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.querySelector('[data-testid="otp"]').addEventListener(
            'hc:otpcomplete',
            (e) => resolve(e.detail.value),
            { once: true },
          );
        }),
    );
    await page.getByTestId('otp-input').click();
    await page.keyboard.type('246813');
    expect(await done).toBe('246813');
  });

  test('aria-invalid paints the error border', async ({ page }) => {
    const color = await page.getByTestId('otp-invalid').locator('.hc-inputotp__slot').first()
      .evaluate((el) => getComputedStyle(el).borderTopColor);
    // semantic.color.error → red.600 = rgb(220, 38, 38).
    expect(color).toMatch(/rgba?\(\s*220,\s*38,\s*38/);
  });

  test('axe finds no violations in the inputotp section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-inputotp')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
