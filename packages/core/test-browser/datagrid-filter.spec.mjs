import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-filter.html');
  // The grid loads its unfiltered render on first paint.
  await expect(page.getByTestId('trigger')).toBeVisible();
});

test.describe('datagrid-filter recipe', () => {
  test('Apply filters the rows and marks the trigger data-filtered', async ({ page }) => {
    const grid = page.getByTestId('grid');
    await expect(grid).toContainText('Billing export');

    await page.getByTestId('trigger').click();
    await page.getByTestId('cb-active').check();
    await page.getByTestId('apply').click();

    await expect(grid).toContainText('Ingest pipeline');
    await expect(grid).toContainText('Nightly backup');
    await expect(grid).not.toContainText('Billing export');
    await expect(grid).not.toContainText('Legacy sync');
    // The trigger rides back inside the fragment, filtered + labeled.
    await expect(page.getByTestId('trigger')).toHaveAttribute('data-filtered', '');
    await expect(page.getByTestId('trigger')).toHaveAttribute(
      'aria-label',
      'Filter Status — active: Active',
    );
    // Any 2xx closes the popover (data-hc-close-popover-on-success).
    await expect(page.locator('#filter-status-popover')).toBeHidden();
  });

  test('the OOB fieldset re-render keeps the checked states matching', async ({ page }) => {
    await page.getByTestId('trigger').click();
    await page.getByTestId('cb-pending').check();
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('grid')).not.toContainText('Ingest pipeline');

    // Reopen: the server-rendered fieldset mirrors the filter.
    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('cb-pending')).toBeChecked();
    await expect(page.getByTestId('cb-active')).not.toBeChecked();
    await expect(page.getByTestId('cb-failed')).not.toBeChecked();
  });

  test('unchecking everything sends no params and the full list returns', async ({ page }) => {
    await page.getByTestId('trigger').click();
    await page.getByTestId('cb-failed').check();
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('grid')).not.toContainText('Ingest pipeline');

    await page.getByTestId('trigger').click();
    await page.getByTestId('cb-failed').uncheck();
    await page.getByTestId('apply').click();

    await expect(page.getByTestId('grid')).toContainText('Ingest pipeline');
    await expect(page.getByTestId('grid')).toContainText('Legacy sync');
    await expect(page.getByTestId('trigger')).not.toHaveAttribute('data-filtered', '');
  });

  test('no axe violations, including with the filter open', async ({ page }) => {
    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('filter-form')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
