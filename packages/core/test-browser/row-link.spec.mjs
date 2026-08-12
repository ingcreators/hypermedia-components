import { test, expect } from '@playwright/test';

// The row's link is an ordinary anchor, so the browser already gives
// middle-click, ⌘-click, copy-address and Back. What needs pinning is
// the one thing the behavior adds — Enter anywhere on the row — and,
// more importantly, everything it must NOT take.

test.beforeEach(async ({ page }) => {
  await page.goto('/row-link.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('.hc-datagrid__table')?.getAttribute('role') === 'grid',
  );
});

test.describe('installRowLink', () => {
  test('Enter on a plain cell opens the record', async ({ page }) => {
    await page.getByTestId('plain').click();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/orders\/4903$/);
  });

  test('an editable cell keeps Enter — editing wins where it applies', async ({
    page,
  }) => {
    await page.getByTestId('editable').click();
    await page.keyboard.press('Enter');
    // The datagrid opened its editor and cancelled the event; the URL
    // is untouched.
    await expect(page.locator('[data-editing] input')).toBeVisible();
    expect(page.url()).toContain('/row-link.html');
  });

  test('a control that owns its Enter keeps it', async ({ page }) => {
    await page.getByTestId('approve').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(page.url()).toContain('/row-link.html');
  });

  test('a modifier means something else', async ({ page }) => {
    await page.getByTestId('plain').click();
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(150);
    expect(page.url()).toContain('/row-link.html');
  });

  test('the link still works as a link', async ({ page }) => {
    // Nothing about the behavior may take the anchor's own job.
    await page.getByTestId('link').click();
    await page.waitForURL(/\/orders\/4903$/);
  });
});
