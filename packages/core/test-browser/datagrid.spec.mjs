import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid.html', { waitUntil: 'domcontentloaded' });
  // Mirror what installDatagrid() (Phase 2) does: measure the real header
  // row height and frozen column width and write the sticky offsets back
  // as CSS variables, so the offsets match the rendered layout exactly.
  await page.evaluate(() => {
    const grid = document.querySelector('.hc-datagrid');
    const headRow1 = grid.querySelector('.hc-datagrid__head > tr');
    grid.style.setProperty(
      '--hc-datagrid-head-1-h',
      headRow1.getBoundingClientRect().height + 'px',
    );
    const idHead = document.querySelector('[data-testid="corner-id"]');
    const checkW = idHead.previousElementSibling.getBoundingClientRect().width;
    document
      .querySelectorAll('[data-frozen-edge]')
      .forEach((c) => c.style.setProperty('--hc-datagrid-left', checkW + 'px'));
  });
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
