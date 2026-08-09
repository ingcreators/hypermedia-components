import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-bulk-errors.html');
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

const select = async (page, ids) => {
  for (const id of ids) await page.getByTestId(`cb-${id}`).check();
};

test.describe('datagrid-bulk-errors — best-effort', () => {
  test('marks the failed rows and reports them grouped by reason', async ({ page }) => {
    await select(page, [101, 102, 107]);
    await page.getByTestId('archive').click();

    await expect(page.getByTestId('summary')).toContainText('1 succeeded / 2 failed');
    // What actually happened is what the rows show.
    await expect(page.getByTestId('status-101')).toContainText('Archived');
    await expect(page.getByTestId('row-102')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('row-107')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('row-101')).not.toHaveAttribute('data-attention', /.*/);
    // Both reasons are named, and the retry is a filter link.
    await expect(page.getByTestId('report')).toContainText('Already shipped');
    await expect(page.getByTestId('report')).toContainText('Not permitted');
    await expect(page.getByTestId('filter-failed')).toBeVisible();
  });

  test('a partial failure leaves the retry set selected and the bar up', async ({
    page,
  }) => {
    await select(page, [101, 104, 102]);
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('summary')).toContainText('1 succeeded / 2 failed');

    // 104 failed transiently — still selected, so the bar survives and
    // the next press applies to it alone. Re-selecting failures by hand
    // out of a full grid is exactly what this avoids.
    await expect(page.getByTestId('cb-104')).toBeChecked();
    await expect(page.getByTestId('cb-101')).not.toBeChecked(); // succeeded
    await expect(page.getByTestId('cb-102')).not.toBeChecked(); // cannot succeed
    await expect(page.getByTestId('bar')).toBeVisible();

    // Pressing again really does retry only the retry set.
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('summary')).toContainText('0 succeeded / 1 failed');
  });

  test('a report entry jumps to its row and moves the active cell there', async ({ page }) => {
    await select(page, [101, 102]);
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('jump-102')).toBeVisible();

    await page.getByTestId('jump-102').click();
    // The hash lands, then the behavior moves the active cell — assert
    // with retries rather than reading synchronously after the click.
    await expect(
      page.getByTestId('row-102').locator('.hc-datagrid__cell').first(),
    ).toHaveAttribute('data-active', '');
    // Back returns to the report the user came from (the row link made
    // a history entry) — no inline link is added to the cell.
    await page.goBack();
    await expect(page.getByTestId('report')).toBeVisible();
  });

  test('marking a row failed does not change the column width', async ({ page }) => {
    const width = () =>
      page.getByTestId('status-101').evaluate((el) => el.getBoundingClientRect().width);
    const tableWidth = () =>
      page.evaluate(
        () => document.querySelector('.hc-datagrid__table').getBoundingClientRect().width,
      );
    const before = { cell: await width(), table: await tableWidth() };

    // Only failing rows, so no cell TEXT changes ("Active" stays
    // "Active") — any width delta would be the markers' doing.
    await select(page, [102, 107]);
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('row-102')).toHaveAttribute('data-attention', 'error');

    // The marker and the tooltip are drawn at zero layout cost: a
    // fixed-width column must not grow (nor clip its value) because a
    // row failed.
    expect(Math.abs((await width()) - before.cell)).toBeLessThan(2);
    expect(Math.abs((await tableWidth()) - before.table)).toBeLessThan(2);
    // The marker is really there.
    const marker = await page
      .getByTestId('status-102')
      .evaluate((el) => getComputedStyle(el, '::after').borderTopWidth);
    expect(parseFloat(marker)).toBeGreaterThan(0);
  });

  test('a failed cell owns the hover: the overflow tooltip stays away', async ({ page }) => {
    await select(page, [102]);
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('row-102')).toHaveAttribute('data-attention', 'error');
    await page.getByTestId('status-102').hover();
    await expect(page.locator('.hc-datagrid__tooltip')).toBeHidden();
  });
});

test.describe('datagrid-bulk-errors — atomic', () => {
  test('pre-flight reports executability and offers to exclude the blockers', async ({ page }) => {
    await select(page, [101, 102, 103]);
    await page.getByTestId('preflight').click();
    await expect(page.getByTestId('preflight-summary')).toContainText('2 of 3 rows are executable');
    await expect(page.getByTestId('exclude-run')).toContainText('Exclude 1 and run 2');

    await page.getByTestId('exclude-run').click();
    await expect(page.getByTestId('status-101')).toContainText('Posted');
    await expect(page.getByTestId('status-103')).toContainText('Posted');
    await expect(page.getByTestId('status-102')).toContainText('Active');
  });

  test('pre-flight marks the blocked rows so the report links land somewhere', async ({
    page,
  }) => {
    await select(page, [101, 102, 104]);
    await page.getByTestId('preflight').click();
    await expect(page.getByTestId('preflight-summary')).toBeVisible();

    // Marked because they cannot proceed — a fact about the ROW, true
    // before the action runs as much as after. Nothing claims they
    // failed: no status changed.
    await expect(page.getByTestId('row-102')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('row-104')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('row-101')).not.toHaveAttribute('data-attention', /.*/);
    await expect(page.getByTestId('status-102')).toContainText('Active');

    // The OOB row updates must not disturb the selection the user is
    // about to act on.
    await expect(page.getByTestId('cb-102')).toBeChecked();
    await expect(page.getByTestId('cb-104')).toBeChecked();
    await expect(page.getByTestId('bar')).toBeVisible();
  });

  test('pre-flight with nothing executable is a visible dead end', async ({ page }) => {
    await select(page, [102, 107]);
    await page.getByTestId('preflight').click();
    await expect(page.getByTestId('preflight-dead-end')).toBeVisible();
    await expect(page.getByTestId('exclude-run')).toHaveCount(0);
  });

  test('a refusal leaves the rows unchanged AND keeps the selection', async ({ page }) => {
    await select(page, [101, 102]);
    await page.getByTestId('post-anyway').click();

    await expect(page.getByTestId('refusal')).toContainText('Nothing was executed');
    // Nothing ran, so no status changed — claiming a FAILURE would lie.
    await expect(page.getByTestId('status-101')).toContainText('Active');
    // But the blocked row is why nothing ran, and saying so is true.
    await expect(page.getByTestId('row-102')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('row-101')).not.toHaveAttribute('data-attention', /.*/);
    // The hand-picked selection survives the refusal.
    await expect(page.getByTestId('cb-101')).toBeChecked();
    await expect(page.getByTestId('cb-102')).toBeChecked();
    await expect(page.getByTestId('cb-103')).not.toBeChecked();
    // …and the actions bar is therefore still available.
    await expect(page.getByTestId('bar')).toBeVisible();
  });

  test('no axe violations with the report shown', async ({ page }) => {
    await select(page, [101, 102]);
    await page.getByTestId('archive').click();
    await expect(page.getByTestId('summary')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
