import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await context.clearCookies();
  await page.goto('/session-expiry.html');
});

test.describe('session-expiry recipe', () => {
  test('the 401 opens the login dialog and signing in replays the action', async ({ page }) => {
    await page.getByTestId('approve').click();
    const dialog = page.locator('#error-dialog dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Session expired');
    // Sign in — the bridge closes the dialog and replays the approval.
    await dialog.getByLabel('Password').fill('hunter2');
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId('status')).toContainText('Approved', {
      timeout: 5000,
    });
  });

  test('a wrong password re-renders the dialog with an inline error', async ({ page }) => {
    await page.getByTestId('approve').click();
    const dialog = page.locator('#error-dialog dialog');
    await dialog.getByLabel('Password').fill('wrong');
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#error-dialog .hc-field__error')).toBeVisible();
    await expect(page.getByTestId('status')).not.toContainText('Approved');
  });

  test('with a live session the action just works', async ({ page }) => {
    await page.getByTestId('approve').click();
    const dialog = page.locator('#error-dialog dialog');
    await dialog.getByLabel('Password').fill('ok');
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByTestId('status')).toContainText('Approved', {
      timeout: 5000,
    });
    // Second click: session cookie present — the dialog stays closed.
    await page.getByTestId('approve').click();
    await expect(page.getByTestId('status')).toContainText('Approved');
    await expect(page.locator('#error-dialog dialog')).toBeHidden();
  });

  test('no axe violations with the login dialog open', async ({ page }) => {
    await page.getByTestId('approve').click();
    await expect(page.locator('#error-dialog dialog')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
