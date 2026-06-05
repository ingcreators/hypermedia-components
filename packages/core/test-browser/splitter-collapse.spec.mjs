import { test, expect } from '@playwright/test';

// data-collapsible: double-click / Enter on the handle toggles the primary
// pane between collapsed (0%) and its last open size. data-persist mirrors
// the position into localStorage so it survives a reload.
test.beforeEach(async ({ page }) => {
  await page.goto('/splitter-collapse.html');
});

const primaryWidth = async (page) =>
  (await page.getByTestId('sp-primary').boundingBox()).width;

test.describe('hc-splitter collapse', () => {
  test('double-click collapses the primary pane and restores it', async ({ page }) => {
    const sp = page.getByTestId('sp');
    const handle = page.getByTestId('sp-handle');
    const open = await primaryWidth(page);
    expect(open).toBeGreaterThan(0);

    await handle.dblclick();
    await expect(sp).toHaveAttribute('data-collapsed', '');
    expect(await primaryWidth(page)).toBeLessThan(open / 2);

    await handle.dblclick();
    await expect(sp).not.toHaveAttribute('data-collapsed', '');
    expect(await primaryWidth(page)).toBeGreaterThan(open / 2);
  });

  test('Enter on the handle toggles collapse', async ({ page }) => {
    const sp = page.getByTestId('sp');
    await page.getByTestId('sp-handle').focus();

    await page.keyboard.press('Enter');
    await expect(sp).toHaveAttribute('data-collapsed', '');

    await page.keyboard.press('Enter');
    await expect(sp).not.toHaveAttribute('data-collapsed', '');
  });
});

test.describe('hc-splitter persistence', () => {
  test('restores the resized position from localStorage after reload', async ({ page }) => {
    const handle = page.getByTestId('sp-handle');
    await handle.focus();
    await page.keyboard.press('ArrowRight'); // 50 → 55
    await expect(handle).toHaveAttribute('aria-valuenow', '55');

    await page.reload();

    await expect(page.getByTestId('sp-handle')).toHaveAttribute('aria-valuenow', '55');
  });

  test('restores a collapsed state after reload', async ({ page }) => {
    await page.getByTestId('sp-handle').dblclick();
    await expect(page.getByTestId('sp')).toHaveAttribute('data-collapsed', '');

    await page.reload();

    await expect(page.getByTestId('sp')).toHaveAttribute('data-collapsed', '');
  });
});
