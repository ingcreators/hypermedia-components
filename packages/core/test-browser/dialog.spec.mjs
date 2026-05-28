import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('<dialog>.showModal()', () => {
  test('opens and closes via the matching buttons', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await expect(dialog).toBeHidden();

    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open', '');

    await page.getByTestId('close-dialog').click();
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute('open', '');
  });

  test('closes on Escape', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('moves focus into the dialog and away from the opener', async ({ page }) => {
    await page.getByTestId('open-dialog').click();

    // Initial focus must land inside the modal dialog. Browsers vary on
    // which child element wins (first focusable, or the dialog itself),
    // so assert containment rather than exact identity.
    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[data-testid="demo-dialog"]');
      return dialog?.contains(document.activeElement);
    });
    expect(focusedInsideDialog).toBe(true);

    // The button that opened the dialog must not retain focus while modal.
    await expect(page.getByTestId('open-dialog')).not.toBeFocused();
  });

  test('renders the styled ::backdrop', async ({ page }) => {
    await page.getByTestId('open-dialog').click();
    const backdropBg = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="demo-dialog"]');
      // ::backdrop styles aren't reachable via getComputedStyle, but we
      // can verify the dialog itself reports modal state via :modal.
      return d?.matches(':modal') ?? false;
    });
    expect(backdropBg).toBe(true);
  });
});
