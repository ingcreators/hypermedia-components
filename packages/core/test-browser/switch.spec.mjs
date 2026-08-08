import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-switch', () => {
  test('Space toggles the underlying checkbox state', async ({ page }) => {
    const sw = page.getByTestId('sw-default');
    await expect(sw).not.toBeChecked();
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toBeChecked();
    await page.keyboard.press('Space');
    await expect(sw).not.toBeChecked();
  });

  test('clicking the wrapping label toggles the switch', async ({ page }) => {
    const sw = page.getByTestId('sw-default');
    await expect(sw).not.toBeChecked();
    await page.getByText('Notifications', { exact: true }).click();
    await expect(sw).toBeChecked();
  });

  test('checked switch fills the track with action-primary colour', async ({ page }) => {
    const sw = page.getByTestId('sw-checked');
    await expect(sw).toBeChecked();
    // Action-primary defaults to blue.600 = rgb(44, 96, 233).
    await expect
      .poll(() => cssColor(sw, 'backgroundColor'))
      .toBe('rgb(44, 96, 233)');
  });

  test('disabled state lowers opacity and blocks clicks', async ({ page }) => {
    const sw = page.getByTestId('sw-disabled');
    await expect(sw).toBeDisabled();
    const opacity = await sw.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeLessThan(1);
    await sw.click({ force: true });
    await expect(sw).not.toBeChecked();
  });

  test('data-variant="success" tints the checked track green', async ({ page }) => {
    const sw = page.getByTestId('sw-success');
    // semantic.color.success → green.600 = rgb(9, 131, 91).
    await expect
      .poll(() => cssColor(sw, 'backgroundColor'))
      .toBe('rgb(9, 131, 91)');
  });

  test('data-variant="warning" tints the checked track amber', async ({ page }) => {
    const sw = page.getByTestId('sw-warning');
    // semantic.color.warning → amber.500 = rgb(184, 118, 11).
    await expect
      .poll(() => cssColor(sw, 'backgroundColor'))
      .toBe('rgb(184, 118, 11)');
  });

  test('data-variant="error" tints the checked track red', async ({ page }) => {
    const sw = page.getByTestId('sw-error');
    // semantic.color.error → red.600 = rgb(206, 14, 24).
    await expect
      .poll(() => cssColor(sw, 'backgroundColor'))
      .toBe('rgb(206, 14, 24)');
  });

  test('data-size="sm" / "lg" render with different widths', async ({ page }) => {
    const sm = page.getByTestId('sw-sm');
    const lg = page.getByTestId('sw-lg');
    const smW = await sm.evaluate((el) => el.getBoundingClientRect().width);
    const lgW = await lg.evaluate((el) => el.getBoundingClientRect().width);
    expect(lgW).toBeGreaterThan(smW);
  });

  test('toggling fires the native change event (form integration)', async ({ page }) => {
    const sw = page.getByTestId('sw-default');
    await sw.evaluate((el) => {
      el.dataset.changes = '0';
      el.addEventListener('change', () => {
        el.dataset.changes = String(Number(el.dataset.changes) + 1);
      });
    });
    await sw.check();
    await sw.uncheck();
    const seen = await sw.evaluate((el) => el.dataset.changes);
    expect(seen).toBe('2');
  });

  test('axe finds no violations in the switch section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-switch')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
