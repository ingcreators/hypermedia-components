import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-foot.html', { waitUntil: 'domcontentloaded' });
  // Waiting for role="grid" guarantees installDatagrid() has measured the
  // sticky offsets (foot height, frozen-end widths) before we assert.
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

const rectOf = (loc) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left };
  });

test.describe('hc-datagrid — sticky footer', () => {
  test('the footer sticks to the bottom on vertical scroll', async ({ page }) => {
    const label = page.getByTestId('foot-total-label');
    const before = await rectOf(label);
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollTop = 120;
    });
    const after = await rectOf(label);
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
  });

  test('footer rows stack upward: subtotal sits above total, both pinned', async ({ page }) => {
    const sub = page.getByTestId('foot-subtotal-label');
    const total = page.getByTestId('foot-total-label');
    const subBefore = await rectOf(sub);
    const totalBefore = await rectOf(total);
    expect(subBefore.top).toBeLessThan(totalBefore.top);
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollTop = 120;
    });
    const subAfter = await rectOf(sub);
    expect(Math.abs(subAfter.top - subBefore.top)).toBeLessThan(2);
  });

  test('footer rows carry grid roles but stay out of keyboard navigation', async ({ page }) => {
    await expect(page.getByTestId('foot-total-row')).toHaveAttribute('role', 'row');
    await expect(page.getByTestId('foot-total-value')).toHaveAttribute('role', 'gridcell');
    // Ctrl+End targets the last BODY cell, not the footer.
    await page.getByTestId('cell-item-1').focus();
    await page.keyboard.press('Control+End');
    const activeId = await page.evaluate(
      () =>
        document
          .querySelector('.hc-datagrid__cell[data-active]')
          ?.getAttribute('data-testid') ?? null,
    );
    expect(activeId).toBe('cell-actions-14');
  });
});

test.describe('hc-datagrid — frozen-end columns', () => {
  test('the trailing frozen column stays put on horizontal scroll', async ({ page }) => {
    const frozenEnd = page.getByTestId('cell-actions-1');
    const normal = page.getByTestId('cell-Q1-1');
    const frozenBefore = await rectOf(frozenEnd);
    const normalBefore = await rectOf(normal);

    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollLeft = 260;
    });

    const frozenAfter = await rectOf(frozenEnd);
    const normalAfter = await rectOf(normal);
    expect(Math.abs(frozenAfter.left - frozenBefore.left)).toBeLessThan(2);
    expect(normalAfter.left).toBeLessThan(normalBefore.left - 50);
  });

  test('the footer ∩ frozen-end corner stays pinned on both axes', async ({ page }) => {
    const corner = page.getByTestId('foot-total-actions');
    const before = await rectOf(corner);
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollTop = 120;
      el.scrollLeft = 260;
    });
    const after = await rectOf(corner);
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
    expect(Math.abs(after.left - before.left)).toBeLessThan(2);
  });

  test('resizing re-measures frozen-end offsets', async ({ page }) => {
    // The trailing column's offset is 0; a single frozen-end column keeps
    // --hc-datagrid-right at 0px even after a re-measure.
    const right = await page
      .getByTestId('cell-actions-1')
      .evaluate((el) => el.style.getPropertyValue('--hc-datagrid-right'));
    expect(right).toBe('0px');
    const padding = await page
      .getByTestId('scroll')
      .evaluate((el) => el.style.scrollPaddingRight);
    expect(parseInt(padding, 10)).toBeGreaterThan(50);
  });

  test('axe finds no violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('.hc-datagrid')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
