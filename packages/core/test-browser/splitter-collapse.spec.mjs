import { test, expect } from '@playwright/test';

// A collapsed pane must not leave a hole (the fixed --hc-splitter-pos
// basis would), and must not leave the user without a way back.

test.beforeEach(async ({ page }) => {
  await page.goto('/splitter-collapse.html', { waitUntil: 'domcontentloaded' });
});

const widths = (page) =>
  page.evaluate(() => {
    const w = (sel) =>
      Math.round(document.querySelector(`[data-testid="${sel}"]`).getBoundingClientRect().width);
    return { splitter: w('splitter'), main: w('main'), side: w('side') };
  });

test.describe('a collapsed splitter pane', () => {
  test('shrinks to its rail and gives the space to its sibling', async ({ page }) => {
    const { splitter, main, side } = await widths(page);
    expect(side).toBeLessThan(200); // the rail, not a panel
    // No hole: the two panes still account for the splitter's width.
    expect(main + side).toBeGreaterThan(splitter - 8);
  });

  test('the way back is still on screen', async ({ page }) => {
    await expect(page.getByTestId('rail')).toBeVisible();
  });

  test('there is nothing to drag while it is collapsed', async ({ page }) => {
    await expect(page.getByTestId('handle')).toBeHidden();
    await page.getByTestId('expand').click();
    await expect(page.getByTestId('handle')).toBeVisible();
  });

  test('expanding gives the pane real width back', async ({ page }) => {
    const before = await widths(page);
    await page.getByTestId('expand').click();
    const after = await widths(page);
    expect(after.side).toBeGreaterThan(before.side + 100);
    expect(after.main).toBeLessThan(before.main);
  });
});
