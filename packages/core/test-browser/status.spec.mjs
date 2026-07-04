import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// .hc-status — the semantic status palette on arbitrary elements (text
// emphasis via data-variant, tinted surface via data-fill), theme-aware
// through the same tokens the alert/badge/toast variants use.
test.beforeEach(async ({ page }) => {
  // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
  // so the dark flip applies instantly and axe samples final palettes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/status.html');
});

const color = (locator) => locator.evaluate((el) => getComputedStyle(el).color);
const bg = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe('hc-status utility', () => {
  test('each variant colours the text distinctly', async ({ page }) => {
    const plain = await color(page.getByTestId('plain'));
    const seen = new Set([plain]);
    for (const variant of ['neutral', 'info', 'success', 'warning', 'error']) {
      const value = await color(page.getByTestId(variant));
      expect(value, `${variant} should differ from plain text and other variants`).not.toBe(plain);
      seen.add(value);
    }
    expect(seen.size).toBe(6); // plain + 5 distinct variant colours
  });

  test('data-fill tints a table row and wins over the row-hover background', async ({ page }) => {
    const row = page.getByTestId('row-error');
    const filled = await bg(row);
    expect(filled).not.toBe('rgba(0, 0, 0, 0)');

    await row.hover();
    expect(await bg(row)).toBe(filled); // utilities layer outranks the hover rule
  });

  test('colours re-resolve under data-theme="dark"', async ({ page }) => {
    const lightText = await color(page.getByTestId('success'));
    const lightFill = await bg(page.getByTestId('row-error'));

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    expect(await color(page.getByTestId('success'))).not.toBe(lightText);
    expect(await bg(page.getByTestId('row-error'))).not.toBe(lightFill);
  });

  test('axe (incl. colour contrast) passes in light and dark', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
