import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('native popover', () => {
  test('opens when the popovertarget button is clicked', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await expect(popover).toBeHidden();

    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    const open = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="demo-popover"]');
      return el?.matches(':popover-open') ?? false;
    });
    expect(open).toBe(true);
  });

  test('closes on Escape', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
  });

  test('closes via popovertarget+popovertargetaction=hide', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    await page.getByTestId('close-popover').click();
    await expect(popover).toBeHidden();
  });

  test('light-dismiss closes when clicking outside (popover=auto)', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    // Click an element that is outside the popover.
    await page.getByTestId('outside-popover').click();
    await expect(popover).toBeHidden();
  });
});
