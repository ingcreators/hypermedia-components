import { test, expect } from '@playwright/test';

// The chrome is O(1). A bulk-error report is O(reasons), and the
// full-height list page gives the grid whatever the chrome leaves — so
// an unbounded report in the chrome squeezes the grid to nothing on the
// exact screen whose rows it is telling the user to go and fix.
//
// What is pinned: with fifteen reasons rendered, the grid still has a
// usable height, and the page itself still does not scroll.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/bulk-report-height.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="report"]')?.children.length > 0,
  );
});

test.describe('a bulk report cannot eat the grid', () => {
  test('the grid keeps a usable height with fifteen reasons rendered', async ({
    page,
  }) => {
    const box = await page.getByTestId('grid').boundingBox();
    // Enough for a header and several rows — the number is arbitrary;
    // what matters is that it is not "whatever is left of nothing".
    expect(box.height).toBeGreaterThan(200);
  });

  test('the data never gets less room than the diagnostics', async ({ page }) => {
    const grid = await page.getByTestId('grid').boundingBox();
    const report = await page.getByTestId('report').boundingBox();
    // The bound is a quarter of the viewport for exactly this reason: a
    // report taller than the rows it is about has inverted the screen.
    expect(grid.height).toBeGreaterThan(report.height);
  });

  test('the report scrolls inside its own box', async ({ page }) => {
    const report = await page.getByTestId('report').evaluate((el) => ({
      scrolls: el.scrollHeight > el.clientHeight + 1,
      height: Math.round(el.getBoundingClientRect().height),
    }));
    expect(report.scrolls).toBe(true);
    // min(25vh, 12rem) at 700px tall → 25vh = 175px.
    expect(report.height).toBeLessThanOrEqual(192);
  });

  test('nothing outside the grid scrolls, on either axis', async ({ page }) => {
    const overflow = await page.evaluate(() => {
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
    expect(overflow).toEqual({
      doc: { x: 0, y: 0 },
      shell: { x: 0, y: 0 },
      main: { x: 0, y: 0 },
    });
  });

  test('the summary stays one line — it is the part that is O(1)', async ({
    page,
  }) => {
    const summary = await page.getByTestId('summary').boundingBox();
    expect(summary.height).toBeLessThan(96);
  });

  test('the grid still scrolls its own rows', async ({ page }) => {
    const scrolls = await page.getByTestId('scroll').evaluate((el) => ({
      x: el.scrollWidth > el.clientWidth + 1,
      y: el.scrollHeight > el.clientHeight + 1,
    }));
    expect(scrolls).toEqual({ x: true, y: true });
  });
});
