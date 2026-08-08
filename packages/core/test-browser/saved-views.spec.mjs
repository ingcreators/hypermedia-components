import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/saved-views.html');
});

/** Filter for beans/active, then save the result as "Quarterly". */
async function saveQuarterly(page) {
  await page.getByTestId('q').fill('beans');
  await page.getByTestId('status').selectOption('active');
  await page.getByTestId('filter-apply').click();
  await expect(page.getByTestId('results')).toContainText('Beans forecast');
  await page.getByTestId('name').fill('Quarterly');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('views').getByRole('link', { name: 'Quarterly' })).toBeVisible();
}

test.describe('saved-views recipe', () => {
  test('saving the current filters mints a chip marked current', async ({ page }) => {
    await saveQuarterly(page);
    const chip = page.getByTestId('views').getByRole('link', { name: 'Quarterly' });
    await expect(chip).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('views')).not.toContainText('No saved views yet');
  });

  test('applying a chip fills the filter controls — a view is never opaque', async ({ page }) => {
    await saveQuarterly(page);
    // Drift the form away from the view…
    await page.getByTestId('q').fill('zzz');
    await page.getByTestId('status').selectOption('failed');
    await page.getByTestId('filter-apply').click();
    await expect(page.getByTestId('results')).toContainText('No items match');
    // …then apply the view: the results AND the controls come back.
    await page.getByTestId('views').getByRole('link', { name: 'Quarterly' }).click();
    await expect(page.getByTestId('results')).toContainText('Beans forecast');
    await expect(page.getByTestId('q')).toHaveValue('beans');
    await expect(page.getByTestId('status')).toHaveValue('active');
    // The OOB re-render kept the id, so the label still points at it.
    await expect(page.getByLabel('Search')).toHaveValue('beans');
  });

  test('deleting a chip answers the strip without it', async ({ page }) => {
    await saveQuarterly(page);
    await page.getByRole('button', { name: 'Delete view Quarterly' }).click();
    await expect(page.getByTestId('views').getByRole('link', { name: 'Quarterly' })).toBeHidden();
    await expect(page.getByTestId('views')).toContainText('No saved views yet');
  });

  test('a duplicate name 422s with an inline field error and keeps the strip', async ({ page }) => {
    await saveQuarterly(page);
    await page.getByTestId('name').fill('Quarterly');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('views')).toContainText('already exists');
    await expect(page.getByTestId('views').getByRole('link', { name: 'Quarterly' })).toHaveCount(1);
  });

  test('no axe violations with a saved chip and results shown', async ({ page }) => {
    await saveQuarterly(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
