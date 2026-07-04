import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-code live highlight overlay (#264) — installCodeEditor() overlays a
// synced, aria-hidden `.hc-code__highlight` layer behind the editable textarea
// when `data-lang` resolves to a grammar (built-in or via
// registerCodeLanguage()). The textarea glyphs are hidden so the coloured
// overlay shows through while the caret stays visible; the value still submits.
test.beforeEach(async ({ page }) => {
  // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
  // so the dark flip applies instantly and axe samples final palettes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/code-highlight.html');
});

const fillColor = (locator) =>
  locator.evaluate((el) => getComputedStyle(el).webkitTextFillColor);

test.describe('hc-code live highlight', () => {
  test('overlays a decorative layer with token spans for the built-in grammar', async ({
    page,
  }) => {
    const overlay = page.getByTestId('sql').locator('.hc-code__highlight');
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
    // SELECT / FROM / WHERE are SQL keywords.
    await expect(overlay.locator('.hc-code__tok[data-tok="keyword"]').first()).toHaveText('SELECT');
    // The overlay reconstructs the value verbatim.
    const value = await page.getByTestId('sql-ta').inputValue();
    await expect(overlay).toHaveText(value);
  });

  test('hides the textarea glyphs but keeps the value a real form control', async ({ page }) => {
    // Glyphs hidden via -webkit-text-fill-color (overlay supplies the visible text).
    expect(await fillColor(page.getByTestId('sql-ta'))).toBe('rgba(0, 0, 0, 0)');
    // Value still submits.
    const submitted = await page.getByTestId('sql-ta').inputValue();
    expect(submitted).toContain('SELECT id');
  });

  test('re-tokenizes as the user types', async ({ page }) => {
    const ta = page.getByTestId('sql-ta');
    await ta.focus();
    await ta.press('Control+End');
    await ta.type('\nGROUP BY email');
    const overlay = page.getByTestId('sql').locator('.hc-code__highlight');
    // The freshly typed keyword is highlighted (overlay re-rendered on input).
    await expect(
      overlay.locator('.hc-code__tok[data-tok="keyword"]', { hasText: 'GROUP' }),
    ).toHaveCount(1);
  });

  test('the overlay scroll tracks the textarea (vertical and horizontal)', async ({ page }) => {
    const synced = await page.getByTestId('sql-ta').evaluate((ta) => {
      ta.scrollTop = 20;
      ta.scrollLeft = 40;
      ta.dispatchEvent(new Event('scroll', { bubbles: true }));
      const layer = ta.parentElement.querySelector('.hc-code__highlight');
      return (
        layer.scrollTop === ta.scrollTop &&
        layer.scrollLeft === ta.scrollLeft &&
        ta.scrollLeft > 0
      );
    });
    expect(synced).toBe(true);
  });

  test('a registered dialect grammar classifies its directives as meta', async ({ page }) => {
    const overlay = page.getByTestId('tql').locator('.hc-code__highlight');
    await expect(overlay).toHaveCount(1);
    await expect(overlay.locator('.hc-code__tok[data-tok="meta"]').first()).toHaveText('/*%if active */');
  });

  test('an unknown language degrades to a plain textarea (no overlay, glyphs visible)', async ({
    page,
  }) => {
    await expect(page.getByTestId('unknown').locator('.hc-code__highlight')).toHaveCount(0);
    await expect(page.getByTestId('plain').locator('.hc-code__highlight')).toHaveCount(0);
    // No overlay → glyphs are not hidden.
    expect(await fillColor(page.getByTestId('unknown').locator('.hc-code__input'))).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  test('axe finds no violations in light and dark', async ({ page }) => {
    expect(
      (await new AxeBuilder({ page }).include('#section-code-highlight').analyze()).violations,
    ).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(
      (await new AxeBuilder({ page }).include('#section-code-highlight').analyze()).violations,
    ).toEqual([]);
  });
});
