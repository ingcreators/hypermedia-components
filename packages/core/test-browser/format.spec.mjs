import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/format.html');
});

test.describe('installFormat', () => {
  test('groups on blur and shows the raw value on focus', async ({ page }) => {
    const amount = page.getByTestId('amount');
    await amount.fill('1234567');
    await amount.blur();
    await expect(amount).toHaveValue('1,234,567');
    await amount.focus();
    await expect(amount).toHaveValue('1234567');
    await amount.blur();
    await expect(amount).toHaveValue('1,234,567');
  });

  test('normalizes fullwidth digits on blur', async ({ page }) => {
    const amount = page.getByTestId('amount');
    await amount.fill('１２３４５');
    await amount.blur();
    await expect(amount).toHaveValue('12,345');
  });

  test('new FormData(form) carries raw canonical values', async ({ page }) => {
    const amount = page.getByTestId('amount');
    await amount.fill('1234567');
    await amount.blur();
    await page.getByTestId('sku').fill('ＡＢ１２');
    await page.getByTestId('sku').blur();
    await page.getByTestId('snapshot').click();
    await expect(page.getByTestId('wire')).toHaveText('amount=1234567&sku=AB12');
    // Display stays grouped — only the wire value is raw.
    await expect(amount).toHaveValue('1,234,567');
  });

  test('no axe violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
