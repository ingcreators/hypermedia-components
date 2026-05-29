import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-multicombobox', () => {
  test('renders the initial aria-selected option as a tag + hidden input', async ({ page }) => {
    const tags = page.getByTestId('mc-tags').locator('.hc-multicombobox__tag');
    await expect(tags).toHaveCount(1);
    await expect(tags.first()).toHaveText(/Python/);
    const hidden = page.getByTestId('mc-wrap').locator('input[type="hidden"][name="languages"]');
    await expect(hidden).toHaveCount(1);
    await expect(hidden).toHaveValue('py');
  });

  test('focusing the input opens the listbox with aria-multiselectable', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    const list = page.getByTestId('mc-listbox');
    await input.focus();
    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  test('clicking an option adds a tag and keeps the listbox open', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    const list = page.getByTestId('mc-listbox');
    await input.focus();
    await page.getByTestId('mc-opt-js').click();

    await expect(list).toBeVisible();
    await expect(page.getByTestId('mc-tags').locator('.hc-multicombobox__tag')).toHaveCount(2);
    await expect(page.getByTestId('mc-state')).toHaveAttribute('data-values', 'py,js');
  });

  test('clicking an already-selected option toggles it off', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.focus();
    await page.getByTestId('mc-opt-py').click();

    await expect(page.getByTestId('mc-tags').locator('.hc-multicombobox__tag')).toHaveCount(0);
    await expect(page.getByTestId('mc-state')).toHaveAttribute('data-values', '');
  });

  test('clicking the × on a tag removes it', async ({ page }) => {
    const tagsContainer = page.getByTestId('mc-tags');
    await tagsContainer
      .locator('.hc-multicombobox__tag[data-value="py"] .hc-multicombobox__tag-remove')
      .click();
    await expect(tagsContainer.locator('.hc-multicombobox__tag')).toHaveCount(0);
  });

  test('Backspace on an empty input removes the last tag', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.focus();
    // Add JS and Go so we have three tags total.
    await page.getByTestId('mc-opt-js').click();
    await page.getByTestId('mc-opt-go').click();
    await expect(page.getByTestId('mc-tags').locator('.hc-multicombobox__tag')).toHaveCount(3);

    // Input is empty after each toggle (filter reset) — Backspace
    // removes the last tag in insertion order (Go).
    await input.focus();
    await page.keyboard.press('Backspace');
    const remaining = page.getByTestId('mc-tags').locator('.hc-multicombobox__tag');
    await expect(remaining).toHaveCount(2);
    await expect(remaining.last()).toHaveAttribute('data-value', 'js');
  });

  test('typing filters the listbox', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.focus();
    await input.fill('script');
    await expect(page.getByTestId('mc-opt-js')).toBeVisible();
    await expect(page.getByTestId('mc-opt-ts')).toBeVisible();
    await expect(page.getByTestId('mc-opt-py')).toBeHidden();
  });

  test('axe finds no violations in the open multicombobox', async ({ page }) => {
    await page.getByTestId('mc-input').focus();
    const results = await new AxeBuilder({ page })
      .include('#section-multicombobox')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
