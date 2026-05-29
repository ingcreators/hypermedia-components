import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
    const bg = await page.getByTestId('sep-h').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // semantic.color.border → gray.300 = rgb(208, 213, 221).
    expect(bg).toMatch(/rgba?\(\s*208,\s*213,\s*221/);
  });

  test('axe finds no violations in the separator section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-separator')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
