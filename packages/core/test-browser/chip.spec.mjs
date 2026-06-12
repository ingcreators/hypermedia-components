import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-chip', () => {
  test('renders as a bordered pill', async ({ page }) => {
    const chip = page.getByTestId('chip-first');
    const styles = await chip.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        radius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
        display: cs.display,
      };
    });
    expect(parseFloat(styles.radius)).toBeGreaterThan(100); // pill
    expect(styles.borderWidth).toBe('1px');
    // inline-flex, blockified to flex when the chip is a .hc-chips flex item
    expect(styles.display).toMatch(/^(inline-)?flex$/);
  });

  test('.hc-chips strips list chrome and wraps on a gap', async ({ page }) => {
    const list = page.getByTestId('chips');
    const styles = await list.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { display: cs.display, wrap: cs.flexWrap, listStyle: cs.listStyleType, padding: cs.paddingInlineStart };
    });
    expect(styles.display).toBe('flex');
    expect(styles.wrap).toBe('wrap');
    expect(styles.listStyle).toBe('none');
    expect(styles.padding).toBe('0px');
  });

  test('axe finds no violations in the chip section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-chip').analyze();
    expect(results.violations).toEqual([]);
  });
});
