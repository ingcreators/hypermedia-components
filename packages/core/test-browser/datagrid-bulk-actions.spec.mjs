import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed datagrid-bulk-actions recipe against real htmx. The
// contract's foundation is the enclosing-form semantics — htmx posts the
// form's checked `ids` checkboxes plus the triggering button's
// name/value and suppresses the native submit — so that is asserted
// against the wire, not assumed. The /mock/bulk route (serve.mjs) stands
// in for the server's bulk handler.

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-bulk-actions.html');
});

test.describe('datagrid bulk actions', () => {
  test('the bar appears with the translated count as rows are selected', async ({ page }) => {
    const bar = page.getByTestId('bar');
    await expect(bar).toBeHidden();

    await page.getByTestId('cb-101').check();
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('count')).toHaveText('1 selected');

    await page.getByTestId('select-all').check();
    await expect(page.getByTestId('count')).toHaveText('3 selected');

    await page.getByTestId('select-all').uncheck();
    await expect(bar).toBeHidden();
  });

  test('archive posts ids + action natively serialized, swaps the rows, toasts, and clears the bar', async ({ page }) => {
    await page.getByTestId('cb-101').check();
    await page.getByTestId('cb-102').check();

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/mock/bulk') && req.method() === 'POST',
    );
    await page.getByTestId('archive').click();

    // The wire contract: enclosing-form values + the button's name/value.
    const body = (await requestPromise).postData() ?? '';
    expect(body).toContain('ids=101');
    expect(body).toContain('ids=102');
    expect(body).not.toContain('ids=103');
    expect(body).toContain('action=archive');

    // 200 + re-rendered rows: the archived rows show the new status.
    const rows = page.locator('#rows .hc-datagrid__row');
    await expect(rows.nth(0)).toContainText('Archived');
    await expect(rows.nth(1)).toContainText('Archived');
    await expect(rows.nth(2)).toContainText('Active');

    // HX-Trigger toast announced the result.
    await expect(page.locator('.hc-toast')).toContainText('2 archived');

    // Selection cleared by construction: new rows are unchecked, the grid
    // re-emitted, the bar hid itself, select-all is fully reset.
    await expect(page.getByTestId('bar')).toBeHidden();
    const selectAll = page.getByTestId('select-all');
    await expect(selectAll).not.toBeChecked();
    expect(await selectAll.evaluate((el) => el.indeterminate)).toBe(false);

    // The native submit stayed suppressed — no navigation happened.
    expect(new URL(page.url()).pathname).toBe('/datagrid-bulk-actions.html');
  });

  test('the button is disabled while the request is in flight (double-submit guard)', async ({ page }) => {
    await page.getByTestId('cb-101').check();
    const archive = page.getByTestId('archive');
    await archive.click();
    // The mock delays 250ms; htmx adds the native disabled attribute.
    await expect(archive).toBeDisabled();
    await expect(page.locator('.hc-toast')).toContainText('1 archived');
    await expect(archive).toBeEnabled();
  });

  test('the confirmed delete is gated, then removes the rows and updates the status out-of-band', async ({ page }) => {
    await page.getByTestId('cb-103').check();

    let requested = false;
    page.on('request', (req) => {
      if (req.url().includes('/mock/bulk')) requested = true;
    });

    await page.getByTestId('delete').click();
    const dialog = page.locator('dialog.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    expect(requested).toBe(false); // gated: nothing sent yet

    await dialog.locator('[data-hc-confirm-ok]').click();
    await expect(page.locator('#rows .hc-datagrid__row')).toHaveCount(2);
    await expect(page.locator('#rows')).not.toContainText('Tornado seeds');
    await expect(page.locator('.hc-toast')).toContainText('1 deleted');
    await expect(page.getByTestId('status')).toHaveText('2 products');
    await expect(page.getByTestId('bar')).toBeHidden();
  });

  test('cancel sends nothing', async ({ page }) => {
    await page.getByTestId('cb-101').check();

    let requested = false;
    page.on('request', (req) => {
      if (req.url().includes('/mock/bulk')) requested = true;
    });

    await page.getByTestId('delete').click();
    const dialog = page.locator('dialog.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-hc-confirm-cancel]').click();
    await expect(dialog).toBeHidden();
    expect(requested).toBe(false);
    await expect(page.locator('#rows .hc-datagrid__row')).toHaveCount(3);
  });

  test('without HX-Request the endpoint answers 303 (post/redirect/get)', async ({ page }) => {
    // The no-JS path: a native form POST carries no HX-Request header and
    // gets a classic redirect, not a fragment.
    const response = await page.request.post('/mock/bulk', {
      form: { ids: '101', action: 'archive' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/mock/bulk/done');
  });

  test('axe finds no violations, with the bar hidden and visible', async ({ page }) => {
    const idle = await new AxeBuilder({ page }).analyze();
    expect(idle.violations).toEqual([]);

    await page.getByTestId('cb-101').check();
    await expect(page.getByTestId('bar')).toBeVisible();
    const withBar = await new AxeBuilder({ page }).analyze();
    expect(withBar.violations).toEqual([]);
  });
});
