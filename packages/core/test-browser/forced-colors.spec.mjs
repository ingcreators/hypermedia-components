import { test, expect } from '@playwright/test';

// Forced Colors / Windows High Contrast: the UA drops box-shadow and forces
// the system palette, so focus rings drawn with box-shadow vanish and state
// conveyed only by background tints becomes invisible. The hc.a11y layer
// re-expresses both with system colours. These tests emulate forced-colors
// and assert the indicators survive.
const outlineStyle = (loc) =>
  loc.evaluate((el) => getComputedStyle(el).outlineStyle);
const outlineWidth = (loc) =>
  loc.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/forced-colors.html');
});

test.describe('forced-colors / high-contrast', () => {
  test('forced-colors emulation is active (sanity)', async ({ page }) => {
    const matches = await page.evaluate(
      () => window.matchMedia('(forced-colors: active)').matches,
    );
    expect(matches).toBe(true);
  });

  test('focused input restores a real outline (box-shadow ring is dropped)', async ({ page }) => {
    const input = page.getByTestId('fc-input');
    await input.focus();
    expect(await outlineStyle(input)).toBe('solid');
    expect(await outlineWidth(input)).toBeGreaterThan(0);
  });

  test('checked checkbox opts out of forced colours so its fill stays visible', async ({ page }) => {
    const adjust = await page
      .getByTestId('fc-check')
      .evaluate((el) => getComputedStyle(el).forcedColorAdjust);
    expect(adjust).toBe('none');
  });

  test('checked switch opts out of forced colours', async ({ page }) => {
    const adjust = await page
      .getByTestId('fc-switch')
      .evaluate((el) => getComputedStyle(el).forcedColorAdjust);
    expect(adjust).toBe('none');
  });

  test('selected tab is marked with an outline', async ({ page }) => {
    expect(await outlineStyle(page.getByTestId('fc-tab-on'))).toBe('solid');
    expect(await outlineStyle(page.getByTestId('fc-tab-off'))).toBe('none');
  });

  test('current pagination page is marked with an outline', async ({ page }) => {
    expect(await outlineStyle(page.getByTestId('fc-page-on'))).toBe('solid');
    expect(await outlineStyle(page.getByTestId('fc-page-off'))).toBe('none');
  });

  test('selected combobox option is marked with an outline', async ({ page }) => {
    expect(await outlineStyle(page.getByTestId('fc-opt-on'))).toBe('solid');
    expect(await outlineStyle(page.getByTestId('fc-opt-off'))).toBe('none');
  });
});
