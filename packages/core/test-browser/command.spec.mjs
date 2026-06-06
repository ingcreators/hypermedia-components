import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-command', () => {
  test('Ctrl+K opens the palette and focuses the input', async ({ page }) => {
    const dialog = page.getByTestId('cmd-dialog');
    await expect(dialog).toBeHidden();
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('cmd-input')).toBeFocused();
  });

  test('typing filters items and hides groups that empty out', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByTestId('cmd-input').fill('profile');

    await expect(page.getByTestId('cmd-home')).toBeHidden();
    await expect(page.getByText('Open profile')).toBeVisible();
    // The Actions group has no match → its heading is hidden.
    await expect(page.getByText('Actions')).toBeHidden();
    await expect(page.getByText('Navigation')).toBeVisible();
  });

  test('fuzzy: a non-contiguous subsequence matches', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByTestId('cmd-input').fill('gh'); // G(o) H(ome)
    await expect(page.getByTestId('cmd-home')).toBeVisible();
    await expect(page.getByTestId('cmd-new')).toBeHidden();
  });

  test('fuzzy: the best match floats to the top, even across groups', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByTestId('cmd-input').fill('n');
    // "New document" (Actions, starts with n) outranks "Open profile" (mid-word
    // n) and floats above it; "Go home" has no n and is hidden.
    await expect(page.getByTestId('cmd-home')).toBeHidden();
    const firstVisible = page
      .getByTestId('cmd')
      .locator('[role="option"]:not([hidden])')
      .first();
    await expect(firstVisible).toHaveText(/New document/);
  });

  test('shows the empty state when nothing matches', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByTestId('cmd-input').fill('zzzzz');
    await expect(page.getByTestId('cmd-empty')).toBeVisible();
  });

  test('ArrowDown + Enter runs the active item and closes', async ({ page }) => {
    const dialog = page.getByTestId('cmd-dialog');
    const selected = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.querySelector('.hc-command').addEventListener(
            'hc:commandselect',
            (e) => resolve(e.detail.value),
            { once: true },
          );
        }),
    );

    await page.keyboard.press('Control+k');
    await page.keyboard.press('ArrowDown'); // home → profile
    await page.keyboard.press('Enter');

    expect(await selected).toBe('profile');
    await expect(dialog).toBeHidden();
  });

  test('clicking an item runs it and closes', async ({ page }) => {
    const dialog = page.getByTestId('cmd-dialog');
    await page.keyboard.press('Control+k');
    await page.getByTestId('cmd-new').click();
    await expect(dialog).toBeHidden();
  });

  test('renders the keyboard shortcut chip', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('cmd-home').locator('.hc-command__shortcut')).toHaveText('G H');
  });

  test('Escape closes the palette (native dialog)', async ({ page }) => {
    const dialog = page.getByTestId('cmd-dialog');
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('axe finds no violations with the palette open', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('cmd-dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('#section-command')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
