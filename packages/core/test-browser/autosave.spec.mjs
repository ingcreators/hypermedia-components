import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/autosave.html');
});

test.describe('autosave recipe', () => {
  test('a typing burst produces exactly one debounced draft post', async ({ page }) => {
    const owner = page.locator('[data-draft-owner]');
    await page.getByTestId('title').pressSequentially(' — edited', { delay: 40 });
    await expect(page.getByTestId('draft-status')).toContainText('Draft saved', {
      timeout: 5000,
    });
    await expect(owner).toHaveAttribute('data-count', '1');
    // A second burst posts again.
    await page.getByTestId('title').pressSequentially(' more');
    await expect(owner).toHaveAttribute('data-count', '2', { timeout: 5000 });
  });

  test('a draft save does not clean the dirty guard; the record save does', async ({ page }) => {
    const form = page.getByTestId('form');
    await page.getByTestId('title').pressSequentially('!');
    await expect(form).toHaveAttribute('data-dirty', '');
    await expect(page.getByTestId('draft-status')).toContainText('Draft saved', {
      timeout: 5000,
    });
    // Draft landed — still dirty.
    await expect(form).toHaveAttribute('data-dirty', '');
    await page.getByTestId('save').click();
    await expect(form).not.toHaveAttribute('data-dirty', '', { timeout: 5000 });
  });

  test('no axe violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
