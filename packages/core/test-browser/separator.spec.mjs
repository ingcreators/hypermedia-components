import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor, expect } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-separator', () => {
  test('an <hr> keeps the implicit separator role', async ({ page }) => {
    const sep = page.getByTestId('sep-h');
    // <hr> maps to role="separator" implicitly.
    const role = await sep.evaluate((el) => el.getAttribute('role') ?? 'separator');
    expect(role).toBe('separator');
  });

  test('horizontal renders a thin full-width hairline', async ({ page }) => {
    const { width, height } = await page.getByTestId('sep-h').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(height).toBeLessThanOrEqual(2);
    expect(width).toBeGreaterThan(height);
  });

  test('vertical renders a thin line taller than it is wide', async ({ page }) => {
    const { width, height } = await page.getByTestId('sep-v').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(width).toBeLessThanOrEqual(2);
    expect(height).toBeGreaterThan(width);
  });

  test('the line is painted with the border token colour', async ({ page }) => {
    // semantic.color.border → gray.300.
    expect(await cssColor(page.getByTestId('sep-h'), 'backgroundColor')).toBeColor('rgb(208, 213, 221)');
  });

  test('the label variant grows hairlines around a muted label', async ({ page }) => {
    const sep = page.getByTestId('sep-label');
    const styles = await sep.evaluate((el) => {
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, '::before');
      return {
        display: cs.display,
        background: cs.backgroundColor,
        beforeContent: before.content,
        beforeFlex: before.flexGrow,
      };
    });
    expect(styles.display).toBe('flex');
    // The container stops painting its own line…
    expect(styles.background).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    // …and the pseudo-element segments draw it instead.
    expect(styles.beforeContent).toBe('""');
    expect(styles.beforeFlex).toBe('1');
    expect(await cssColor(sep, 'backgroundColor', '::before')).toBeColor('rgb(208, 213, 221)');

    // The label sits between the segments, muted.
    const label = sep.locator('.hc-separator__label');
    await expect(label).toHaveText('or');

    // The explicit role keeps the div a separator for assistive tech.
    await expect(sep).toHaveRole('separator');
  });

  test('axe finds no violations in the separator section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-separator')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
