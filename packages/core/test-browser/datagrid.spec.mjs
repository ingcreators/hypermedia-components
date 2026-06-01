import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid.html', { waitUntil: 'domcontentloaded' });
  // installDatagrid() (auto-init) applies the grid role and MEASURES the
  // sticky offsets. Waiting for role="grid" guarantees the offsets have
  // been written before we assert the sticky layout — so these tests also
  // prove the behavior's automatic measurement is correct.
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

test.describe('hc-datagrid — Phase 1 structure', () => {
  test('the multi-level header sticks to the top on vertical scroll', async ({ page }) => {
    const leaf = page.getByTestId('leaf-a1');
    const before = await rectOf(leaf);
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollTop = 120;
    });
    const after = await rectOf(leaf);
    // Header stays put (sticky) while the body scrolls underneath.
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
  });

  test('frozen columns stay on horizontal scroll while normal columns move', async ({ page }) => {
    const frozen = page.getByTestId('cell-id-1');
    const normal = page.getByTestId('cell-Alpha-1');
    const frozenBefore = await rectOf(frozen);
    const normalBefore = await rectOf(normal);

    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollLeft = 220;
    });

    const frozenAfter = await rectOf(frozen);
    const normalAfter = await rectOf(normal);

    expect(Math.abs(frozenAfter.left - frozenBefore.left)).toBeLessThan(2); // frozen stays
    expect(normalAfter.left).toBeLessThan(normalBefore.left - 50); // normal scrolled away
  });

  test('the corner cell stays pinned on both axes', async ({ page }) => {
    const corner = page.getByTestId('corner-id');
    const before = await rectOf(corner);
    await page.getByTestId('scroll').evaluate((el) => {
      el.scrollTop = 120;
      el.scrollLeft = 220;
    });
    const after = await rectOf(corner);
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
    expect(Math.abs(after.left - before.left)).toBeLessThan(2);
  });

  test('header levels stack (group above leaf), both sticky', async ({ page }) => {
    const group = page.getByTestId('group-a');
    const leaf = page.getByTestId('leaf-a1');
    const g = await rectOf(group);
    const l = await rectOf(leaf);
    expect(l.top).toBeGreaterThan(g.top); // leaf row sits below the group row
  });

  test('a cell in edit mode drops its padding so the editor fills it', async ({ page }) => {
    const pad = await page.getByTestId('cell-Alpha-2').evaluate((el) => {
      el.setAttribute('data-editing', '');
      const input = document.createElement('input');
      input.className = 'hc-input';
      el.replaceChildren(input);
      return getComputedStyle(el).paddingTop;
    });
    expect(pad).toBe('0px');
  });

  test('axe finds no violations in the grid', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('[data-testid="grid"]').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-datagrid — keyboard & selection (installDatagrid)', () => {
  const activeTestId = (page) =>
    page.evaluate(
      () =>
        document
          .querySelector('.hc-datagrid__cell[data-active]')
          ?.getAttribute('data-testid') ?? null,
    );

  test('arrow keys move the active cell across rows and columns', async ({ page }) => {
    await page.getByTestId('cell-id-1').focus();
    await page.keyboard.press('ArrowRight');
    expect(await activeTestId(page)).toBe('cell-Alpha-1');
    await page.keyboard.press('ArrowDown');
    expect(await activeTestId(page)).toBe('cell-Alpha-2');
    await page.keyboard.press('ArrowLeft');
    expect(await activeTestId(page)).toBe('cell-id-2');
  });

  test('Ctrl+End jumps to the last cell of the last row', async ({ page }) => {
    await page.getByTestId('cell-id-1').focus();
    await page.keyboard.press('Control+End');
    expect(await activeTestId(page)).toBe('cell-Zeta-14');
  });

  test('Space selects the active row (checkbox + aria-selected)', async ({ page }) => {
    await page.getByTestId('cell-Alpha-2').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('row-2')).toHaveAttribute('aria-selected', 'true');
    expect(
      await page.getByTestId('row-2').locator('input[type="checkbox"]').isChecked(),
    ).toBe(true);
  });

  test('the select-all checkbox selects every row', async ({ page }) => {
    await page.getByTestId('corner-check').locator('input[type="checkbox"]').check();
    await expect(page.getByTestId('row-1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('row-14')).toHaveAttribute('aria-selected', 'true');
  });
});
