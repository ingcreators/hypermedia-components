import { test, expect } from '@playwright/test';

// The invoker-commands FALLBACK (#624): the same fixtures as
// invoker-commands.spec.mjs, on an engine that lacks the API. No CI leg
// runs an old engine, so the API is removed from the page before the
// bundle loads — `commandForElement` and `command` come off
// HTMLButtonElement.prototype — and installInvokerCommands() takes over.
// Native support is pinned separately; this file proves the floor.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete HTMLButtonElement.prototype.commandForElement;
    delete HTMLButtonElement.prototype.command;
  });
  await page.goto('/');
});

test.describe('invoker commands — fallback below the floor', () => {
  test('the API is gone and the fallback is installed', async ({ page }) => {
    const state = await page.evaluate(() => ({
      native: 'commandForElement' in HTMLButtonElement.prototype,
      installed: typeof document.__hcInvokerCommandsUninstall === 'function',
    }));
    expect(state).toEqual({ native: false, installed: true });
  });

  test('command="show-modal" opens the dialog modally', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open', '');
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
    await expect(opener).toBeFocused();
  });

  test('the drawers and the command palette open too', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    await expect(page.getByTestId('dr-right')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dr-right')).not.toHaveAttribute('open', '');

    await page.getByTestId('cmd-open-btn').click();
    await expect(page.getByTestId('cmd-dialog')).toHaveAttribute('open', '');
  });

  test('command="close" from a type="button" inside the dialog form', async ({ page }) => {
    await page.goto('/dialog-tall.html');
    await page.getByTestId('open').click();
    const dialog = page.getByTestId('dialog');
    await expect(dialog).toHaveAttribute('open', '');
    await page.getByTestId('cancel').click();
    await expect(dialog).not.toHaveAttribute('open', '');
  });

  test('a disabled button, a submit button and a defaultPrevented click do nothing', async ({ page }) => {
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<dialog id="fb-dlg" data-testid="fb-dlg"><form data-hx-post="/x">
           <button type="submit" data-testid="fb-submit" commandfor="fb-dlg" command="close">Apply</button>
         </form></dialog>
         <button type="button" data-testid="fb-disabled" disabled commandfor="fb-dlg" command="show-modal">Disabled</button>
         <button type="button" data-testid="fb-prevented" commandfor="fb-dlg" command="show-modal">Prevented</button>`,
      );
      document.querySelector('[data-testid="fb-prevented"]').addEventListener('click', (e) => e.preventDefault());
      document.querySelector('#fb-dlg form').addEventListener('submit', (e) => e.preventDefault());
    });
    const dialog = page.getByTestId('fb-dlg');

    await page.getByTestId('fb-disabled').dispatchEvent('click');
    await expect(dialog).not.toHaveAttribute('open', '');

    await page.getByTestId('fb-prevented').click();
    await expect(dialog).not.toHaveAttribute('open', '');

    await dialog.evaluate((el) => el.showModal());
    await page.getByTestId('fb-submit').click();
    await expect(dialog).toHaveAttribute('open', ''); // the command on a submit button is ignored
  });

  test('an already-open dialog is left alone', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await dialog.evaluate((el) => el.showModal());
    // A second showModal() on an open dialog would throw InvalidStateError.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.getByTestId('open-dialog').dispatchEvent('click');
    await expect(dialog).toHaveAttribute('open', '');
    expect(errors).toEqual([]);
  });
});
