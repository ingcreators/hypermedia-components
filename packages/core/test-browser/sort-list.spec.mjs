import { test, expect } from '@playwright/test';

// The unit tests dispatch `formdata` by hand because jsdom never fires
// it. What has to hold in a real browser: both transports go through
// the same hook (htmx builds `new FormData(form)`, a native submit
// builds the same entry list), and REORDERING THE LIST WITH THE
// KEYBOARD changes what the form sends — that is what makes this a
// control rather than a read-out.

test.beforeEach(async ({ page }) => {
  await page.goto('/sort-list.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-hc-sort-list]') !== null);
});

const entries = (page) =>
  page.evaluate(() => [
    ...new FormData(document.getElementById('sort-form')).entries(),
  ]);

test.describe('installSortList', () => {
  test('new FormData(form) joins the ordered keys, in place', async ({ page }) => {
    expect(await entries(page)).toEqual([
      ['f-status', 'open'],
      ['sort', '-ship,order'],
      ['page-size', '40'],
    ]);
  });

  test('a native submit sends the same querystring', async ({ page }) => {
    await page.getByTestId('apply').click();
    await page.waitForURL(/\/orders\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('sort')).toBe('-ship,order');
    // The per-key controls are the no-JS wire; they must not ALSO ride
    // along, or the server sees the same instruction twice.
    expect(url.searchParams.has('dir-ship')).toBe(false);
    expect(url.searchParams.has('dir-order')).toBe(false);
  });

  test('changing a direction changes the wire', async ({ page }) => {
    await page.getByTestId('dir-ship').selectOption('asc');
    expect((await entries(page)).find(([n]) => n === 'sort')).toEqual([
      'sort',
      'ship,order',
    ]);
  });

  test('reordering with the keyboard reorders the keys', async ({ page }) => {
    // Space grabs, ArrowDown moves, Space drops — installSortable's
    // keyboard interface, which is the whole reason the handle is a
    // real button.
    const handle = page.getByTestId('handle-ship');
    await handle.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('[data-hc-sort-key="ship"]')).toHaveAttribute(
      'data-grabbed',
      'true',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');

    expect((await entries(page)).find(([n]) => n === 'sort')).toEqual([
      'sort',
      'order,-ship',
    ]);
  });

  test('an emptied list clears the sort rather than sending it blank', async ({
    page,
  }) => {
    await page.getByTestId('list').evaluate((el) => {
      el.innerHTML = '';
    });
    const names = await page.evaluate(() => [
      ...new FormData(document.getElementById('sort-form')).keys(),
    ]);
    expect(names).toEqual(['f-status', 'page-size']);
  });
});
