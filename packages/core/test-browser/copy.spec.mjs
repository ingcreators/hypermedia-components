import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Pins the copy-to-clipboard behavior (#270) against the real Clipboard
// API. localhost is a secure context, so navigator.clipboard.writeText
// runs for real on every engine — Playwright's real clicks carry the
// transient user activation Firefox and WebKit require for the write.
// What was written is asserted through the hc:copied event detail
// (emitted only after a successful write); reading the clipboard *back*
// needs the clipboard-read permission, which is only grantable on
// Chromium, so that end-to-end read stays a Chromium-only extra.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ context, page, browserName }) => {
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await page.goto('/copy.html');
});

/**
 * Arm a one-shot hc:copied listener, click the button, and return the
 * copied text the event reported.
 */
async function clickAndCopiedText(page, testId) {
  const detail = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener('hc:copied', (e) => resolve(e.detail), { once: true });
      }),
  );
  await page.getByTestId(testId).click();
  return (await detail).text;
}

test.describe('copy behavior with the real Clipboard API', () => {
  test('copies a form control’s value to the clipboard', async ({ page, browserName }) => {
    expect(await clickAndCopiedText(page, 'copy-url')).toBe('https://app.example.com/s/abc123');
    if (browserName === 'chromium') {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toBe('https://app.example.com/s/abc123');
    }
  });

  test('copies an element’s textContent', async ({ page, browserName }) => {
    expect(await clickAndCopiedText(page, 'copy-snippet')).toBe('SELECT 1;');
    if (browserName === 'chromium') {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toBe('SELECT 1;');
    }
  });

  test('copies a literal via data-hc-copy-text', async ({ page, browserName }) => {
    expect(await clickAndCopiedText(page, 'copy-literal')).toBe('literal-value');
    if (browserName === 'chromium') {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toBe('literal-value');
    }
  });

  test('reflects success on the button transiently and keeps its name', async ({ page }) => {
    const btn = page.getByTestId('copy-url');
    await btn.click();
    await expect(btn).toHaveAttribute('data-hc-copied', '');
    await expect(btn).toHaveText('Copy'); // accessible name unchanged
    // The transient flag clears itself (~1.5s).
    await expect(btn).not.toHaveAttribute('data-hc-copied', '', { timeout: 4000 });
  });

  test('announces success through a role="status" live region', async ({ page }) => {
    await page.getByTestId('copy-url').click();
    const status = page.locator('[role="status"]');
    await expect(status).toHaveText('Copied');
  });

  test('fires a bubbling hc:copied event with the copied text', async ({ page }) => {
    const detail = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener('hc:copied', (e) => resolve(e.detail), { once: true });
        }),
    );
    await page.getByTestId('copy-url').click();
    expect(await detail).toEqual({ text: 'https://app.example.com/s/abc123' });
  });

  test('no WCAG 2.1 AA violations', async ({ page }) => {
    await page.getByTestId('copy-url').click();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations.map((v) => ({ id: v.id, help: v.help }))).toEqual([]);
  });
});
