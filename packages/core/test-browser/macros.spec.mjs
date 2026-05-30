import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('<hc-confirm-action>', () => {
  test('upgrades to .hc-action > .hc-button + .hc-spinner', async ({ page }) => {
    const macro = page.getByTestId('macro-confirm');
    await expect(macro).toHaveAttribute('data-hc-upgraded', 'true');

    const wrapper = macro.locator('.hc-action');
    await expect(wrapper).toBeVisible();
    await expect(wrapper.locator('button.hc-button')).toBeVisible();
    await expect(wrapper.locator('.hc-spinner.htmx-indicator')).toHaveCount(1);
  });

  test('wires the expanded htmx attributes', async ({ page }) => {
    const button = page.getByTestId('macro-confirm').locator('button');
    await expect(button).toHaveAttribute('data-hx-delete', '/items/99');
    await expect(button).toHaveAttribute('data-hx-trigger', 'hc:confirmed');
    await expect(button).toHaveAttribute('data-hx-target', 'closest tr');
    await expect(button).toHaveAttribute('data-hx-swap', 'outerHTML');
    await expect(button).toHaveAttribute('data-hc-confirm', 'Macro delete?');
    await expect(button).toHaveAttribute('data-variant', 'error');
  });

  test('clicking the upgraded button opens the shared confirm dialog', async ({ page }) => {
    const macro = page.getByTestId('macro-confirm');
    await macro.locator('button').click();

    const dialog = page.locator('.hc-confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#hc-confirm-message')).toHaveText('Macro delete?');
  });
});

test.describe('<hc-live-search>', () => {
  test('upgrades to a search form with label and submit', async ({ page }) => {
    const macro = page.getByTestId('macro-search');
    await expect(macro).toHaveAttribute('data-hc-upgraded', 'true');

    const form = macro.locator('form.hc-search');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('role', 'search');
    await expect(form).toHaveAttribute('action', '/search');

    await expect(form.locator('label.hc-field__label')).toHaveText('Find items');
    await expect(form.locator('button[type="submit"]')).toHaveText('Find');
  });

  test('wires htmx attributes on the input with the configured delay', async ({ page }) => {
    const input = page.getByTestId('macro-search').locator('input.hc-input');
    await expect(input).toHaveAttribute('data-hx-get', '/search');
    await expect(input).toHaveAttribute('data-hx-trigger', 'input changed delay:150ms, search');
    await expect(input).toHaveAttribute('data-hx-target', '#macro-results');
    await expect(input).toHaveAttribute('data-hx-swap', 'innerHTML');
    await expect(input).toHaveAttribute('data-hx-sync', 'closest form:replace');
  });

  test('label has a matching for= referencing the input id', async ({ page }) => {
    const macro = page.getByTestId('macro-search');
    const labelFor = await macro.locator('label').getAttribute('for');
    const inputId = await macro.locator('input').getAttribute('id');
    expect(labelFor).toBeTruthy();
    expect(labelFor).toBe(inputId);
  });
});
