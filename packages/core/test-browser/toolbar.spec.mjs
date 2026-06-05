import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-toolbar — horizontal', () => {
  test('exposes role=toolbar and a single roving tab stop', async ({ page }) => {
    await expect(page.getByTestId('tb-h')).toHaveAttribute('role', 'toolbar');
    await expect(page.getByTestId('tb-h-bold')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('tb-h-underline')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByTestId('tb-h-save')).toHaveAttribute('tabindex', '-1');
  });

  test('ArrowRight moves focus, skips disabled, and wraps', async ({ page }) => {
    await page.getByTestId('tb-h-bold').focus();
    await page.keyboard.press('ArrowRight'); // skip disabled italic → underline
    await expect(page.getByTestId('tb-h-underline')).toBeFocused();
    await expect(page.getByTestId('tb-h-underline')).toHaveAttribute('tabindex', '0');

    await page.keyboard.press('ArrowRight'); // → link
    await expect(page.getByTestId('tb-h-link')).toBeFocused();

    await page.keyboard.press('ArrowRight'); // → save
    await expect(page.getByTestId('tb-h-save')).toBeFocused();

    await page.keyboard.press('ArrowRight'); // wrap → bold
    await expect(page.getByTestId('tb-h-bold')).toBeFocused();
  });

  test('ArrowLeft wraps backwards to the last control', async ({ page }) => {
    await page.getByTestId('tb-h-bold').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('tb-h-save')).toBeFocused();
  });

  test('Home / End jump to the first / last control', async ({ page }) => {
    await page.getByTestId('tb-h-underline').focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('tb-h-save')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('tb-h-bold')).toBeFocused();
  });

  test('the toolbar is a single Tab stop and focus returns where you left it', async ({ page }) => {
    // Move the roving stop to Underline, then Tab out and back.
    await page.getByTestId('tb-h-bold').focus();
    await page.keyboard.press('ArrowRight'); // → underline (the new stop)
    await page.keyboard.press('Tab'); // leaves the toolbar
    await expect(page.getByTestId('tb-h-underline')).not.toBeFocused();
    await page.keyboard.press('Shift+Tab'); // back into the toolbar
    await expect(page.getByTestId('tb-h-underline')).toBeFocused();
  });
});

test.describe('hc-toolbar — vertical', () => {
  test('navigates with Up / Down and ignores the horizontal arrows', async ({ page }) => {
    await expect(page.getByTestId('tb-v')).toHaveAttribute('aria-orientation', 'vertical');
    await page.getByTestId('tb-v-1').focus();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('tb-v-2')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('tb-v-1')).toBeFocused();

    await page.keyboard.press('ArrowUp'); // wrap → last
    await expect(page.getByTestId('tb-v-3')).toBeFocused();

    await page.keyboard.press('ArrowRight'); // ignored for a vertical toolbar
    await expect(page.getByTestId('tb-v-3')).toBeFocused();
  });
});

test.describe('hc-toolbar — chrome', () => {
  test('axe finds no violations in the toolbar section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-toolbar').analyze();
    expect(results.violations).toEqual([]);
  });
});
