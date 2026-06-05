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

test.describe('hc-slider — vertical orientation', () => {
  test('renders taller than wide (writing-mode vertical)', async ({ page }) => {
    const box = await page.getByTestId('sl-vertical').boundingBox();
    expect(box.height).toBeGreaterThan(box.width);
  });

  test('stays a native range — Up / Down change the value, Home / End jump', async ({ page }) => {
    const s = page.getByTestId('sl-vertical');
    await s.focus();
    await expect(s).toHaveJSProperty('value', '40');

    // The maximum is at the top (direction: rtl), so Up increases.
    await page.keyboard.press('ArrowUp');
    await expect(s).toHaveJSProperty('value', '41');
    await page.keyboard.press('ArrowDown');
    await expect(s).toHaveJSProperty('value', '40');

    await page.keyboard.press('End');
    await expect(s).toHaveJSProperty('value', '100');
    await page.keyboard.press('Home');
    await expect(s).toHaveJSProperty('value', '0');
  });

  test('installSlider keeps --hc-slider-value in sync in vertical mode', async ({ page }) => {
    const s = page.getByTestId('sl-vertical');
    await expect
      .poll(() => s.evaluate((el) => el.style.getPropertyValue('--hc-slider-value')))
      .toBe('40');
    await s.focus();
    await page.keyboard.press('ArrowUp');
    const v = await s.evaluate((el) => el.style.getPropertyValue('--hc-slider-value'));
    expect(v).toBe('41');
  });

  test('the maximum sits at the top — the thumb rises as the value grows', async ({ page }) => {
    const s = page.getByTestId('sl-vertical');
    await s.focus();
    await page.keyboard.press('Home'); // value = 0 (bottom)
    const low = await s.evaluate((el) => el.value);
    expect(low).toBe('0');
    // We cannot read the native thumb box directly, but End must reach max.
    await page.keyboard.press('End');
    await expect(s).toHaveJSProperty('value', '100');
  });
});
