import { test, expect } from '@playwright/test';

// Accessibility coverage for the htmx example (next-phase plan §5.3): scan
// the page once htmx has rendered, then re-scan the affected region after
// each htmx swap. htmx is vendored in the example, so no network is needed.
const HTMX = 'http://localhost:4323/';

async function axeViolations(page, include) {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  return (await builder.analyze()).violations;
}

// data-hx-trigger="load" fills #items-tbody once htmx processes the page.
async function waitForItems(page) {
  await expect(page.locator('#items-tbody tr[id^="item-"]').first()).toBeVisible();
}

test.describe('examples/htmx — accessibility', () => {
  test('scans the page after htmx loads the items table', async ({ page }) => {
    await page.goto(HTMX);
    await waitForItems(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('scans the table region after a live-search swap', async ({ page }) => {
    await page.goto(HTMX);
    await waitForItems(page);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/search') && r.ok()),
      page.locator('input[name="q"]').fill('widgets'),
    ]);
    await expect(page.locator('#items-tbody')).toContainText('Acme widgets');
    expect(await axeViolations(page, '#items-tbody')).toEqual([]);
  });

  test('scans the affected region after adding an item (request-action swap)', async ({
    page,
  }) => {
    await page.goto(HTMX);
    await waitForItems(page);

    await page.locator('form[data-hx-post="/items"] input[name="name"]').fill('Fresh sprocket');
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/items') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Add' }).click(),
    ]);
    await expect(page.locator('#items-tbody')).toContainText('Fresh sprocket');
    expect(await axeViolations(page, '#items-tbody')).toEqual([]);
  });

  test('the per-row delete confirm dialog is accessible', async ({ page }) => {
    await page.goto(HTMX);
    await waitForItems(page);

    // data-hc-confirm opens installConfirm's modal before htmx fires DELETE.
    await page.locator('#items-tbody').getByRole('button', { name: 'Delete' }).first().click();
    const dialog = page.locator('dialog.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    expect(await axeViolations(page, '.hc-confirm-dialog')).toEqual([]);

    // Cancel — leave the server state untouched.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
