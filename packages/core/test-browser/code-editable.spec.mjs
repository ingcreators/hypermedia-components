import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-code editable (installCodeEditor) — a real <textarea name> on the code
// surface, upgraded with a synced line-number gutter (#255). The value is a
// native form control, so it submits in forms and with htmx.
test.beforeEach(async ({ page }) => {
  await page.goto('/code-editable.html');
});

test.describe('hc-code editable', () => {
  test('adds a decorative gutter; plain editable has none', async ({ page }) => {
    const gutter = page.getByTestId('editor').locator('.hc-code__gutter');
    await expect(gutter).toHaveCount(1);
    await expect(gutter).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('plain').locator('.hc-code__gutter')).toHaveCount(0);
  });

  test('numbers every line and disables soft-wrap for alignment', async ({ page }) => {
    const ta = page.getByTestId('ta');
    await expect(ta).toHaveAttribute('wrap', 'off');
    const lines = await page
      .getByTestId('editor')
      .locator('.hc-code__gutter')
      .evaluate((el) => el.textContent.split('\n').length);
    expect(lines).toBe(10); // 10 lines of initial value
  });

  test('the value is a native form control that submits', async ({ page }) => {
    const submitted = await page.evaluate(() => {
      const form = document.getElementById('editor-form');
      return new FormData(form).get('content');
    });
    expect(submitted).toContain('SELECT id');
  });

  test('renumbers as the user types', async ({ page }) => {
    const ta = page.getByTestId('ta');
    await ta.focus();
    await ta.press('Control+End');
    await ta.press('Enter');
    await ta.type('-- 11');
    const lines = await page
      .getByTestId('editor')
      .locator('.hc-code__gutter')
      .evaluate((el) => el.textContent.split('\n').length);
    expect(lines).toBe(11);
  });

  test('the gutter scroll tracks the textarea', async ({ page }) => {
    const synced = await page.getByTestId('ta').evaluate((ta) => {
      ta.scrollTop = 30;
      ta.dispatchEvent(new Event('scroll', { bubbles: true }));
      const gutter = ta.parentElement.querySelector('.hc-code__gutter');
      return gutter.scrollTop === ta.scrollTop && ta.scrollTop > 0;
    });
    expect(synced).toBe(true);
  });

  test('axe finds no violations in light and dark', async ({ page }) => {
    expect(
      (await new AxeBuilder({ page }).include('#section-code-editable').analyze()).violations,
    ).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(
      (await new AxeBuilder({ page }).include('#section-code-editable').analyze()).violations,
    ).toEqual([]);
  });
});
