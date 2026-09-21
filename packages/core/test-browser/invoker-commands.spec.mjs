import { test, expect } from '@playwright/test';

// The docs open and close a `<dialog>` with HTML's invoker commands
// (`commandfor` + `command="show-modal"` / `"close"`) and ship no
// fallback — so the engines this suite runs on must support them
// natively. This spec pins that: if a bundled browser ever lacks the
// attributes, it fails here first, not in a demo.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('invoker commands (commandfor / command)', () => {
  test('the engine implements the attributes', async ({ page }) => {
    const supported = await page.evaluate(
      () => 'commandForElement' in HTMLButtonElement.prototype && 'command' in HTMLButtonElement.prototype,
    );
    expect(supported).toBe(true);
  });

  test('command="show-modal" opens the dialog modally, no script', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await expect(dialog).not.toHaveAttribute('open', '');

    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open', '');
    // Modal, not `show()`: the dialog matches :modal and the page behind is inert.
    expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);
  });

  test('command="close" closes it and focus returns to the opener', async ({ page }) => {
    const opener = page.getByTestId('open-dialog');
    await opener.focus();
    await opener.press('Enter');
    const dialog = page.getByTestId('demo-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('close-dialog').click();
    await expect(dialog).not.toBeVisible();
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(opener).toBeFocused();
  });

  test('command="close" works from a type="button" inside the dialog form', async ({ page }) => {
    await page.goto('/dialog-tall.html');
    await page.getByTestId('open').click();
    const dialog = page.getByTestId('dialog');
    await expect(dialog).toHaveAttribute('open', '');
    await page.getByTestId('cancel').click();
    await expect(dialog).not.toHaveAttribute('open', '');
  });
});
