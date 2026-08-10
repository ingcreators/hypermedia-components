import { test, expect } from '@playwright/test';

// The full-height list page (templates/data-grid-page): the chrome stays
// put and ONLY the grid scrolls. The failure this pins is the inline
// one — without `min-inline-size: 0` the page column grows to the
// max-content table's width and hc-shell__main becomes the horizontal
// scrollport, so scrolling right drags the toolbar and the title along.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/datagrid-app-page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

const overflow = (page) =>
  page.evaluate(() => {
    const of = (el) => ({
      x: el.scrollWidth - el.clientWidth,
      y: el.scrollHeight - el.clientHeight,
    });
    return {
      doc: of(document.documentElement),
      shell: of(document.querySelector('.hc-shell')),
      main: of(document.querySelector('.hc-shell__main')),
    };
  });

test.describe('full-height list page', () => {
  test('nothing outside the grid scrolls, on either axis', async ({ page }) => {
    expect(await overflow(page)).toEqual({
      doc: { x: 0, y: 0 },
      shell: { x: 0, y: 0 },
      main: { x: 0, y: 0 },
    });
  });

  test('the grid scrolls both axes', async ({ page }) => {
    const scrolls = await page.getByTestId('scroll').evaluate((el) => ({
      x: el.scrollWidth > el.clientWidth + 1,
      y: el.scrollHeight > el.clientHeight + 1,
    }));
    expect(scrolls).toEqual({ x: true, y: true });
  });

  test('scrolling the grid leaves the chrome where it was', async ({ page }) => {
    const chrome = () =>
      page.getByTestId('toolbar').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      });
    const before = await chrome();
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollLeft = 600;
      el.scrollTop = 900;
    });
    expect(await chrome()).toEqual(before);
  });

  test('the sticky header and the frozen column hold', async ({ page }) => {
    const head = () =>
      page.getByTestId('head-frozen').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      });
    const before = await head();
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollLeft = 600;
      el.scrollTop = 900;
    });
    // Frozen on the inline axis, sticky on the block axis — the corner
    // cell must not move on either.
    expect(await head()).toEqual(before);
  });
});
