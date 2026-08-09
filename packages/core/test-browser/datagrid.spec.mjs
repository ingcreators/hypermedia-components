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

  test('a selected row keeps frozen cells opaque (no horizontal bleed-through)', async ({
    page,
  }) => {
    await page.getByTestId('row-1').locator('input[type="checkbox"]').check();
    const { bgColor, hasImage } = await page.getByTestId('cell-id-1').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bgColor: cs.backgroundColor, hasImage: cs.backgroundImage !== 'none' };
    });
    // The base background-color stays opaque (no alpha < 1); the selection
    // tint is layered as a background-image so scrolled content can't show
    // through the frozen cell.
    expect(bgColor).not.toMatch(/rgba\([^)]*,\s*0(\.\d+)?\)/);
    expect(hasImage).toBe(true);
  });

  test('the header background is distinct from the row-hover background', async ({
    page,
  }) => {
    const { head, hover } = await page.getByTestId('grid').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        head: cs.getPropertyValue('--hc-datagrid-head-bg').trim(),
        hover: cs.getPropertyValue('--hc-datagrid-row-hover-bg').trim(),
      };
    });
    expect(head).toBeTruthy();
    expect(hover).toBeTruthy();
    expect(head).not.toBe(hover); // header (grey) must differ from hover (accent tint)
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

