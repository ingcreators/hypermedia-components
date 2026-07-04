import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed transfer recipe against real htmx: membership lives
// on the server, every move POSTs action + the checked ids by native
// form serialization, and the response re-renders the whole form
// (counts refreshed, checkboxes cleared). The /mock/transfer routes
// (serve.mjs) stand in for the server's membership handler.

test.beforeEach(async ({ page }) => {
  await page.goto('/transfer.html');
  // The fixture pulls the initial form from the reset endpoint, so the
  // mock state and the markup always agree.
  await expect(page.getByTestId('transfer')).toBeVisible();
  await expect(page.getByTestId('count-available')).toHaveText('(2)');
});

const check = (page, name) =>
  page.getByTestId('transfer').locator(`input[name="${name}"]`);

test.describe('transfer recipe', () => {
  test('add moves the checked ids and re-renders both panes', async ({ page }) => {
    await check(page, 'available').first().check(); // Ada (id 7)
    await page.getByTestId('add').click();

    await expect(page.getByTestId('count-available')).toHaveText('(1)');
    await expect(page.getByTestId('count-assigned')).toHaveText('(2)');
    // The re-render clears every checkbox — no sticky selection.
    await expect(page.getByTestId('transfer').locator('input:checked')).toHaveCount(0);
    // Ada is now in the assigned pane.
    await expect(
      page.getByTestId('transfer').locator('.hc-transfer__pane').nth(1),
    ).toContainText('Ada Lovelace');
  });

  test('remove moves ids the other way', async ({ page }) => {
    await check(page, 'assigned').first().check(); // Alan (id 4)
    await page.getByTestId('remove').click();

    await expect(page.getByTestId('count-assigned')).toHaveText('(0)');
    await expect(page.getByTestId('count-available')).toHaveText('(3)');
  });

  test('a move with nothing checked re-renders with an inline alert (422)', async ({ page }) => {
    await page.getByTestId('add').click();

    await expect(page.getByTestId('transfer-alert')).toBeVisible();
    await expect(page.getByTestId('transfer-alert')).toHaveRole('alert');
    // Counts unchanged — the server's truth stands.
    await expect(page.getByTestId('count-available')).toHaveText('(2)');
    // The next successful move clears the alert (whole-form re-render).
    await check(page, 'available').first().check();
    await page.getByTestId('add').click();
    await expect(page.getByTestId('transfer-alert')).toHaveCount(0);
  });

  test('checked ids travel by native form serialization', async ({ page }) => {
    await check(page, 'available').first().check();
    const values = await page.getByTestId('transfer').evaluate((form) => {
      const fd = new FormData(form);
      return { available: fd.getAll('available'), assigned: fd.getAll('assigned') };
    });
    expect(values).toEqual({ available: ['7'], assigned: [] });
  });

  test('axe finds no violations in the transfer section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-transfer').analyze();
    expect(results.violations).toEqual([]);
  });
});
