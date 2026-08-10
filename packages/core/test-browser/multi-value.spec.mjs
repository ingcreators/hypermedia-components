import { test, expect } from '@playwright/test';

// The unit tests dispatch `formdata` by hand because jsdom never fires
// it. What has to hold in a real browser is that BOTH transports go
// through the same hook: htmx builds `new FormData(form)`, and a native
// submit builds its entry list the same way.

test.beforeEach(async ({ page }) => {
  await page.goto('/multi-value.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-hc-multi]') !== null);
});

test.describe('installMultiValue', () => {
  test('new FormData(form) expands the lines, in place', async ({ page }) => {
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('filters')).entries()],
    );
    expect(entries).toEqual([
      ['f-buyer', 'ZAB001000000'],
      ['f-buyer', 'test1'],
      ['f-buyer', 'test2'],
      ['f-status', 'open'],
    ]);
  });

  test('a native submit sends the same querystring', async ({ page }) => {
    await page.getByTestId('submit').click();
    await page.waitForURL(/\/orders\?/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('f-buyer')).toEqual([
      'ZAB001000000',
      'test1',
      'test2',
    ]);
    expect(url.searchParams.get('f-status')).toBe('open');
  });

  test('an emptied control drops its condition entirely', async ({ page }) => {
    await page.getByTestId('buyer').fill('   \n  \n');
    const names = await page.evaluate(() =>
      [...new FormData(document.getElementById('filters')).keys()],
    );
    expect(names).toEqual(['f-status']);
  });
});