test.describe('hc-datagrid — range selection & clipboard', () => {
  test('Shift+Arrow paints a rectangular range; Escape clears it', async ({ page }) => {
    await page.getByTestId('cell-Alpha-1').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const inRange = page.locator('.hc-datagrid__cell[data-in-range]');
    await expect(inRange).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(inRange).toHaveCount(0);
  });

  test('a plain arrow clears the range', async ({ page }) => {
    await page.getByTestId('cell-Alpha-1').focus();
    await page.keyboard.press('Shift+ArrowRight');
    const inRange = page.locator('.hc-datagrid__cell[data-in-range]');
    await expect(inRange).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await expect(inRange).toHaveCount(0);
  });

  test('Shift+Click extends the range to the clicked cell', async ({ page }) => {
    await page.getByTestId('cell-Alpha-1').focus();
    await page.getByTestId('cell-Beta-2').click({ modifiers: ['Shift'] });
    const inRange = page.locator('.hc-datagrid__cell[data-in-range]');
    await expect(inRange).toHaveCount(4);
  });

  test('Ctrl+C emits a cancelable hc:datagridcopy carrying the TSV', async ({ page }) => {
    await page.evaluate(() => {
      window.__copies = [];
      document.querySelector('.hc-datagrid').addEventListener('hc:datagridcopy', (e) => {
        e.preventDefault(); // claim the copy — no clipboard permission needed in CI
        window.__copies.push(e.detail);
      });
    });
    await page.getByTestId('cell-Alpha-1').focus();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Control+c');
    const copies = await page.evaluate(() => window.__copies);
    expect(copies.length).toBe(1);
    expect(copies[0].rows).toBe(2);
    expect(copies[0].cols).toBe(1);
    expect(copies[0].text.split('\n').length).toBe(2);
  });

  test('Ctrl+A selects every row instead of the document', async ({ page }) => {
    await page.getByTestId('cell-Alpha-1').focus();
    await page.keyboard.press('Control+a');
    await expect(page.getByTestId('row-1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('row-14')).toHaveAttribute('aria-selected', 'true');
  });

  test('axe finds no violations with an active range', async ({ page }) => {
    await page.getByTestId('cell-Alpha-1').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const results = await new AxeBuilder({ page })
      .include('.hc-datagrid')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-datagrid — inline editing (installDatagrid)', () => {
  test('double-click a text cell, edit, Enter commits + emits hc:datagridedit', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__edits = [];
      document
        .querySelector('.hc-datagrid')
        .addEventListener('hc:datagridedit', (e) => window.__edits.push(e.detail));
    });
    const cell = page.getByTestId('cell-Alpha-1');
    await cell.dblclick();
    const input = cell.locator('input');
    await input.fill('Edited!');
    await input.press('Enter');

    await expect(cell).toHaveText('Edited!');
    const edits = await page.evaluate(() => window.__edits);
    expect(edits.length).toBe(1);
    expect(edits[0]).toMatchObject({ value: 'Edited!', col: 'alpha' });
  });

  test('F2 edits a select cell; choosing an option updates value + label', async ({
    page,
  }) => {
    const cell = page.getByTestId('cell-Beta-2');
    await cell.focus();
    await page.keyboard.press('F2');
    const select = cell.locator('select');
    await select.selectOption('y');
    await select.press('Enter');
    await expect(cell).toHaveText('Y');
    await expect(cell).toHaveAttribute('data-value', 'y');
  });

  test('a combobox cell commits the picked code + label (hc:comboboxselect)', async ({
    page,
  }) => {
    const cell = page.getByTestId('cell-Gamma-1');
    await cell.dblclick();
    await expect(cell.locator('.hc-combobox')).toBeVisible();
    // Drive the combobox's own selection event (full search UI is covered by
    // the combobox specs); this checks the grid's commit path.
    await cell.locator('.hc-combobox').evaluate((el) => {
      el.dispatchEvent(
        new CustomEvent('hc:comboboxselect', {
          bubbles: true,
          detail: { value: '002', label: 'Code B' },
        }),
      );
    });
    await expect(cell).toHaveText('Code B');
    await expect(cell).toHaveAttribute('data-value', '002');
  });

  test('Escape cancels an edit and restores the cell', async ({ page }) => {
    const cell = page.getByTestId('cell-Alpha-3');
    const before = await cell.textContent();
    await cell.dblclick();
    await cell.locator('input').fill('discard me');
    await cell.locator('input').press('Escape');
    await expect(cell).toHaveText(before.trim());
  });
});

test.describe('hc-datagrid — overflow truncation & tooltip', () => {
  test('a clipped cell shows an ellipsis and the full value on hover', async ({
    page,
  }) => {
    const span = page.getByTestId('cell-Delta-1').locator('.hc-datagrid__truncate');
    // The content is clipped (ellipsised) within the fixed-width column.
    expect(await span.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(true);
    expect(await span.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');

    const tip = page.locator('.hc-datagrid__tooltip');
    await expect(tip).toBeHidden();

    await span.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText((await span.textContent()).trim());

    // Moving off the cell hides the tooltip again.
    await page.getByTestId('cell-Epsilon-1').hover();
    await expect(tip).toBeHidden();
  });

  test('a cell that fits does not get a tooltip', async ({ page }) => {
    // Epsilon cells have no truncate wrapper → never a tooltip.
    await page.getByTestId('cell-Epsilon-2').hover();
    await expect(page.locator('.hc-datagrid__tooltip')).toBeHidden();
  });

  test('a cell carrying its own message suppresses the overflow tooltip', async ({ page }) => {
    const cell = page.getByTestId('cell-Delta-1');
    const tip = page.locator('.hc-datagrid__tooltip');
    // Baseline: clipped content, so the overflow tip normally shows.
    await cell.locator('.hc-datagrid__truncate').hover();
    await expect(tip).toBeVisible();
    await page.getByTestId('cell-Epsilon-1').hover();
    await expect(tip).toBeHidden();

    // Server marks the cell as rejected and points at its own message —
    // error wins the gesture; two tooltips on one hover would be a bug.
    await cell.evaluate((el) => {
      el.setAttribute('data-invalid', '');
      el.setAttribute('aria-describedby', 'delta-1-error');
    });
    await cell.locator('.hc-datagrid__truncate').hover();
    await expect(tip).toBeHidden();

    // Focus is the keyboard path — same rule.
    await cell.focus();
    await expect(tip).toBeHidden();
  });
});

test.describe('hc-datagrid — fragment navigation', () => {
  test('a #row hash moves the active cell and focuses it', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('[data-testid="row-9"]').id = 'row-9';
    });
    await page.evaluate(() => {
      window.location.hash = '#row-9';
    });
    const active = await page.evaluate(
      () =>
        document
          .querySelector('.hc-datagrid__cell[data-active]')
          ?.closest('.hc-datagrid__row')
          ?.getAttribute('data-testid') ?? null,
    );
    expect(active).toBe('row-9');
    const focused = await page.evaluate(
      () => document.activeElement?.closest?.('.hc-datagrid__row')?.getAttribute('data-testid') ?? null,
    );
    expect(focused).toBe('row-9');
  });

  test('the landing row is emphasised and clears the sticky header', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('[data-testid="row-9"]').id = 'row-9';
      window.location.hash = '#row-9';
    });
    const row = page.getByTestId('row-9');
    // :target emphasis paints the row's cells.
    const painted = await row
      .locator('.hc-datagrid__cell')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(painted).toContain('linear-gradient');
    // scroll-margin keeps it out from under the sticky header.
    const margin = await row.evaluate(
      (el) => parseFloat(getComputedStyle(el).scrollMarginBlockStart) || 0,
    );
    expect(margin).toBeGreaterThan(0);
  });
});

