import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

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

  test('clicking a slot moves the caret into it (per-slot edit)', async ({ page }) => {
    const input = page.getByTestId('otp-input');
    await input.click();
    await page.keyboard.type('1234');
    // Click slot 1 — force past the overlaying input; the caret lands there.
    await slots(page).nth(1).click({ force: true });
    await expect(slots(page).nth(1)).toHaveAttribute('data-active', '');
    expect(await input.evaluate((el) => el.selectionStart)).toBe(1);
  });

  test('the active slot renders a blinking caret pseudo-element', async ({ page }) => {
    await page.getByTestId('otp-input').click();
    await page.keyboard.type('12');
    const active = slots(page).nth(2); // next empty → active
    await expect(active).toHaveAttribute('data-active', '');
    const width = await active.evaluate((el) => getComputedStyle(el, '::after').width);
    expect(parseFloat(width)).toBeGreaterThan(0);
    const anim = await active.evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(anim).not.toBe('none'); // blinks by default
  });

  test('prefers-reduced-motion stops the caret blink', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('otp-input').click();
    await page.keyboard.type('12');
    const anim = await slots(page)
      .nth(2)
      .evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(anim).toBe('none');
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

  const slotBorder = (page, id) =>
    cssColor(page.getByTestId(id).locator('.hc-inputotp__slot').first(), 'borderTopColor');

  test('aria-invalid paints the error border', async ({ page }) => {
    // semantic.color.error → red.600
    expect(await slotBorder(page, 'otp-invalid')).toBe('rgb(206, 14, 24)');
  });

  test('data-variant success / warning recolour the slot border', async ({ page }) => {
    expect(await slotBorder(page, 'otp-success')).toBe('rgb(9, 131, 91)'); // green.600
    expect(await slotBorder(page, 'otp-warning')).toBe('rgb(184, 118, 11)'); // amber.500 (semantic.color.warning)
  });

  test('axe finds no violations in the inputotp section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-inputotp')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
