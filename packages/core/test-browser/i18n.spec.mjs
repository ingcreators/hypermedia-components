import { test, expect } from '@playwright/test';

// Proves the i18n catalog flows end-to-end through the real ESM bundle:
// the fixture calls setMessages() (re-exported from /hc.behaviors.js)
// before the bundle auto-inits, so behaviors render the translated
// strings they inject.
test.beforeEach(async ({ page }) => {
  await page.goto('/i18n.html');
});

test.describe('i18n via the behaviors bundle', () => {
  test('combobox empty marker uses the translated catalog string', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await input.fill('zzz');

    const empty = page.getByTestId('cb-listbox').locator('.hc-combobox__empty');
    await expect(empty).toHaveText('一致なし');
  });

  test('multicombobox tag remove button uses the interpolated translation', async ({ page }) => {
    // Python is pre-selected (aria-selected) so its tag renders on init.
    const remove = page
      .getByTestId('mc-tags')
      .locator('.hc-multicombobox__tag-remove');
    await expect(remove).toHaveAttribute('aria-label', 'Python を削除');
  });

  test('multicombobox empty marker uses the translated catalog string', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.focus();
    await input.fill('zzz');

    const empty = page.getByTestId('mc-listbox').locator('.hc-multicombobox__empty');
    await expect(empty).toHaveText('一致なし');
  });
});
