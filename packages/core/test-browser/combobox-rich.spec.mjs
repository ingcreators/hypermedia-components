import { test, expect } from '@playwright/test';

// Rich options (icon + label + description): `data-search` is the filter
// haystack and `data-label` is the clean value used in the input / tag.
test.beforeEach(async ({ page }) => {
  await page.goto('/combobox-rich.html');
});

test.describe('combobox rich options', () => {
  test('filters by a data-search alias and commits data-label', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.click();
    await input.fill('nippon'); // alias only in data-search

    await expect(page.getByTestId('o-jp')).toBeVisible();
    await expect(page.getByTestId('o-us')).toBeHidden();

    await page.getByTestId('o-jp').click();
    await expect(input).toHaveValue('Japan'); // data-label, not "Japan Asia"
  });

  test('search uses data-search exclusively (visible-only text does not match)', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.click();
    await input.fill('asia'); // in the visible text, not in data-search
    await expect(page.getByTestId('o-jp')).toBeHidden();
  });
});

test.describe('multi-combobox rich options', () => {
  test('filters by data-search alias and tags with data-label', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.click();
    await input.fill('snake'); // alias only in data-search

    await expect(page.getByTestId('o-py')).toBeVisible();
    await page.getByTestId('o-py').click();

    const tag = page.getByTestId('mc-tags').locator('.hc-multicombobox__tag[data-value="py"]');
    await expect(tag).toHaveCount(1);
    await expect(tag).toContainText('Python');
    await expect(tag).not.toContainText('scripting');
  });
});
