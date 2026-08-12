import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// "Row 137" is how a business grid is discussed out loud, and
// aria-rowcount / aria-rowindex are how it is said to an assistive
// technology. The server numbers the result set; the behavior derives
// the ARIA numbers, which count DOM rows INCLUDING headers.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/row-ordinals.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('.hc-datagrid__table')?.getAttribute('role') === 'grid',
  );
});

test.describe('row ordinals', () => {
  test('the count is the result set, offset by the header rows', async ({ page }) => {
    await expect(page.getByTestId('table')).toHaveAttribute('aria-rowcount', '5001');
  });

  test('each row says where it sits in that set', async ({ page }) => {
    const indexes = await page.evaluate(() =>
      [...document.querySelectorAll('.hc-datagrid__row')].map((r) =>
        r.getAttribute('aria-rowindex'),
      ),
    );
    expect(indexes).toEqual(['138', '139']);
  });

  test('a swap renumbers — the paged-grid lie this fixes', async ({ page }) => {
    // Before: "row 3 of 40" on page four is what a grid without these
    // attributes announces. After a page swap the numbers must follow.
    await page.getByTestId('next-page').click();
    await expect(page.locator('#row-4903')).toHaveAttribute('aria-rowindex', '178');
    await expect(page.getByTestId('table')).toHaveAttribute('aria-rowcount', '5001');
  });

  test('the visible ordinal and the announced one agree', async ({ page }) => {
    const pair = await page.locator('#row-4901').evaluate((row) => ({
      shown: row.querySelector('[data-numeric]').textContent.trim(),
      announced: Number(row.getAttribute('aria-rowindex')),
      headerRows: document.querySelectorAll('.hc-datagrid__head > tr').length,
    }));
    expect(pair.announced - pair.headerRows).toBe(Number(pair.shown));
  });


  test('a prev / next error link moves the ACTIVE CELL, not just the scroll', async ({
    page,
  }) => {
    // This is the whole mechanism behind "go to the next error": a real
    // fragment link, and installDatagrid()'s focusHashRow() landing the
    // active cell on the row it names — Back works, the keyboard works,
    // and no client state is involved.
    await page.getByTestId('prev-error').click();
    await expect(page).toHaveURL(/#row-4901$/);
    const landed = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        row: active?.closest('.hc-datagrid__row')?.id,
        isCell: active?.classList.contains('hc-datagrid__cell'),
      };
    });
    expect(landed).toEqual({ row: 'row-4901', isCell: true });
  });

  test('the failing rows say so themselves', async ({ page }) => {
    const marked = await page.evaluate(() =>
      [...document.querySelectorAll('.hc-datagrid__row[data-attention="error"]')].map(
        (r) => r.id,
      ),
    );
    // The report is a NAVIGATOR; the rows are where the state lives, and
    // they scroll with the data because they are the data.
    expect(marked).toEqual(['row-4901', 'row-4902']);
  });

  test('no axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations).toEqual([]);
  });
});
