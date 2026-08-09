import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-prefs.html');
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

test.describe('datagrid-prefs recipe', () => {
  test('a keyboard resize mirrors the width and autosaves it', async ({ page }) => {
    const handle = page.getByTestId('h-name').locator('.hc-datagrid__resizer');
    await handle.focus();
    await page.keyboard.press('ArrowRight'); // +8px from 160
    await expect(page.getByTestId('w-name')).toHaveValue('168');
    // The debounced event-triggered POST serialized the fresh value.
    await expect(page.getByTestId('status')).toContainText('Saved — name 168px');
  });

  test('a drag resize saves the final width once settled', async ({ page }) => {
    const handle = page.getByTestId('h-name').locator('.hc-datagrid__resizer');
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2);
    await page.mouse.up();
    const value = await page.getByTestId('w-name').inputValue();
    expect(Number(value)).toBeGreaterThan(160);
    await expect(page.getByTestId('status')).toContainText(`name ${value}px`);
  });

  test('no axe violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
