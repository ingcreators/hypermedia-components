import { test, expect } from '@playwright/test';

// Remote (async) combobox: htmx owns fetching/filtering; the behavior surfaces
// the loading / empty / error states and disables client-side filtering. We
// drive the htmx request lifecycle synthetically (no htmx in the test env).
test.beforeEach(async ({ page }) => {
  await page.goto('/combobox-remote.html');
  await page.getByTestId('rc-input').focus();
});

const fire = (page, type, detail) =>
  page.evaluate(([t, d]) => window.hcFire(t, d), [type, detail ?? null]);
const swap = (page, labels) => page.evaluate((l) => window.hcSwap(l), labels);

test.describe('combobox remote (async)', () => {
  test('a request shows the loading row with a spinner', async ({ page }) => {
    await fire(page, 'htmx:beforeRequest');
    const loading = page.getByTestId('rc-list').locator('.hc-combobox__loading');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveText(/.+/);
    await expect(page.getByTestId('rc-list')).toHaveAttribute('aria-busy', 'true');

    const spinner = await loading.evaluate(
      (el) => getComputedStyle(el, '::before').animationName,
    );
    expect(spinner).toBe('hc-combobox-spin');
  });

  test('a successful response shows options and activates the first', async ({ page }) => {
    await fire(page, 'htmx:beforeRequest');
    await swap(page, ['Tokyo', 'Osaka', 'Kyoto']);
    await fire(page, 'htmx:afterRequest', { failed: false });

    const list = page.getByTestId('rc-list');
    await expect(list.locator('.hc-combobox__loading')).toHaveCount(0);
    await expect(list.locator('.hc-combobox__option')).toHaveCount(3);
    await expect(list.locator('.hc-combobox__option[data-active="true"]')).toHaveText('Tokyo');
    await expect(list).not.toHaveAttribute('aria-busy', 'true');
  });

  test('an empty response shows the empty marker', async ({ page }) => {
    await fire(page, 'htmx:beforeRequest');
    await fire(page, 'htmx:afterRequest', { failed: false }); // no options swapped in
    const list = page.getByTestId('rc-list');
    await expect(list.locator('.hc-combobox__empty')).toBeVisible();
    await expect(list.locator('.hc-combobox__loading')).toHaveCount(0);
  });

  test('a failed request shows the error row', async ({ page }) => {
    await fire(page, 'htmx:beforeRequest');
    await fire(page, 'htmx:afterRequest', { failed: true });
    const list = page.getByTestId('rc-list');
    await expect(list.locator('.hc-combobox__error')).toBeVisible();
    await expect(list).toHaveAttribute('data-error', '');
  });

  test('typing does not hide options (server owns filtering)', async ({ page }) => {
    await swap(page, ['Tokyo', 'Osaka']);
    await page.getByTestId('rc-input').fill('zzz');
    const list = page.getByTestId('rc-list');
    await expect(list.locator('.hc-combobox__option')).toHaveCount(2);
    // none were hidden by a client-side filter
    const hidden = await list
      .locator('.hc-combobox__option[hidden]')
      .count();
    expect(hidden).toBe(0);
  });
});
