import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// installThemeToggle — prefers-color-scheme default, explicit data-theme
// flip, localStorage persistence (with the documented head snippet), and
// acceptable rendering in both themes (axe incl. colour contrast).
test.describe('theme toggle', () => {
  test('defaults to the OS preference and flips to the opposite theme', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/theme-toggle.html');

    // No explicit data-theme yet, but the toggle reads the OS preference.
    await expect(page.getByTestId('toggle')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByTestId('toggle')).toHaveAttribute('aria-pressed', 'false');
    await context.close();
  });

  test('toggling flips the page colors', async ({ page }) => {
    await page.goto('/theme-toggle.html');
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByTestId('toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);
  });

  test('the choice persists across a reload (head snippet restores pre-paint)', async ({ page }) => {
    await page.goto('/theme-toggle.html');
    await page.getByTestId('toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('an icon-only toggle gets a default accessible name', async ({ page }) => {
    await page.goto('/theme-toggle.html');
    await expect(page.getByTestId('toggle')).toHaveAttribute('aria-label', 'Switch color theme');
  });

  test('axe (incl. colour contrast) passes in both themes', async ({ page }) => {
    // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
    // so the dark flip applies instantly and axe samples final palettes.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/theme-toggle.html');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByTestId('toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
