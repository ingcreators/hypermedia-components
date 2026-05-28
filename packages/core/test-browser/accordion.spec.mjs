import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-accordion — exclusive (name=)', () => {
  test('clicking a trigger opens its item', async ({ page }) => {
    const q1 = page.getByTestId('acc-q1');
    await expect(q1).not.toHaveAttribute('open', '');
    await page.getByTestId('acc-q1-summary').click();
    await expect(q1).toHaveAttribute('open', '');
    await expect(page.getByTestId('acc-q1-content')).toBeVisible();
  });

  test('opening one item closes the previously open sibling (name=faq grouping)', async ({ page }) => {
    const q1 = page.getByTestId('acc-q1');
    const q2 = page.getByTestId('acc-q2');

    await page.getByTestId('acc-q1-summary').click();
    await expect(q1).toHaveAttribute('open', '');

    await page.getByTestId('acc-q2-summary').click();
    await expect(q2).toHaveAttribute('open', '');
    await expect(q1).not.toHaveAttribute('open', '');
  });

  test('Enter on a focused trigger toggles the item', async ({ page }) => {
    const q1 = page.getByTestId('acc-q1');
    await page.getByTestId('acc-q1-summary').focus();
    await page.keyboard.press('Enter');
    await expect(q1).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(q1).not.toHaveAttribute('open', '');
  });

  test('Space on a focused trigger toggles the item', async ({ page }) => {
    const q2 = page.getByTestId('acc-q2');
    await page.getByTestId('acc-q2-summary').focus();
    await page.keyboard.press('Space');
    await expect(q2).toHaveAttribute('open', '');
  });

  test('chevron rotates 180° when an item is open', async ({ page }) => {
    const summary = page.getByTestId('acc-q1-summary');
    const icon = summary.locator('.hc-accordion__icon');

    const before = await icon.evaluate((el) => getComputedStyle(el).rotate);
    expect(before).toBe('none');

    await summary.click();
    // Wait briefly for the rotate transition to settle.
    await page.waitForTimeout(200);
    const after = await icon.evaluate((el) => getComputedStyle(el).rotate);
    expect(after).toMatch(/180deg/);
  });
});

test.describe('hc-accordion — independent (no name)', () => {
  test('multiple items can stay open at once', async ({ page }) => {
    const a = page.getByTestId('acc-m1');
    const b = page.getByTestId('acc-m2');

    await page.getByTestId('acc-m1-summary').click();
    await page.getByTestId('acc-m2-summary').click();

    await expect(a).toHaveAttribute('open', '');
    await expect(b).toHaveAttribute('open', '');
  });
});

test.describe('hc-accordion — a11y', () => {
  test('axe finds no violations across the accordion section', async ({ page }) => {
    // Open one item so the open state is exercised too.
    await page.getByTestId('acc-q1-summary').click();
    const results = await new AxeBuilder({ page })
      .include('#section-accordion')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
