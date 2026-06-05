import { test, expect } from '@playwright/test';

// data-overflow="scroll": the tab row scrolls instead of wrapping, the
// behavior injects edge scroll buttons that track the scroll position, and
// the active / focused tab is kept in view.

const isInView = async (tab, listSel = '.hc-tabs__list') =>
  tab.evaluate((el, sel) => {
    const list = el.closest('.hc-tabs').querySelector(sel);
    const t = el.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    // fully (or all but a hair) within the list viewport
    return t.left >= l.left - 1 && t.right <= l.right + 1;
  }, listSel);

test.describe('tabs overflow (scroll)', () => {
  test('the tab row scrolls in a single line instead of wrapping', async ({ page }) => {
    await page.goto('/tabs-overflow.html');
    const { overflowing, singleRow } = await page
      .getByTestId('tabs')
      .evaluate((root) => {
        const list = root.querySelector('.hc-tabs__list');
        const tabs = [...list.querySelectorAll('.hc-tabs__tab')];
        const tops = new Set(tabs.map((t) => Math.round(t.offsetTop)));
        return {
          overflowing: list.scrollWidth > list.clientWidth + 1,
          singleRow: tops.size === 1,
        };
      });
    expect(overflowing).toBe(true);
    expect(singleRow).toBe(true);
  });

  test('the scroll buttons reflect the scroll position', async ({ page }) => {
    await page.goto('/tabs-overflow.html');
    const startBtn = page.locator('.hc-tabs__scroll[data-dir="start"]');
    const endBtn = page.locator('.hc-tabs__scroll[data-dir="end"]');

    // At the start edge: only the end button shows.
    await expect(startBtn).toBeHidden();
    await expect(endBtn).toBeVisible();

    // Page to the end and the start button appears.
    await endBtn.click();
    await expect(startBtn).toBeVisible();

    // Clicking the end button advanced the scroll position.
    const scrolled = await page
      .getByTestId('tabs')
      .evaluate((root) => Math.abs(root.querySelector('.hc-tabs__list').scrollLeft));
    expect(scrolled).toBeGreaterThan(0);
  });

  test('keyboard End scrolls the last (off-screen) tab into view', async ({ page }) => {
    await page.goto('/tabs-overflow.html');
    const last = page.getByTestId('tab-8');
    expect(await isInView(last)).toBe(false); // starts off-screen

    await page.getByTestId('tab-1').focus();
    await page.keyboard.press('End'); // focus moves to the last enabled tab

    await expect(last).toBeFocused();
    await expect.poll(() => isInView(last)).toBe(true);
  });

  test('the pre-selected tab is scrolled into view on load', async ({ page }) => {
    await page.goto('/tabs-overflow.html?deep');
    const last = page.getByTestId('tab-8');
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => isInView(last)).toBe(true);

    // …and the start button is showing because we're scrolled in.
    await expect(page.locator('.hc-tabs__scroll[data-dir="start"]')).toBeVisible();
  });
});
