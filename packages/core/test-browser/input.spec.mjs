import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const border = (page, id) => cssColor(page.getByTestId(id), 'borderTopColor');

test.describe('hc-input variants', () => {
  test('data-variant recolours the border (success / warning / error)', async ({ page }) => {
    // success → green.600
    expect(await border(page, 'in-success')).toBe('rgb(9, 131, 91)');
    // warning → amber.500 (semantic.color.warning)
    expect(await border(page, 'in-warning')).toBe('rgb(184, 118, 11)');
    // error → red.600
    expect(await border(page, 'in-error')).toBe('rgb(206, 14, 24)');
  });

  test('aria-invalid uses the same error border (the accessible hook)', async ({ page }) => {
    expect(await border(page, 'in-invalid')).toBe('rgb(206, 14, 24)');
  });

  test('the variant vocabulary also applies to <textarea>', async ({ page }) => {
    await expect(page.getByTestId('in-textarea')).toHaveJSProperty('tagName', 'TEXTAREA');
    expect(await border(page, 'in-textarea')).toBe('rgb(9, 131, 91)');
  });

  test('default input keeps the neutral border', async ({ page }) => {
    // semantic.color.border-strong → gray.500
    expect(await border(page, 'in-default')).toBe('rgb(107, 114, 128)');
  });

  test('axe finds no violations in the input section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-input').analyze();
    expect(results.violations).toEqual([]);
  });
});
