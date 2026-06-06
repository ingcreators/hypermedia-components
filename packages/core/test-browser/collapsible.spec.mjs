import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-collapsible', () => {
  test('starts closed with its content hidden', async ({ page }) => {
    await expect(page.getByTestId('collapsible')).toHaveJSProperty('open', false);
    await expect(page.getByTestId('collapsible-text')).toBeHidden();
  });

  test('clicking the summary opens and closes the region', async ({ page }) => {
    const details = page.getByTestId('collapsible');
    const trigger = page.getByTestId('collapsible-trigger');
    const text = page.getByTestId('collapsible-text');

    await trigger.click();
    await expect(details).toHaveJSProperty('open', true);
    await expect(text).toBeVisible();

    await trigger.click();
    await expect(details).toHaveJSProperty('open', false);
    await expect(text).toBeHidden();
  });

  test('the summary is keyboard operable (Enter toggles)', async ({ page }) => {
    const details = page.getByTestId('collapsible');
    await page.getByTestId('collapsible-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveJSProperty('open', true);
  });

  test('the chevron rotates when open', async ({ page }) => {
    const icon = page.getByTestId('collapsible-trigger').locator('.hc-collapsible__icon');
    await expect(icon).toHaveCSS('rotate', 'none');
    await page.getByTestId('collapsible-trigger').click();
    await expect(icon).toHaveCSS('rotate', '180deg');
  });

  test('axe finds no violations across the collapsible example', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-collapsible').analyze();
    expect(results.violations).toEqual([]);
  });
});
