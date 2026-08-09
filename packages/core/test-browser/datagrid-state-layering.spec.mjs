import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The datagrid paints every state tint into ONE background-image, so only
// one state can own the background at a time. These specs pin the ladder
// (hc-datagrid.css "States: the background channel") and prove that the
// attention channel survives whatever the ladder paints — the regression
// that made a selected failed row look like an ordinary selected row.

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-state-layering.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

const tint = (page, id) =>
  page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundImage);
const shadow = (page, id) =>
  page.getByTestId(id).evaluate((el) => getComputedStyle(el).boxShadow);

test.describe('datagrid state layering', () => {
  test('selection outranks conditional formatting', async ({ page }) => {
    const selected = await tint(page, 'selected-first');
    const toneOnly = await tint(page, 'tone-first');
    expect(toneOnly).not.toBe(selected); // tone still paints on its own
    // …but a selected toned row shows the SELECTION, so the user can see
    // the set they are about to act on.
    expect(await tint(page, 'toned-first')).toBe(selected);
  });

  test('an attention row keeps its selection tint AND its bar', async ({
    page,
  }) => {
    expect(await tint(page, 'both-first')).toBe(await tint(page, 'selected-first'));
    const bar = await shadow(page, 'both-first');
    expect(bar).toContain('inset');
    // The bar is on the row's first cell only.
    expect(await shadow(page, 'both-ship')).not.toContain('inset');
  });

  test('hover cannot erase the attention bar or the selection tint', async ({
    page,
  }) => {
    const selected = await tint(page, 'both-first');
    await page.getByTestId('row-both').hover();
    expect(await tint(page, 'both-first')).toBe(selected); // selection > hover
    expect(await shadow(page, 'both-first')).toContain('inset');
  });

  test('a rejected cell covers only itself', async ({ page }) => {
    const selected = await tint(page, 'selected-first');
    // The rest of the row still reads as selected…
    expect(await tint(page, 'invalid-first')).toBe(selected);
    // …while the offending cell keeps the error tint and its ring.
    expect(await tint(page, 'invalid-ship')).not.toBe(selected);
    const outline = await page
      .getByTestId('invalid-ship')
      .evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outline).toBe('2px');
  });

  test('severity picks the bar colour', async ({ page }) => {
    const error = await shadow(page, 'both-first');
    const warning = await shadow(page, 'warn-first');
    expect(warning).toContain('inset');
    expect(warning).not.toBe(error);
  });

  test('the offending column header is marked', async ({ page }) => {
    expect(await shadow(page, 'head-ship')).toContain('inset');
  });

  test('a fragment naming a cell lands on that cell', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#cell-invalid-ship';
    });
    await expect(page.getByTestId('invalid-ship')).toHaveAttribute(
      'data-active',
      '',
    );
    await expect(page.getByTestId('invalid-first')).not.toHaveAttribute(
      'data-active',
      '',
    );
  });

  test('axe: no violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .include('.hc-datagrid')
      .analyze();
    expect(violations).toEqual([]);
  });
});
