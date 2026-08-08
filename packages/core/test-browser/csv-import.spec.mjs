import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/csv-import.html');
});

/** Upload an in-memory CSV through the file input. */
async function upload(page, csv) {
  await page.getByTestId('csv').setInputFiles({
    name: 'items.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByTestId('upload').click();
}

test.describe('csv-import recipe', () => {
  test('an all-valid upload reports the count and commits via the tokened form', async ({ page }) => {
    await upload(page, 'name,qty\nAnvil,3\nSprocket,12\n');
    const report = page.getByTestId('report');
    await expect(report).toContainText('2 rows ready to import.');
    // Phase 1 imported nothing — the report only OFFERS the commit.
    const confirm = report.getByRole('button', { name: 'Import the valid 2 rows' });
    await expect(confirm).toBeVisible();
    await expect(report.locator('input[type="hidden"][name="token"]')).toHaveCount(1);

    await confirm.click();
    await expect(report).toContainText('2 rows imported.');
    await expect(confirm).toBeHidden(); // the result replaced the report
    await expect(page.locator('[data-hc-toast-region]')).toContainText('2 rows imported');
  });

  test('invalid rows land in a real error table and only the valid ones are offered', async ({ page }) => {
    await upload(page, 'name,qty\nAnvil,3\nWidget,zero\n,4\n');
    const report = page.getByTestId('report');
    await expect(report).toContainText('1 of 3 rows ready');
    await expect(report.locator('caption')).toHaveText('Rows that will not be imported');
    await expect(report.locator('tbody th[scope="row"]')).toHaveText(['3', '4']);
    await expect(report).toContainText('qty must be a positive integer');
    await expect(report).toContainText('name is required');
    await expect(report.getByRole('button', { name: 'Import the valid 1 row' })).toBeVisible();
  });

  test('a nothing-valid upload answers 422 with no confirm form', async ({ page }) => {
    await upload(page, 'name,qty\n,0\n');
    const report = page.getByTestId('report');
    await expect(report).toContainText('0 of 1 rows ready');
    await expect(report.getByRole('button')).toHaveCount(0);
  });

  test('a consumed token answers 409 with the re-upload hint (single-shot)', async ({ page }) => {
    await page.getByTestId('stale-commit').click();
    await expect(page.getByTestId('report')).toContainText('upload the file again');
  });

  test('no axe violations with a mixed report shown', async ({ page }) => {
    await upload(page, 'name,qty\nAnvil,3\nWidget,zero\n');
    await expect(page.getByTestId('report')).toContainText('1 of 2 rows ready');
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
