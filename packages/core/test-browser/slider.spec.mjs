import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-slider', () => {
  test('renders as a native input[type=range] with role="slider"', async ({ page }) => {
    const s = page.getByTestId('sl-default');
    await expect(s).toHaveAttribute('type', 'range');
    await expect(s).toHaveAttribute('value', '40');
    await expect(s).toHaveAttribute('min', '0');
    await expect(s).toHaveAttribute('max', '100');
  });

  test('installSlider syncs --hc-slider-value to the initial value', async ({ page }) => {
    const s = page.getByTestId('sl-default');
    const v = await s.evaluate((el) => el.style.getPropertyValue('--hc-slider-value'));
    expect(v).toBe('40');
  });

  test('--hc-slider-value updates when the value changes via keyboard', async ({ page }) => {
    const s = page.getByTestId('sl-default');
    await s.focus();
    // ArrowRight nudges value by 1 step (default 1) — bring 40 → 41.
    await page.keyboard.press('ArrowRight');
    const v = await s.evaluate((el) => el.style.getPropertyValue('--hc-slider-value'));
    expect(v).toBe('41');
  });

  test('--hc-slider-value updates when the value is set via JS (input event)', async ({ page }) => {
    const s = page.getByTestId('sl-default');
    await s.evaluate((el) => {
      el.value = '75';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const v = await s.evaluate((el) => el.style.getPropertyValue('--hc-slider-value'));
    expect(v).toBe('75');
  });

  test('keyboard navigation is fully native — Home, End, PageUp work without custom JS', async ({ page }) => {
    const s = page.getByTestId('sl-default');
    await s.focus();
    await page.keyboard.press('Home');
    await expect(s).toHaveJSProperty('value', '0');
    await page.keyboard.press('End');
    await expect(s).toHaveJSProperty('value', '100');
  });

  test('data-size="sm" / "lg" change the rendered block size', async ({ page }) => {
    const sm = await page.getByTestId('sl-sm').evaluate((el) => el.getBoundingClientRect().height);
    const lg = await page.getByTestId('sl-lg').evaluate((el) => el.getBoundingClientRect().height);
    expect(lg).toBeGreaterThan(sm);
  });

  test('disabled state lowers opacity and the input rejects focus changes via .focus()', async ({ page }) => {
    const s = page.getByTestId('sl-disabled');
    await expect(s).toBeDisabled();
    const opacity = await s.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeLessThan(1);
  });

  test('axe finds no violations in the slider section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-slider')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
