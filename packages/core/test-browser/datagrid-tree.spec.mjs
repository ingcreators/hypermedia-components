import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/datagrid-tree.html');
  await page.waitForFunction(
    () =>
      document.querySelector('.hc-datagrid__table')?.getAttribute('role') ===
      'treegrid',
  );
});

test.describe('datagrid-tree recipe', () => {
  test('first expand loads the children after the parent, one level deeper', async ({ page }) => {
    await page.getByTestId('toggle-docs').click();
    await expect(page.getByTestId('node-docs-guide')).toBeVisible();
    await expect(page.getByTestId('node-docs-api')).toBeVisible();
    await expect(page.getByTestId('node-docs')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('node-docs')).not.toHaveAttribute('aria-busy', /.+/);
    await expect(page.getByTestId('node-docs-guide')).toHaveAttribute('aria-level', '2');
    // Inserted right after the parent — before the src root.
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('.hc-datagrid__body > tr')].map(
        (tr) => tr.getAttribute('data-testid'),
      ),
    );
    expect(ids.indexOf('node-docs-guide')).toBe(ids.indexOf('node-docs') + 1);
    expect(ids.indexOf('node-docs-api')).toBeLessThan(ids.indexOf('node-src'));
  });

  test('collapse hides the subtree; re-expand shows it without a second request', async ({ page }) => {
    let requests = 0;
    await page.route('**/mock/datagrid-tree/**', (route) => {
      requests += 1;
      route.continue();
    });
    await page.getByTestId('toggle-docs').click();
    await expect(page.getByTestId('node-docs-guide')).toBeVisible();
    expect(requests).toBe(1);

    await page.getByTestId('toggle-docs').click(); // collapse
    await expect(page.getByTestId('node-docs-guide')).toBeHidden();
    await page.getByTestId('toggle-docs').click(); // re-expand
    await expect(page.getByTestId('node-docs-guide')).toBeVisible();
    expect(requests).toBe(1); // data-loaded — no refetch
  });

  test('a nested lazy dir loads level-3 children from its own parent', async ({ page }) => {
    await page.getByTestId('toggle-docs').click();
    await page.getByTestId('node-docs-guide').locator('[data-hc-datagrid-tree]').click();
    await expect(page.getByTestId('node-docs-guide-intro')).toBeVisible();
    await expect(page.getByTestId('node-docs-guide-intro')).toHaveAttribute('aria-level', '3');
  });

  test('an empty dir answers the empty-state row', async ({ page }) => {
    await page.getByTestId('toggle-src').click();
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('node-src')).not.toHaveAttribute('aria-busy', /.+/);
  });

  test('Enter on the lead cell toggles the row', async ({ page }) => {
    await page.getByTestId('node-docs-cell').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('node-docs')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('node-docs-guide')).toBeVisible();
  });

  test('no axe violations with an expanded tree', async ({ page }) => {
    await page.getByTestId('toggle-docs').click();
    await expect(page.getByTestId('node-docs-guide')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
