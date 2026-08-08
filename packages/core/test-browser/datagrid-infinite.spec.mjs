import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// A short viewport keeps the fixture's table (behind its 24rem spacer)
// below the fold, so `revealed` cannot fire on load — the plan's
// eager-reveal risk — and every batch needs a real scroll.
test.use({ viewport: { width: 900, height: 360 } });

const scrollToBottom = (page) =>
  page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-infinite.html');
});

test.describe('datagrid-infinite recipe', () => {
  test('the sentinel loads batches only as it is revealed, then the end marker retires it', async ({ page }) => {
    const rows = page.getByTestId('row');
    // Below the fold, nothing fires on load: still exactly page 1.
    await expect(rows).toHaveCount(5);
    await expect(page.getByTestId('sentinel')).toHaveCount(1);

    await scrollToBottom(page);
    await expect(rows).toHaveCount(10);
    // The swap renewed the sentinel with the next cursor.
    await expect(page.getByTestId('sentinel')).toHaveAttribute(
      'data-hx-get',
      '/mock/datagrid-infinite/items?after=item-10',
    );

    await scrollToBottom(page);
    await expect(rows).toHaveCount(15);
    await expect(page.getByTestId('sentinel')).toHaveCount(0);
    await expect(page.getByTestId('end')).toHaveText('15 of 15');
  });

  test('rows swap in with the same table semantics as page 1', async ({ page }) => {
    await scrollToBottom(page);
    await expect(page.getByTestId('row')).toHaveCount(10);
    // The batch rows are indistinguishable from the server-rendered
    // ones: same classes, same scope="row" id header.
    const row6 = page.getByTestId('row').nth(5);
    await expect(row6.locator('th[scope="row"]')).toHaveText('item-6');
    await expect(row6).toHaveClass(/hc-datagrid__row/);
  });

  test('scrolling past the end adds nothing — the list is closed', async ({ page }) => {
    await scrollToBottom(page);
    await expect(page.getByTestId('row')).toHaveCount(10);
    await scrollToBottom(page);
    await expect(page.getByTestId('end')).toBeVisible();

    await scrollToBottom(page);
    await scrollToBottom(page);
    await expect(page.getByTestId('row')).toHaveCount(15);
    await expect(page.getByTestId('sentinel')).toHaveCount(0);
  });

  test('no axe violations with the full list and end marker loaded', async ({ page }) => {
    await scrollToBottom(page);
    await expect(page.getByTestId('row')).toHaveCount(10);
    await scrollToBottom(page);
    await expect(page.getByTestId('end')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
