import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-edit-conflict.html');
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

async function commitPrice(page, value) {
  const cell = page.getByTestId('price-cell');
  await cell.dblclick();
  const input = cell.locator('input');
  await input.fill(value);
  await input.press('Enter');
}

test.describe('datagrid-edit-conflict recipe', () => {
  test('a stale commit 409s into the conflict presentation', async ({ page }) => {
    await commitPrice(page, '22');
    await expect(page.getByTestId('conflict-row')).toBeVisible();
    // Theirs in the cell, error tone on the row, fresh version on the record.
    await expect(page.getByTestId('price-cell')).toHaveText('20.00');
    await expect(page.getByTestId('row-1')).toHaveAttribute('data-attention', 'error');
    await expect(page.getByTestId('record-1')).toHaveAttribute('data-version', '4');
    // The alert names both values.
    await expect(page.getByTestId('conflict-msg')).toContainText('another user saved 20.00');
    await expect(page.getByTestId('conflict-msg')).toContainText('Your value: 22');
  });

  test('Overwrite re-submits yours against the fresh version and wins', async ({ page }) => {
    await commitPrice(page, '22');
    await page.getByTestId('overwrite').click();
    await expect(page.getByTestId('conflict-row')).toHaveCount(0);
    await expect(page.getByTestId('price-cell')).toHaveText('22.00');
    await expect(page.getByTestId('record-1')).toHaveAttribute('data-version', '5');
    await expect(page.getByTestId('row-1')).not.toHaveAttribute('data-attention', /.*/);
  });

  test('Discard keeps theirs and clears the conflict', async ({ page }) => {
    await commitPrice(page, '22');
    await page.getByTestId('discard').click();
    await expect(page.getByTestId('conflict-row')).toHaveCount(0);
    await expect(page.getByTestId('price-cell')).toHaveText('20.00');
    await expect(page.getByTestId('record-1')).toHaveAttribute('data-version', '4');
  });

  test('the next ordinary edit after a conflict is already un-stale', async ({ page }) => {
    await commitPrice(page, '22'); // 409, record now carries version 4
    await expect(page.getByTestId('conflict-row')).toBeVisible();
    await commitPrice(page, '31'); // ordinary edit against version 4 → 200
    await expect(page.getByTestId('conflict-row')).toHaveCount(0);
    await expect(page.getByTestId('price-cell')).toHaveText('31.00');
    await expect(page.getByTestId('record-1')).toHaveAttribute('data-version', '5');
  });

  test('no axe violations with the conflict shown', async ({ page }) => {
    await commitPrice(page, '22');
    await expect(page.getByTestId('conflict-row')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
