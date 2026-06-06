import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-kbd', () => {
  test('a single key renders as a styled <kbd> cap', async ({ page }) => {
    const key = page.getByTestId('kbd-single');
    await expect(key).toHaveJSProperty('tagName', 'KBD');

    const styles = await key.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        borderWidth: cs.borderTopWidth,
        radius: cs.borderTopLeftRadius,
        font: cs.fontFamily,
      };
    });
    // A flex container blockifies its items, so `inline-flex` computes to
    // `flex` for a key that sits inside the demo `.row`. Either way it is a
    // flexbox (so the cap centers its glyph). The group test below asserts the
    // strict `inline-flex` value on a key in normal flow.
    expect(styles.display).toMatch(/flex/);
    // 1px solid border from the keycap rule.
    expect(styles.borderWidth).toBe('1px');
    // --hc-kbd-radius resolves to 4px (primitive.radius.sm).
    expect(styles.radius).toBe('4px');
    // Monospace stack is applied.
    expect(styles.font.toLowerCase()).toContain('monospace');
  });

  test('data-size scales the cap font-size (sm < default < lg)', async ({ page }) => {
    const fontPx = (testId) =>
      page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    const sm = await fontPx('kbd-sm');
    const md = await fontPx('kbd-single');
    const lg = await fontPx('kbd-lg');

    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
  });

  test('a shortcut group keeps each key as its own cap and follows the group size', async ({
    page,
  }) => {
    const group = page.getByTestId('kbd-group');
    await expect(group).toHaveJSProperty('tagName', 'KBD');
    // The group sits in normal flow (inside a <p>), so it keeps inline-flex.
    await expect(group).toHaveCSS('display', 'inline-flex');

    const cmd = page.getByTestId('kbd-group-cmd');
    const k = page.getByTestId('kbd-group-k');
    await expect(cmd).toHaveJSProperty('tagName', 'KBD');
    await expect(k).toHaveJSProperty('tagName', 'KBD');

    // Each inner key has its own keycap border (not the bare group).
    const cmdBorder = await cmd.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(cmdBorder).toBe('1px');

    // Inner keys inherit the group font-size (font-size: inherit).
    const groupSize = await group.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const keySize = await k.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(keySize).toBeCloseTo(groupSize, 1);
  });

  test('a symbol-only key carries an accessible label', async ({ page }) => {
    await expect(page.getByTestId('kbd-group-cmd')).toHaveAttribute('aria-label', 'Command');
  });

  test('axe finds no violations across the kbd examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-kbd').analyze();
    expect(results.violations).toEqual([]);
  });
});
