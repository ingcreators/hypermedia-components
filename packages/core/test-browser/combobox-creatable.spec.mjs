import { test, expect } from '@playwright/test';

// Creatable (data-allow-create): typing a value not in the list shows a
// synthetic "Create/Add …" option that commits the typed value.
test.beforeEach(async ({ page }) => {
  await page.goto('/combobox-creatable.html');
});

test.describe('combobox creatable', () => {
  test('typing a new value offers a Create option that commits it', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.click();
    await input.fill('Brazil');

    const create = page.getByTestId('cb-list').locator('.hc-combobox__create');
    await expect(create).toBeVisible();
    await expect(create).toContainText('Brazil');

    await create.click();
    await expect(input).toHaveValue('Brazil');

    const detail = await page.evaluate(() => window.__cbSelect);
    expect(detail).toMatchObject({ value: 'Brazil', label: 'Brazil', created: true });
  });

  test('an exact match offers no Create option', async ({ page }) => {
    const input = page.getByTestId('cb-input');
    await input.click();
    await input.fill('Japan');
    await expect(page.getByTestId('cb-list').locator('.hc-combobox__create')).toHaveCount(0);
  });
});

test.describe('multi-combobox creatable', () => {
  test('typing a new value offers an Add option that creates a tag', async ({ page }) => {
    const input = page.getByTestId('mc-input');
    await input.click();
    await input.fill('Kotlin');

    const create = page.getByTestId('mc-list').locator('.hc-multicombobox__create');
    await expect(create).toBeVisible();
    await create.click();

    const tag = page.getByTestId('mc-tags').locator('.hc-multicombobox__tag', { hasText: 'Kotlin' });
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveAttribute('data-value', 'Kotlin');
    // a hidden form input was added for the created value
    await expect(page.getByTestId('mc').locator('input[type="hidden"][value="Kotlin"]')).toHaveCount(1);
  });
});
