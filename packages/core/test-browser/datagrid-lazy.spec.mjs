import { test, expect } from '@playwright/test';

// Lazy row detail: a `data-lazy` detail cell loads on first expand. The
// behavior fires hc:datagriddetailload (htmx loads via hx-trigger) and shows a
// busy spinner until content arrives; subsequent expands don't reload.
// The fixture holds the simulated response until __releaseDetail() so
// the busy window can be asserted without racing a timer.
test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-lazy.html');
});

test.describe('datagrid lazy detail', () => {
  test('first expand shows a busy spinner, then the loaded content', async ({ page }) => {
    const detail = page.getByTestId('detail');
    await page.getByTestId('toggle').click();

    // Busy immediately (spinner via ::after on aria-busy); the response
    // is held, so this state is stable for as long as the reads need.
    await expect(detail).toHaveAttribute('aria-busy', 'true');
    const spinning = await detail.evaluate(
      (el) => getComputedStyle(el, '::after').animationName,
    );
    expect(spinning).toBe('hc-datagrid-detail-spin');

    // Release the simulated response: content arrives → busy clears.
    await page.evaluate(() => window.__releaseDetail());
    await expect(page.getByTestId('detail-content')).toBeVisible();
    await expect(detail).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('detail-content')).toHaveText('Loaded detail #1');
  });

  test('collapsing and re-expanding does not reload', async ({ page }) => {
    const toggle = page.getByTestId('toggle');
    await toggle.click(); // expand → load
    await expect(page.getByTestId('detail')).toHaveAttribute('aria-busy', 'true');
    await page.evaluate(() => window.__releaseDetail());
    await expect(page.getByTestId('detail-content')).toBeVisible();
    await toggle.click(); // collapse
    await toggle.click(); // expand again

    // Still the first load — no second request.
    await expect(page.getByTestId('detail-content')).toHaveText('Loaded detail #1');
    expect(await page.evaluate(() => window.__loadCount)).toBe(1);
    await expect(page.getByTestId('detail')).not.toHaveAttribute('aria-busy', 'true');
  });
});
