import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/edit-conflict.html');
});

test.describe('edit-conflict recipe', () => {
  test('a stale save opens the conflict dialog with both versions', async ({ page }) => {
    await page.getByTestId('save').click();
    const dialog = page.locator('#error-dialog dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Someone saved first');
    await expect(dialog).toContainText('Restock the beans (theirs)');
    await expect(dialog).toContainText('Restock the beans (mine)');
  });

  test('overwrite wins with the dialog fresh version and closes the dialog', async ({ page }) => {
    await page.getByTestId('save').click();
    const dialog = page.locator('#error-dialog dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Overwrite with mine' }).click();
    await expect(page.getByTestId('status')).toContainText('Saved as v14', {
      timeout: 5000,
    });
    await expect(dialog).toBeHidden();
  });

  test('reload discards local edits and the next save succeeds', async ({ page }) => {
    await page.getByTestId('save').click();
    const dialog = page.locator('#error-dialog dialog');
    await dialog.getByRole('button', { name: 'Reload theirs' }).click();
    await expect(page.getByTestId('title')).toHaveValue('Restock the beans (theirs)', {
      timeout: 5000,
    });
    await expect(page.getByTestId('version')).toHaveValue('13');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('status')).toContainText('Saved as v14');
  });

  test('keep editing leaves the form and version untouched', async ({ page }) => {
    await page.getByTestId('save').click();
    const dialog = page.locator('#error-dialog dialog');
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('title')).toHaveValue('Restock the beans (mine)');
    await expect(page.getByTestId('version')).toHaveValue('12');
  });

  test('no axe violations with the conflict dialog open', async ({ page }) => {
    await page.getByTestId('save').click();
    await expect(page.locator('#error-dialog dialog')).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
