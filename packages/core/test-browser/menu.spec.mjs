import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-menu', () => {
  test('trigger has ARIA attributes wired automatically', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-controls', 'account-menu');
  });

  test('clicking the trigger opens the popover and aria-expanded flips', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    const menu = page.getByTestId('menu');

    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('opening focuses the first enabled item', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await expect(page.getByTestId('menu-item-profile')).toBeFocused();
  });

  test('ArrowDown moves focus and skips aria-disabled items', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('menu-item-billing')).toBeFocused();
    // Archived is disabled — ArrowDown lands on Sign out (the last enabled item).
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
  });

  test('Home / End jump to first / last enabled items', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('End');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('menu-item-profile')).toBeFocused();
  });

  test('type-ahead jumps to the first item starting with the typed letter', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    // Profile is the active item — type 'b' should jump to Billing.
    await page.keyboard.press('b');
    await expect(page.getByTestId('menu-item-billing')).toBeFocused();
    // 's' should jump to Sign out (Archived is disabled and skipped).
    await page.keyboard.press('s');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
  });

  test('clicking a menuitem dispatches hc:menuselect and closes the menu', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.getByTestId('menu-item-billing').click();

    await expect(page.getByTestId('menu')).toBeHidden();
    await expect(page.getByTestId('menu-trigger')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('menu-selected')).toHaveAttribute('data-selected', 'Billing');
  });

  test('Escape closes the menu (popover native behaviour)', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu')).toBeHidden();
  });

  test('CSS Anchor Positioning places the menu under the trigger', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    const menu = page.getByTestId('menu');

    await trigger.click();
    const tBox = await trigger.boundingBox();
    const mBox = await menu.boundingBox();
    expect(tBox).not.toBeNull();
    expect(mBox).not.toBeNull();
    // Menu should sit just below the trigger and roughly aligned to
    // its inline-start edge. Tolerances cover the offset + 1 px CSS
    // border on the trigger.
    expect(mBox.y).toBeGreaterThanOrEqual(tBox.y + tBox.height - 2);
    expect(mBox.y).toBeLessThan(tBox.y + tBox.height + 16);
  });

  test('axe finds no violations in the menu section (open state)', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    const results = await new AxeBuilder({ page })
      .include('#section-menu')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
