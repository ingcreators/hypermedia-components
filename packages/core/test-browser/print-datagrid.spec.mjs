import { test, expect } from '@playwright/test';

// A fixed-height grid keeps its rows in its own scrollport. On paper
// there is no scrolling: whatever the cap hides is simply missing, and
// the reader has no way to know. So print must un-cap the SCROLLPORT —
// resetting the wrapper is not enough, because that is not where the
// cap lives.

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-app-page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('.hc-datagrid__table')?.getAttribute('role') === 'grid',
  );
});

const scrollportStyle = (page) =>
  page.getByTestId('scroll').evaluate((el) => {
    const s = getComputedStyle(el);
    return { maxHeight: s.maxHeight, overflowY: s.overflowY };
  });

test.describe('printing a fixed-height grid', () => {
  test('on screen the scrollport is capped and scrolls', async ({ page }) => {
    await page.emulateMedia({ media: 'screen' });
    const style = await scrollportStyle(page);
    expect(style.maxHeight).not.toBe('none');
    expect(style.overflowY).not.toBe('visible');
  });

  test('on paper it is not — every row is in the flow', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    const style = await scrollportStyle(page);
    expect(style.maxHeight).toBe('none');
    expect(style.overflowY).toBe('visible');
  });

  test('the header stops being sticky, so it can repeat per page', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    const position = await page
      .getByTestId('head-frozen')
      .evaluate((el) => getComputedStyle(el.closest('.hc-datagrid__head')).position);
    expect(position).toBe('static');
  });
});
