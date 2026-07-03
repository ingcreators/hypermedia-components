import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The blessed lazy-tree recipe against real htmx and the
// /mock/tree/:id/children route: a branch with an EMPTY group fetches
// its children on FIRST expand only (`hc:treeexpand once`), shows
// aria-busy while in flight, re-collapse/re-expand does not refetch,
// nested lazy branches in the response recurse, and swapped-in items
// join the keyboard model (roles + roving tabindex re-applied).

let treeRequests;

test.beforeEach(async ({ page }) => {
  treeRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/mock/tree/')) treeRequests.push(req.url());
  });
  await page.goto('/lazy-tree.html');
});

test.describe('lazy-tree recipe', () => {
  test('first expand marks the group busy, then swaps in the children (one request)', async ({ page }) => {
    const group = page.getByTestId('reports-group');
    await page.getByTestId('reports-toggle').click();

    // Busy immediately (spinner via ::before on aria-busy).
    await expect(group).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('reports')).toHaveAttribute('aria-expanded', 'true');

    // Children arrive → busy clears, roles applied by the behavior.
    await expect(page.getByTestId('q1')).toBeVisible();
    await expect(page.getByTestId('summary')).toBeVisible();
    await expect(group).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('q1')).toHaveAttribute('role', 'treeitem');
    expect(treeRequests).toHaveLength(1);
    expect(treeRequests[0]).toContain('/mock/tree/1/children');
  });

  test('re-collapse/re-expand shows the loaded children without refetching (`once`)', async ({ page }) => {
    const toggle = page.getByTestId('reports-toggle');
    await toggle.click(); // expand → fetch
    await expect(page.getByTestId('q1')).toBeVisible();

    await toggle.click(); // collapse
    await expect(page.getByTestId('reports')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('q1')).toBeHidden();

    await toggle.click(); // expand again — no request, children still there
    await expect(page.getByTestId('q1')).toBeVisible();
    expect(treeRequests).toHaveLength(1);
    await expect(page.getByTestId('reports-group')).not.toHaveAttribute('aria-busy', 'true');
  });

  test('keyboard: → opens (fetching) and then descends into the loaded children', async ({ page }) => {
    await page.getByTestId('reports').focus();
    await page.keyboard.press('ArrowRight'); // open → triggers the fetch
    await expect(page.getByTestId('q1')).toBeVisible();

    await page.keyboard.press('ArrowRight'); // descend into the swapped-in child
    await expect(page.getByTestId('q1')).toBeFocused();

    await page.keyboard.press('ArrowDown'); // roving tabindex covers new items
    await expect(page.getByTestId('summary')).toBeFocused();
  });

  test('nested lazy branches in the response load recursively', async ({ page }) => {
    await page.getByTestId('reports-toggle').click();
    await expect(page.getByTestId('q1')).toBeVisible();

    await page.getByTestId('q1-toggle').click();
    await expect(page.getByTestId('q1-group')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('january')).toBeVisible();
    await expect(page.getByTestId('january')).toHaveAttribute('role', 'treeitem');
    expect(treeRequests).toHaveLength(2);
  });

  test('has no axe violations before and after the lazy load', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByTestId('reports-toggle').click();
    await expect(page.getByTestId('q1')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
