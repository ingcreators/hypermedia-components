import { test, expect } from '@playwright/test';

// The unit tests dispatch `formdata` by hand because jsdom never fires
// it. What has to hold in a real browser is that BOTH transports go
// through the same hook — htmx builds `new FormData(form)` and a native
// submit builds its entry list the same way — and that a reversed range
// is refused by the browser itself, before any request exists.

test.beforeEach(async ({ page }) => {
  await page.goto('/range-value.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-hc-range]') !== null);
});

const entries = (page) =>
  page.evaluate(() => [
    ...new FormData(document.getElementById('filters')).entries(),
  ]);

test.describe('installRangeValue', () => {
  test('new FormData(form) joins the pair, in place', async ({ page }) => {
    expect(await entries(page)).toEqual([
      ['f-status', 'open'],
      ['f-ship', '2026-07-01..2026-07-31'],
      ['f-carrier', 'road'],
    ]);
  });

  test('a native submit sends the same querystring', async ({ page }) => {
    await page.getByTestId('submit').click();
    await page.waitForURL(/\/orders\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('f-ship')).toBe('2026-07-01..2026-07-31');
    expect(url.searchParams.has('f-ship-from')).toBe(false);
    expect(url.searchParams.has('f-ship-to')).toBe(false);
    expect(url.searchParams.get('f-carrier')).toBe('road');
  });

  test('an open end stays open', async ({ page }) => {
    await page.getByTestId('to').fill('');
    expect((await entries(page)).find(([n]) => n === 'f-ship')).toEqual([
      'f-ship',
      '2026-07-01..',
    ]);
  });

  test('an emptied range drops its condition entirely', async ({ page }) => {
    await page.getByTestId('from').fill('');
    await page.getByTestId('to').fill('');
    const names = await page.evaluate(() => [
      ...new FormData(document.getElementById('filters')).keys(),
    ]);
    expect(names).toEqual(['f-status', 'f-carrier']);
  });

  test('a reversed range is refused, not swapped', async ({ page }) => {
    await page.getByTestId('to').fill('2026-06-01');

    const state = await page.getByTestId('to').evaluate((el) => ({
      valid: el.checkValidity(),
      message: el.validationMessage,
      invalid: el.getAttribute('aria-invalid'),
    }));
    expect(state.valid).toBe(false);
    expect(state.message).not.toBe('');
    expect(state.invalid).toBe('true');

    // The browser blocks the submit, so no request is ever made — and
    // the values stay exactly as typed.
    await page.getByTestId('submit').click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain('/range-value.html');
    expect(await page.getByTestId('from').inputValue()).toBe('2026-07-01');
    expect(await page.getByTestId('to').inputValue()).toBe('2026-06-01');
  });

  test('correcting the range clears the refusal', async ({ page }) => {
    await page.getByTestId('to').fill('2026-06-01');
    await page.getByTestId('to').fill('2026-08-31');
    await expect(page.getByTestId('to')).not.toHaveAttribute('aria-invalid');
    await page.getByTestId('submit').click();
    await page.waitForURL(/\/orders\?/);
    expect(new URL(page.url()).searchParams.get('f-ship')).toBe(
      '2026-07-01..2026-08-31',
    );
  });
});
