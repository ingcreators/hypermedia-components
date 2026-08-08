import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/unsaved-changes.html');
});

test.describe('unsaved-changes recipe', () => {
  test('typing flips data-dirty and shows the style hook', async ({ page }) => {
    const form = page.getByTestId('guarded');
    const badge = page.getByTestId('badge');
    await expect(badge).toBeHidden();
    await page.getByTestId('title').fill('Quarterly report (edited)');
    await expect(form).toHaveAttribute('data-dirty', '');
    await expect(badge).toBeVisible();
    // Reverting the value turns it clean again.
    await page.getByTestId('title').fill('Quarterly report');
    await expect(form).not.toHaveAttribute('data-dirty', '');
    await expect(badge).toBeHidden();
  });

  test('the form own save turns the guard clean', async ({ page }) => {
    const form = page.getByTestId('guarded');
    await page.getByTestId('title').fill('Edited');
    await expect(form).toHaveAttribute('data-dirty', '');
    await page.getByTestId('save').click();
    await expect(form).not.toHaveAttribute('data-dirty', '', { timeout: 5000 });
    // The saved value is the new baseline: re-typing the same text stays clean.
    await page.getByTestId('title').fill('Edited');
    await expect(form).not.toHaveAttribute('data-dirty', '');
  });

  test('a synthetic beforeunload is prevented while dirty', async ({ page }) => {
    await page.getByTestId('title').fill('Edited');
    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test('closing while dirty raises the real prompt', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium fires beforeunload dialogs under automation');
    await page.getByTestId('title').fill('Edited');
    const dialogPromise = page.waitForEvent('dialog');
    const closePromise = page.close({ runBeforeUnload: true });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await closePromise;
  });

  test('no axe violations with the badge shown', async ({ page }) => {
    await page.getByTestId('title').fill('Edited');
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
