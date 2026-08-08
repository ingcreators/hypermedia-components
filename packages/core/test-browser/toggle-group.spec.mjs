import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-toggle-group — single (exclusive)', () => {
  test('exposes radiogroup / radio roles with exactly one checked', async ({ page }) => {
    await expect(page.getByTestId('tg-single')).toHaveAttribute('role', 'radiogroup');
    const radios = page.getByTestId('tg-single').getByRole('radio');
    await expect(radios).toHaveCount(4);
    await expect(page.getByTestId('tg-s-left')).toHaveAttribute('aria-checked', 'true');
  });

  test('parks a roving tabindex on the checked option', async ({ page }) => {
    await expect(page.getByTestId('tg-s-left')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('tg-s-center')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByTestId('tg-s-justify')).toHaveAttribute('tabindex', '-1');
  });

  test('clicking selects exclusively', async ({ page }) => {
    await page.getByTestId('tg-s-center').click();
    await expect(page.getByTestId('tg-s-center')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('tg-s-left')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('tg-s-center')).toHaveAttribute('tabindex', '0');
  });

  test('ArrowRight moves focus and selection together, skipping disabled', async ({ page }) => {
    await page.getByTestId('tg-s-left').focus();
    await page.keyboard.press('ArrowRight'); // → center
    await expect(page.getByTestId('tg-s-center')).toBeFocused();
    await expect(page.getByTestId('tg-s-center')).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('ArrowRight'); // skip disabled right → justify
    await expect(page.getByTestId('tg-s-justify')).toBeFocused();
    await expect(page.getByTestId('tg-s-justify')).toHaveAttribute('aria-checked', 'true');
  });

  test('the selected option paints the accent border', async ({ page }) => {
    // on-border → action.primary.border → blue.600.
    expect(await cssColor(page.getByTestId('tg-s-left'), 'borderTopColor'))
      .toBe('rgb(37, 99, 235)');
  });
});

test.describe('hc-toggle-group — multiple', () => {
  test('exposes group role + aria-pressed and toggles on click', async ({ page }) => {
    await expect(page.getByTestId('tg-multi')).toHaveAttribute('role', 'group');
    await page.getByTestId('tg-m-bold').click();
    await expect(page.getByTestId('tg-m-bold')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('tg-m-bold').click();
    await expect(page.getByTestId('tg-m-bold')).toHaveAttribute('aria-pressed', 'false');
  });

  test('Space toggles the focused button (native button key handling)', async ({ page }) => {
    await page.getByTestId('tg-m-underline').focus();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('tg-m-underline')).toHaveAttribute('aria-pressed', 'true');
  });

  test('ArrowRight moves focus only — it does not toggle', async ({ page }) => {
    await page.getByTestId('tg-m-bold').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('tg-m-italic')).toBeFocused();
    // italic was pre-pressed; arrow navigation must not have changed it.
    await expect(page.getByTestId('tg-m-italic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tg-m-bold')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('hc-toggle-group — chrome', () => {
  test('data-size sm renders shorter buttons than lg', async ({ page }) => {
    const sm = await page.getByTestId('tg-sm').locator('.hc-toggle').first()
      .evaluate((el) => el.getBoundingClientRect().height);
    const lg = await page.getByTestId('tg-lg').locator('.hc-toggle').first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(lg).toBeGreaterThan(sm);
  });

  test('axe finds no violations in the toggle-group section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-toggle-group')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
