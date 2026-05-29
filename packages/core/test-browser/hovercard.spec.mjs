import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-hovercard', () => {
  test('auto-attributes popover on the card', async ({ page }) => {
    await expect(page.getByTestId('hc-card')).toHaveAttribute('popover', 'manual');
  });

  test('hovering the trigger reveals the card after the delay', async ({ page }) => {
    const trigger = page.getByTestId('hc-trigger');
    const card = page.getByTestId('hc-card');
    await trigger.hover();
    // Show delay is 500 ms.
    await expect(card).toBeVisible({ timeout: 1200 });
  });

  test('focusing the trigger reveals the card immediately', async ({ page }) => {
    const trigger = page.getByTestId('hc-trigger');
    const card = page.getByTestId('hc-card');
    await trigger.focus();
    await expect(card).toBeVisible({ timeout: 200 });
  });

  test('moving the cursor from the trigger into the card keeps it open (pointer-events: auto)', async ({ page }) => {
    const trigger = page.getByTestId('hc-trigger');
    const card = page.getByTestId('hc-card');
    await trigger.hover();
    await expect(card).toBeVisible({ timeout: 1200 });

    // Move into the card body.
    await page.getByTestId('hc-card-link').hover();
    // Give the close delay a chance to run.
    await page.waitForTimeout(400);
    await expect(card).toBeVisible();
  });

  test('Escape on the trigger closes the card', async ({ page }) => {
    const trigger = page.getByTestId('hc-trigger');
    const card = page.getByTestId('hc-card');
    await trigger.focus();
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
  });

  test('axe finds no violations with the card open', async ({ page }) => {
    await page.getByTestId('hc-trigger').focus();
    await expect(page.getByTestId('hc-card')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('#section-hovercard')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
