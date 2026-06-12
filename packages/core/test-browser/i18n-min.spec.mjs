import { test, expect } from '@playwright/test';

// Regression for #216: hc.min.js and hc.behaviors.min.js each inline a
// copy of the i18n module. The fixture calls setMessages() through the
// main-entry bundle (/hc.min.js) before the auto-init bundle
// (/hc.behaviors.min.js) installs — behaviors must render the overrides,
// i.e. the catalog state is shared across bundle copies, not duplicated.
test.beforeEach(async ({ page }) => {
  await page.goto('/i18n-min.html');
});

test.describe('i18n across the min bundles', () => {
  test('confirm dialog renders the catalog override set via hc.min.js', async ({ page }) => {
    await page.getByTestId('confirm-btn').click();

    const dialog = page.locator('.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#hc-confirm-title')).toHaveText('確認');
    await expect(dialog.locator('[data-hc-confirm-cancel]')).toHaveText('キャンセル');
    await expect(dialog.locator('[data-hc-confirm-ok]')).toHaveText('実行');
  });

  test('combobox empty marker renders the catalog override set via hc.min.js', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await input.fill('zzz');

    const empty = page.getByTestId('cb-listbox').locator('.hc-combobox__empty');
    await expect(empty).toHaveText('一致なし');
  });
});
