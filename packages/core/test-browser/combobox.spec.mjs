import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-combobox', () => {
  test('focusing the input opens the listbox and aria-expanded flips', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    const list = page.getByTestId('cb-listbox');
    await input.focus();
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  test('typing filters options by substring (case-insensitive)', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await input.fill('uni');

    await expect(page.getByTestId('cb-opt-us')).toBeVisible();
    await expect(page.getByTestId('cb-opt-gb')).toBeVisible();
    await expect(page.getByTestId('cb-opt-jp')).toBeHidden();
    await expect(page.getByTestId('cb-opt-fr')).toBeHidden();
  });

  test('ArrowDown moves aria-activedescendant through visible options', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    // Open positions active on the first option (Japan).
    await expect(input).toHaveAttribute('aria-activedescendant', 'cb-jp');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'cb-us');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'cb-gb');
  });

  test('Enter on the active option selects it, fills the input, and closes the listbox', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    const list = page.getByTestId('cb-listbox');
    await input.focus();
    await page.keyboard.press('ArrowDown'); // active = us
    await page.keyboard.press('Enter');

    await expect(input).toHaveValue('United States');
    await expect(list).toBeHidden();
    await expect(page.getByTestId('cb-selected')).toHaveAttribute('data-value', 'us');
  });

  test('clicking an option selects it', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await page.getByTestId('cb-opt-fr').click();

    await expect(input).toHaveValue('France');
    await expect(page.getByTestId('cb-selected')).toHaveAttribute('data-value', 'fr');
  });

  test('Escape closes the listbox without changing the input value', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    const list = page.getByTestId('cb-listbox');
    await input.focus();
    await input.fill('jap');
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(input).toHaveValue('jap');
  });

  test('aria-disabled options are not selectable', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await page.getByTestId('cb-opt-de').click({ force: true });
    // Selection did not fire — input stays empty, listbox stays open.
    await expect(input).toHaveValue('');
  });

  test('no-match input shows the empty marker', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.focus();
    await input.fill('zzz');
    const empty = page.getByTestId('cb-listbox').locator('.hc-combobox__empty');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText('No matches');
  });

  test('axe finds no violations in the combobox section (open state)', async ({ page }) => {
    await page.getByTestId('cb-input').focus();
    const results = await new AxeBuilder({ page })
      .include('#section-combobox')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
