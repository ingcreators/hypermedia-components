import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-columns.html');
});

test.describe('datagrid-columns recipe', () => {
  test('Apply re-renders the grid with exactly the chosen columns', async ({ page }) => {
    const headcells = page.getByTestId('grid').locator('.hc-datagrid__headcell');
    await expect(headcells).toHaveText(['Name', 'Status', 'Owner', 'Updated']);

    await page.getByTestId('open').click();
    await page.getByTestId('cb-owner').uncheck();
    await page.getByTestId('cb-updated').uncheck();
    await page.getByTestId('apply').click();

    await expect(headcells).toHaveText(['Name', 'Status']);
    // The dropped columns' cells are gone too — header and rows change
    // together because the whole grid is one fragment.
    await expect(page.getByTestId('grid')).not.toContainText('Ada');
    await expect(page.getByTestId('grid')).toContainText('Ingest pipeline');
    // Any 2xx closes the popover (data-hc-close-popover-on-success).
    await expect(page.locator('#cols-popover')).toBeHidden();
  });

  test('the OOB chooser re-render keeps the checked states matching', async ({ page }) => {
    await page.getByTestId('open').click();
    await page.getByTestId('cb-owner').uncheck();
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('grid').locator('.hc-datagrid__headcell')).toHaveText([
      'Name',
      'Status',
      'Updated',
    ]);

    // Reopen: the server-rendered chooser mirrors the grid.
    await page.getByTestId('open').click();
    await expect(page.getByTestId('cb-owner')).not.toBeChecked();
    await expect(page.getByTestId('cb-name')).toBeChecked();
    await expect(page.getByTestId('cb-status')).toBeChecked();
    await expect(page.getByTestId('cb-updated')).toBeChecked();
  });

  test('unchecking everything sends no cols and the default set returns', async ({ page }) => {
    const headcells = page.getByTestId('grid').locator('.hc-datagrid__headcell');
    await page.getByTestId('open').click();
    for (const key of ['name', 'status', 'owner', 'updated']) {
      await page.getByTestId(`cb-${key}`).uncheck();
    }
    await page.getByTestId('apply').click();

    // Absent cols= is the default-set branch, and the chooser comes
    // back fully checked to match.
    await expect(headcells).toHaveText(['Name', 'Status', 'Owner', 'Updated']);
    await page.getByTestId('open').click();
    await expect(page.getByTestId('cb-owner')).toBeChecked();
  });

  test('reordering the chooser reorders the grid (submitted order wins)', async ({ page }) => {
    await page.getByTestId('open').click();
    // Keyboard grammar: grab the Status handle, move it above Name, drop.
    const handle = page.getByTestId('handle-status');
    await handle.focus();
    await page.keyboard.press('Space'); // grab
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space'); // drop
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('grid').locator('.hc-datagrid__headcell')).toHaveText([
      'Status',
      'Name',
      'Owner',
      'Updated',
    ]);
    // The OOB chooser mirrors the new order too.
    await page.getByTestId('open').click();
    const first = page.getByTestId('chooser-fields').locator('label').first();
    await expect(first).toContainText('Status');
  });

  test('no axe violations, including with the chooser open', async ({ page }) => {
    await page.getByTestId('open').click();
    await expect(page.getByTestId('chooser')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
