import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const border = (page, id) =>
  page.getByTestId(id).evaluate((el) => getComputedStyle(el).borderTopColor);

test.describe('hc-input variants', () => {
  test('data-variant recolours the border (success / warning / error)', async ({ page }) => {
    // success → green.600 = rgb(5, 150, 105)
    expect(await border(page, 'in-success')).toMatch(/rgba?\(\s*5,\s*150,\s*105/);
    // warning → amber.600 = rgb(217, 119, 6)
    expect(await border(page, 'in-warning')).toMatch(/rgba?\(\s*217,\s*119,\s*6/);
    // error → red.600 = rgb(220, 38, 38)
    expect(await border(page, 'in-error')).toMatch(/rgba?\(\s*220,\s*38,\s*38/);
  });

  test('aria-invalid uses the same error border (the accessible hook)', async ({ page }) => {
    expect(await border(page, 'in-invalid')).toMatch(/rgba?\(\s*220,\s*38,\s*38/);
  });

  test('the variant vocabulary also applies to <textarea>', async ({ page }) => {
    await expect(page.getByTestId('in-textarea')).toHaveJSProperty('tagName', 'TEXTAREA');
    expect(await border(page, 'in-textarea')).toMatch(/rgba?\(\s*5,\s*150,\s*105/);
  });

  test('default input keeps the neutral border', async ({ page }) => {
    // semantic.color.border → gray.300 = rgb(208, 213, 221)
    expect(await border(page, 'in-default')).toMatch(/rgba?\(\s*208,\s*213,\s*221/);
  });

  test('axe finds no violations in the input section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-input').analyze();
    expect(results.violations).toEqual([]);
  });
});
