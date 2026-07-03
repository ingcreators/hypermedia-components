import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed SSE recipes against a real EventSource + real htmx:
// named-event fragment swaps (sse-updates), out-of-band fragments inside
// SSE data, the dispatch bridge's strict payload rules (sse-toast), the
// data-region invalidation composition, and the deliberate stream end.
// The /mock/sse route (serve.mjs) streams a fixed, timed script.

test.beforeEach(async ({ page }) => {
  await page.goto('/sse.html');
});

test.describe('SSE recipes', () => {
  test('named events swap fragments: the feed prepends, the panel replaces', async ({ page }) => {
    const items = page.getByTestId('feed').locator('li');
    await expect(items.first()).toHaveText('Deploy #42 started');
    await expect(items).toHaveCount(2); // pushed + server-rendered initial

    await expect(page.getByTestId('panel')).toContainText('All systems normal');
  });

  test('an out-of-band fragment inside SSE data updates a second target', async ({ page }) => {
    // One push carries the panel body plus an hx-swap-oob badge.
    await expect(page.getByTestId('panel')).toContainText('All systems normal');
    await expect(page.getByTestId('badge')).toHaveText('3');
  });

  test('the bridge shows the pushed toast; the malformed payload before it is dropped', async ({ page }) => {
    const toast = page.locator('.hc-toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText('Build finished');

    // The bridge never renders — the malformed hc:toast event neither
    // swapped into it nor produced a toast.
    expect((await page.getByTestId('bridge').textContent()).trim()).toBe('');
  });

  test('a pushed domain event refetches the data-region', async ({ page }) => {
    // items:changed (data: {}) bubbles from the bridge; the region
    // listening with `items:changed from:body` pulls its re-render.
    await expect(page.getByTestId('region')).not.toHaveText('region v0');
    await expect(page.getByTestId('region')).toHaveText(/^region v\d+$/);
  });

  test('the stream ends deliberately (sse-close) and does not replay on reconnect', async ({ page }) => {
    await expect(page.locator('.hc-toast')).toHaveCount(1);
    await expect(page.getByTestId('feed').locator('li')).toHaveCount(2);

    // Past the retry window: a closed (not dropped) stream must not
    // reconnect and replay the script.
    await page.waitForTimeout(1800);
    await expect(page.locator('.hc-toast')).toHaveCount(1);
    await expect(page.getByTestId('feed').locator('li')).toHaveCount(2);
  });

  test('axe finds no violations after the pushed updates settle', async ({ page }) => {
    await expect(page.getByTestId('badge')).toHaveText('3');
    await expect(page.locator('.hc-toast')).toContainText('Build finished');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