test.describe('hc-datagrid — multi-row records', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/datagrid-multirow.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
        'grid',
    );
  });

  test('selecting a record marks all of its sub-rows', async ({ page }) => {
    await page.getByTestId('check-1').check();
    const rows = page.getByTestId('rec-1').locator('.hc-datagrid__row');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('rec-1')).toHaveAttribute('data-selected', '');
  });

  test('select-all selects every record', async ({ page }) => {
    await page.getByTestId('select-all').check();
    await expect(page.getByTestId('rec-1')).toHaveAttribute('data-selected', '');
    await expect(page.getByTestId('rec-4')).toHaveAttribute('data-selected', '');
  });

  test('focusing a cell marks its record current and navigates across sub-rows', async ({
    page,
  }) => {
    await page.getByTestId('name-2').focus();
    await expect(page.getByTestId('rec-2')).toHaveAttribute('data-current', '');
    // Down into the second sub-row of the same record, then into record 3.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('rec-2')).toHaveAttribute('data-current', '');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('rec-3')).toHaveAttribute('data-current', '');
    await expect(page.getByTestId('rec-2')).not.toHaveAttribute('data-current', '');
  });

  test('axe finds no violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('[data-testid="grid"]').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-datagrid — vertical headers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/datagrid-vertical.html', { waitUntil: 'domcontentloaded' });
  });

  test('a vertical header rotates its label and keeps the column narrow', async ({
    page,
  }) => {
    const vh = page.getByTestId('vh-1');
    const { writingMode, width, height } = await vh.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { writingMode: cs.writingMode, width: r.width, height: r.height };
    });
    expect(writingMode).toBe('vertical-rl');
    // Despite a very long label the column stays narrow (≈ line height),
    // and the header cell is taller than it is wide.
    expect(width).toBeLessThan(64);
    expect(height).toBeGreaterThan(width);

    // The data column under it is just as narrow.
    const cellWidth = await page
      .getByTestId('vcell-1')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(cellWidth).toBeLessThan(64);
  });

  test('a normal header in the same grid is not rotated', async ({ page }) => {
    const wm = await page
      .getByTestId('h-name')
      .evaluate((el) => getComputedStyle(el).writingMode);
    expect(wm).toBe('horizontal-tb');
  });

  test('data-orientation="sideways" uses sideways-lr and stays narrow', async ({ page }) => {
    const { writingMode, width, height } = await page
      .getByTestId('vh-sideways')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { writingMode: cs.writingMode, width: r.width, height: r.height };
      });
    expect(writingMode).toBe('sideways-lr');
    expect(width).toBeLessThan(64);
    expect(height).toBeGreaterThan(width);
  });
});

