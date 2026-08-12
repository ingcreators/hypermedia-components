import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The filter panel's layout rules are geometry claims, so they are
// pinned where geometry exists. Each one is a defect that shipped in
// the data-grid template before it was a rule.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/panel-typography.html', { waitUntil: 'domcontentloaded' });
});

test.describe('filter panel typography', () => {
  test('data-align="start" stops a tall field stretching its neighbour', async ({
    page,
  }) => {
    const heights = await page.evaluate(() => {
      const h = (sel) =>
        document.querySelector(`[data-testid="${sel}"]`).getBoundingClientRect().height;
      return { short: h('short'), applied: h('applied') };
    });
    // Both are one-line fields sharing a row: neither is inflated to the
    // row's height by a taller sibling elsewhere in the grid.
    expect(Math.abs(heights.short - heights.applied)).toBeLessThan(4);
    expect(heights.short).toBeLessThan(120);
  });

  test('data-span="full" takes the whole row', async ({ page }) => {
    const spans = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="grid"]');
      const full = document.querySelector('[data-testid="full"]');
      const g = grid.getBoundingClientRect();
      const f = full.getBoundingClientRect();
      return { gridWidth: Math.round(g.width), fullWidth: Math.round(f.width) };
    });
    expect(spans.fullWidth).toBe(spans.gridWidth);
  });

  test('an applied field is marked', async ({ page }) => {
    const marker = await page.getByTestId('applied-label').evaluate((el) => {
      const style = getComputedStyle(el, '::after');
      return {
        content: style.content,
        width: style.inlineSize,
        background: style.backgroundColor,
      };
    });
    expect(marker.content).not.toBe('none');
    expect(parseFloat(marker.width)).toBeGreaterThan(0);
    expect(marker.background).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('an unmarked field carries no marker', async ({ page }) => {
    const content = await page
      .getByTestId('short')
      .evaluate((el) => getComputedStyle(el.querySelector('.hc-field__label'), '::after').content);
    expect(content).toBe('none');
  });

  test('the operator gives up its chrome and its voice, not its function', async ({
    page,
  }) => {
    const op = await page.getByTestId('op').evaluate((el) => {
      const style = getComputedStyle(el);
      const label = getComputedStyle(el.closest('.hc-field').querySelector('.hc-input'));
      const rect = el.getBoundingClientRect();
      return {
        borderWidth: style.borderTopWidth,
        fontSize: parseFloat(style.fontSize),
        valueFontSize: parseFloat(label.fontSize),
        height: rect.height,
        disabled: el.disabled,
      };
    });
    expect(op.borderWidth).toBe('0px');
    expect(op.fontSize).toBeLessThan(op.valueFontSize);
    // Same hit area, same keyboard: quiet is a voice, not a demotion.
    expect(op.height).toBeGreaterThan(24);
    expect(op.disabled).toBe(false);
  });

  test('the group still owns one focus ring for the pair', async ({ page }) => {
    await page.getByTestId('op').focus();
    const shadow = await page
      .getByTestId('group')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });

  test('no axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations).toEqual([]);
  });
});
