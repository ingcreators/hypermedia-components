import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-context-menu', () => {
  test('right-click opens the menu at the pointer and suppresses the native menu', async ({ page }) => {
    const region = page.getByTestId('ctx-region');
    const menu = page.getByTestId('ctx-menu');

    // Confirm the behavior cancels the native contextmenu event.
    const prevented = await region.evaluate(
      (el) =>
        new Promise((resolve) => {
          el.addEventListener(
            'contextmenu',
            (e) => resolve(e.defaultPrevented),
            { once: true },
          );
          el.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 30 }),
          );
        }),
    );
    expect(prevented).toBe(true);
    await expect(menu).toBeVisible();
  });

  test('the menu opens at the pointer coordinates', async ({ page }) => {
    const menu = page.getByTestId('ctx-menu');
    // Dispatch at fixed viewport coordinates and read the menu rect in
    // the same (viewport) frame — avoids scroll / page-vs-viewport
    // coordinate mismatches.
    await page.evaluate(() => {
      document.querySelector('[data-hc-context-menu="ctx-demo"]').dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 120 }),
      );
    });
    await expect(menu).toBeVisible();
    const rect = await menu.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top };
    });
    // Fixed-positioned at the pointer (no clamp needed at this point in
    // a 1280-wide viewport).
    expect(Math.abs(rect.x - 150)).toBeLessThan(40);
    expect(Math.abs(rect.y - 120)).toBeLessThan(40);
  });

  test('opens via Shift+F10 and restores focus to the region on Escape', async ({ page }) => {
    const region = page.getByTestId('ctx-region');
    const menu = page.getByTestId('ctx-menu');
    await region.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    // First enabled item takes focus.
    await expect(page.getByTestId('ctx-open')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // Native popover focus restoration returns focus to the region.
    await expect(region).toBeFocused();
  });

  test('arrow keys navigate the open menu', async ({ page }) => {
    await page.getByTestId('ctx-region').click({ button: 'right' });
    await expect(page.getByTestId('ctx-open')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('ctx-menu').getByText('Rename')).toBeFocused();
  });

  test('selecting a menuitem dispatches hc:menuselect and closes', async ({ page }) => {
    const region = page.getByTestId('ctx-region');
    const menu = page.getByTestId('ctx-menu');

    const selectName = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.getElementById('ctx-demo').addEventListener(
            'hc:menuselect',
            (e) => resolve({ text: e.detail.item.textContent, hasTarget: !!e.detail.contextTarget }),
            { once: true },
          );
        }),
    );

    await region.click({ button: 'right' });
    await page.getByTestId('ctx-open').click();

    expect(await selectName).toEqual({ text: 'Open', hasTarget: true });
    await expect(menu).toBeHidden();
  });

  test('a menuitemcheckbox toggles without closing the menu', async ({ page }) => {
    const region = page.getByTestId('ctx-region');
    const bookmark = page.getByTestId('ctx-bookmark');
    await region.click({ button: 'right' });
    await bookmark.click();
    await expect(bookmark).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('ctx-menu')).toBeVisible();
  });

  test('axe finds no violations with the context menu open', async ({ page }) => {
    await page.getByTestId('ctx-region').click({ button: 'right' });
    await expect(page.getByTestId('ctx-menu')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('#section-context-menu')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