test.describe('hc-datagrid — expandable row detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/datagrid-detail.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="grid"] .hc-datagrid__table')
          ?.getAttribute('role') === 'grid',
    );
  });

  test('a collapsed record expands when its toggle is clicked', async ({ page }) => {
    await expect(page.getByTestId('detail-2')).toBeHidden();
    await page.getByTestId('toggle-cell-2').locator('button').click();
    await expect(page.getByTestId('detail-2')).toBeVisible();
    await expect(page.getByTestId('toggle-cell-2').locator('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('an expanded record collapses when its toggle is clicked', async ({ page }) => {
    await expect(page.getByTestId('detail-1')).toBeVisible();
    await page.getByTestId('toggle-cell-1').locator('button').click();
    await expect(page.getByTestId('detail-1')).toBeHidden();
  });

  test('Enter on a toggle cell toggles the detail', async ({ page }) => {
    await page.getByTestId('toggle-cell-2').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('detail-2')).toBeVisible();
  });

  test('a nested grid inside the detail is independent of the outer grid', async ({
    page,
  }) => {
    // The nested grid is upgraded too.
    await expect(
      page.getByTestId('nested').locator('.hc-datagrid__table'),
    ).toHaveAttribute('role', 'grid');
    // Selecting in the nested grid must not select the outer record.
    await page.getByTestId('nested-check').check();
    await expect(page.getByTestId('nested-row')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('rec-1')).not.toHaveAttribute('data-selected', '');
  });

  test('axe finds no violations with a detail expanded', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('[data-testid="grid"]').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-datagrid — column resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/datagrid-resize.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="grid"] .hc-datagrid__table')
          ?.getAttribute('role') === 'grid',
    );
  });

  test('a resize handle is added to resizable headers only', async ({ page }) => {
    await expect(
      page.getByTestId('h-name').locator('.hc-datagrid__resizer'),
    ).toHaveAttribute('role', 'separator');
    expect(
      await page.getByTestId('h-fixed').locator('.hc-datagrid__resizer').count(),
    ).toBe(0);
  });

  test('dragging the handle widens the column and emits the event', async ({ page }) => {
    await page.evaluate(() => {
      window.__resizes = [];
      document
        .querySelector('.hc-datagrid')
        .addEventListener('hc:datagridcolumnresize', (e) => window.__resizes.push(e.detail));
    });
    const cell = page.getByTestId('c-name-1');
    const before = await cell.evaluate((el) => el.getBoundingClientRect().width);
    const box = await page.getByTestId('h-name').locator('.hc-datagrid__resizer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = await cell.evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before + 40);
    const resizes = await page.evaluate(() => window.__resizes);
    expect(resizes.length).toBeGreaterThan(0);
    expect(resizes.at(-1).col).toBe('name');
  });

  test('arrow keys on the handle resize the column', async ({ page }) => {
    const cell = page.getByTestId('c-name-1');
    const before = await cell.evaluate((el) => el.getBoundingClientRect().width);
    await page.getByTestId('h-name').locator('.hc-datagrid__resizer').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    const after = await cell.evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before);
  });

  test('narrowing a column clips its cells', async ({ page }) => {
    await page.getByTestId('h-name').locator('.hc-datagrid__resizer').focus();
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Shift+ArrowLeft');
    }
    const { resized, overflow } = await page.getByTestId('c-name-1').evaluate((el) => ({
      resized: el.hasAttribute('data-resized'),
      overflow: el.scrollWidth > el.clientWidth + 1,
    }));
    expect(resized).toBe(true);
    expect(overflow).toBe(true);
  });

  test('double-click (or Enter) on the grip auto-sizes to the content', async ({ page }) => {
    const handle = page.getByTestId('h-name').locator('.hc-datagrid__resizer');
    // Clip the column hard first…
    await handle.focus();
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.evaluate(() => {
      window.__resizes = [];
      document.querySelector('.hc-datagrid').addEventListener(
        'hc:datagridcolumnresize',
        (e) => window.__resizes.push(e.detail),
      );
    });
    // …then fit-to-content with a double-click on the grip.
    await handle.dblclick();
    const overflow = await page.getByTestId('c-name-1').evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    // The double-click gesture also runs the pointer-cycle emits (a
    // click on the grip is a zero-move drag) — the LAST event carries
    // the auto-sized width.
    const resizes = await page.evaluate(() => window.__resizes);
    expect(resizes.length).toBeGreaterThan(0);
    expect(resizes.at(-1).col).toBe('name');

    // Enter on the focused grip is the keyboard path.
    await page.keyboard.press('Shift+ArrowLeft');
    await handle.focus();
    await page.keyboard.press('Enter');
    const overflowAfterEnter = await page.getByTestId('c-name-1').evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(overflowAfterEnter).toBe(false);
  });

  test('axe finds no violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('[data-testid="grid"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
