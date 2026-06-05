import { test, expect } from '@playwright/test';

// The kit is built on logical properties, so most of RTL "just works". These
// tests cover the few places that needed direction-awareness: the datagrid
// frozen column (sticky inline-start), the calendar chevrons, and the
// horizontal arrow-key navigation that mirrors under RTL.
test.beforeEach(async ({ page }) => {
  await page.goto('/rtl.html');
});

test.describe('RTL support', () => {
  test('document direction is rtl', async ({ page }) => {
    expect(await page.evaluate(() => document.dir)).toBe('rtl');
  });

  test('datagrid frozen column sticks to the inline-start (resolves to right in RTL)', async ({ page }) => {
    const box = await page.getByTestId('rtl-cell-0-0').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, left: cs.left, right: cs.right };
    });
    expect(box.position).toBe('sticky');
    // inset-inline-start maps to `right` under RTL.
    expect(box.right).toBe('0px');
    expect(box.left).toBe('auto');
  });

  test('calendar chevrons are mirrored in RTL', async ({ page }) => {
    const nav = page.getByTestId('rtl-calendar').locator('.hc-calendar__nav').first();
    await expect(nav).toBeVisible();
    const transform = await nav.evaluate((el) => getComputedStyle(el).transform);
    // scaleX(-1) → matrix(-1, 0, 0, 1, 0, 0)
    expect(transform.startsWith('matrix(-1')).toBe(true);
  });

  test('tabs: ArrowLeft moves focus forward in RTL', async ({ page }) => {
    const tab1 = page.getByTestId('rtl-tab-1');
    await tab1.focus();
    await page.keyboard.press('ArrowLeft');
    // RTL mirrors the horizontal arrows, so ArrowLeft = next tab.
    await expect(page.getByTestId('rtl-tab-2')).toBeFocused();
  });

  test('tabs: ArrowRight moves focus backward in RTL', async ({ page }) => {
    await page.getByTestId('rtl-tab-2').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('rtl-tab-1')).toBeFocused();
  });

  test('datagrid: ArrowLeft moves the active cell to the next column in RTL', async ({ page }) => {
    const cell = page.getByTestId('rtl-cell-0-0');
    await cell.click();
    await page.keyboard.press('ArrowLeft');
    // RTL: ArrowLeft = inline-end = next column.
    await expect(page.getByTestId('rtl-cell-0-1')).toHaveAttribute('data-active', '');
  });
});
