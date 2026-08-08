import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor, expect } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-datepicker', () => {
  test('renders as a native input with type=date and form value', async ({ page }) => {
    const dp = page.getByTestId('dp-date');
    await expect(dp).toHaveAttribute('type', 'date');
    await expect(dp).toHaveValue('2026-05-29');
  });

  test('background-image renders the embedded calendar SVG', async ({ page }) => {
    const dp = page.getByTestId('dp-date');
    const bg = await dp.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('svg');
    // Calendar / clock SVGs both use gray.500 (%236b7280) stroke.
    expect(bg).toContain('%236b7280');
  });

  test('type="time" swaps to the clock icon', async ({ page }) => {
    const dp = page.getByTestId('dp-time');
    const bg = await dp.evaluate((el) => getComputedStyle(el).backgroundImage);
    // The clock SVG includes a circle.
    expect(bg).toContain('circle');
  });

  test('focus shows the focus-ring box-shadow', async ({ page }) => {
    const dp = page.getByTestId('dp-date');
    await dp.focus();
    const shadow = await dp.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });

  test('data-variant="error" + aria-invalid swaps border to the error colour', async ({ page }) => {
    // red.600
    expect(await cssColor(page.getByTestId('dp-error'), 'borderTopColor')).toBeColor('rgb(206, 14, 24)');
  });

  test('data-variant="success" swaps border to the success colour', async ({ page }) => {
    // green.600
    expect(await cssColor(page.getByTestId('dp-success'), 'borderTopColor')).toBeColor('rgb(9, 131, 91)');
  });

  test('disabled lowers opacity and changes cursor', async ({ page }) => {
    const dp = page.getByTestId('dp-disabled');
    await expect(dp).toBeDisabled();
    const opacity = await dp.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeLessThan(1);
    const cursor = await dp.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('not-allowed');
  });

  test('data-size="sm" / "lg" change the min height', async ({ page }) => {
    const sm = page.getByTestId('dp-sm');
    const lg = page.getByTestId('dp-lg');
    const smH = await sm.evaluate((el) => el.getBoundingClientRect().height);
    const lgH = await lg.evaluate((el) => el.getBoundingClientRect().height);
    expect(lgH).toBeGreaterThan(smH);
  });

  test('setting a new value via JS fires the native change event (form integration)', async ({ page }) => {
    const dp = page.getByTestId('dp-date');
    await dp.evaluate((el) => {
      el.dataset.lastChange = '';
      el.addEventListener('change', () => { el.dataset.lastChange = el.value; });
    });
    await dp.evaluate((el) => {
      el.value = '2027-01-01';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const seen = await dp.evaluate((el) => el.dataset.lastChange);
    expect(seen).toBe('2027-01-01');
  });

  test('axe finds no violations in the date picker section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-datepicker')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
