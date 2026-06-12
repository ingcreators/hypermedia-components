import { test, expect } from '@playwright/test';

// The confirm-gating specification, exercised against REAL htmx (2.0.4,
// the copy vendored for examples/htmx): the behavior intercepts the
// click in the capture phase, so htmx only ever requests via the
// hc:confirmed trigger. See integrations/htmx → "Confirm gating
// specification".
test.beforeEach(async ({ page }) => {
  await page.goto('/confirm-htmx.html');
});

const dialog = (page) => page.locator('.hc-confirm-dialog');

test.describe('confirm gating with htmx', () => {
  test('sanity: an ungated button issues the htmx request on click', async ({ page }) => {
    await page.getByTestId('plain').click();
    await expect(page.getByTestId('out-plain').getByTestId('swapped-fragment')).toBeVisible();
  });

  test('the gated button requests only after Confirm', async ({ page }) => {
    await page.getByTestId('gated').click();
    await expect(dialog(page)).toBeVisible();
    // Interception: no request fired on the original click.
    await expect(page.getByTestId('out-gated')).toBeEmpty();

    await dialog(page).locator('[data-hc-confirm-ok]').click();
    await expect(page.getByTestId('out-gated').getByTestId('swapped-fragment')).toBeVisible();
  });

  test('Cancel fires nothing', async ({ page }) => {
    await page.getByTestId('gated').click();
    await dialog(page).locator('[data-hc-confirm-cancel]').click();
    await expect(dialog(page)).toBeHidden();

    // Give a would-be request time to land, then assert it never did.
    await page.waitForTimeout(200);
    await expect(page.getByTestId('out-gated')).toBeEmpty();
  });

  test('a gated element with the default click trigger is inert for htmx (documented requirement)', async ({ page }) => {
    await page.getByTestId('default-trigger').click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).locator('[data-hc-confirm-ok]').click();
    await expect(dialog(page)).toBeHidden();

    await page.waitForTimeout(200);
    // Without data-hx-trigger="hc:confirmed", confirming still issues
    // no request — htmx never saw the click and ignores the event.
    await expect(page.getByTestId('out-default')).toBeEmpty();
  });
});
