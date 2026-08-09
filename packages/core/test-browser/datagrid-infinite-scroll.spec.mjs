import { test, expect } from '@playwright/test';

// The container-scrolled datagrid-infinite variant (the docs demo's
// shape): sentinel trigger `intersect once root:#feed-scroll`. The
// regression this pins: with the window-viewport `revealed` trigger a
// short list chain-loads to the end on tall screens without any
// scrolling.
test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-infinite-scroll.html');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="row"]').length >= 5,
  );
});

test.describe('datagrid-infinite — container-scrolled variant', () => {
  test('does NOT chain-load on a tall window: one batch until the container scrolls', async ({ page }) => {
    // The sentinel sits below the container's fold — intersect with the
    // container root must not have fired.
    await page.waitForTimeout(400);
    await expect(page.getByTestId('row')).toHaveCount(5);
    await expect(page.getByTestId('sentinel')).toHaveCount(1);
    await expect(page.getByTestId('end')).toHaveCount(0);
  });

  test('each container scroll loads exactly the next batch, closing with the end marker', async ({ page }) => {
    const scroll = page.getByTestId('scroll');
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByTestId('row')).toHaveCount(10);

    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByTestId('row')).toHaveCount(15);
    await expect(page.getByTestId('sentinel')).toHaveCount(0);
    await expect(page.getByTestId('end')).toHaveText('15 of 15');
  });
});
