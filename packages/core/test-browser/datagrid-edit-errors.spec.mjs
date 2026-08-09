import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-edit-errors.html');
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'grid',
  );
});

async function commitPrice(page, testId, value) {
  const cell = page.getByTestId(testId);
  await cell.dblclick();
  const input = cell.locator('input');
  await input.fill(value);
  await input.press('Enter');
}

test.describe('datagrid-edit-errors recipe', () => {
  test('a rejected commit shows pending, then the 422 record: server value + marked cell + alert', async ({ page }) => {
    await commitPrice(page, 'price-1', 'abc');
    // The optimistic commit is pending while the PATCH is in flight.
    await expect(page.getByTestId('price-1')).toHaveAttribute('data-pending', '');
    await expect(page.getByTestId('price-1')).toHaveAttribute('aria-busy', 'true');

    // The 422 record re-render lands: server value, invalid marking,
    // error row naming the rejected input.
    await expect(page.getByTestId('error-row')).toBeVisible();
    await expect(page.getByTestId('price-1')).toHaveText('18.00');
    await expect(page.getByTestId('price-1')).toHaveAttribute('data-invalid', '');
    await expect(page.getByTestId('price-1')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('price-1')).toHaveAttribute('aria-describedby', 'item-1-error');
    await expect(page.getByTestId('error-msg')).toContainText('"abc" is not a valid price');
    // Pending cleared by the swap.
    await expect(page.getByTestId('price-1')).not.toHaveAttribute('data-pending', /.*/);
  });

  test('a later accepted commit removes the error row atomically', async ({ page }) => {
    await commitPrice(page, 'price-1', 'abc');
    await expect(page.getByTestId('error-row')).toBeVisible();

    await commitPrice(page, 'price-1', '25');
    await expect(page.getByTestId('price-1')).toHaveText('25.00');
    await expect(page.getByTestId('error-row')).toHaveCount(0);
    await expect(page.getByTestId('price-1')).not.toHaveAttribute('data-invalid', /.*/);
  });

  test('an accepted commit confirms with the server formatting and no error', async ({ page }) => {
    await commitPrice(page, 'price-2', '30');
    await expect(page.getByTestId('price-2')).toHaveText('30.00');
    await expect(page.getByTestId('price-2')).toHaveAttribute('data-value', '30');
    await expect(page.getByTestId('error-row')).toHaveCount(0);
  });

  test('no axe violations with the error state shown', async ({ page }) => {
    await commitPrice(page, 'price-1', 'abc');
    await expect(page.getByTestId('error-row')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
