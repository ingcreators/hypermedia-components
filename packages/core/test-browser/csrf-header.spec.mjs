import { test, expect } from '@playwright/test';

// Pins the blessed CSRF delivery convention (#246) against real htmx:
// <meta name="csrf-token"> in the head + the auto-installed csrf-header
// behavior → X-CSRF-Token on every htmx request. Server frameworks and
// code generators target exactly this wiring.

async function requestHeaders(page, testid) {
  const [request] = await Promise.all([
    page.waitForRequest('**/fragments/confirmed.html'),
    page.getByTestId(testid).click(),
  ]);
  return request.headers();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/csrf-header.html');
});

test.describe('csrf-header behavior with real htmx', () => {
  test('a POST carries the token from the meta tag', async ({ page }) => {
    const headers = await requestHeaders(page, 'post');
    expect(headers['x-csrf-token']).toBe('fixture-token-1');
  });

  test('a GET carries it too — the convention covers every htmx request', async ({ page }) => {
    const headers = await requestHeaders(page, 'get');
    expect(headers['x-csrf-token']).toBe('fixture-token-1');
  });

  test('a rotated token is picked up at request time', async ({ page }) => {
    await page.evaluate(() => {
      document
        .querySelector('meta[name="csrf-token"]')
        .setAttribute('content', 'fixture-token-2');
    });
    const headers = await requestHeaders(page, 'post');
    expect(headers['x-csrf-token']).toBe('fixture-token-2');
  });

  test('an explicit data-hx-headers value wins over the page-level token', async ({ page }) => {
    const headers = await requestHeaders(page, 'override');
    expect(headers['x-csrf-token']).toBe('per-request');
  });
});
