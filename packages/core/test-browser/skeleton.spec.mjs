import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-skeleton', () => {
  test('base block paints the muted surface colour', async ({ page }) => {
    const sk = page.getByTestId('sk-pulse');
    const bg = await sk.evaluate((el) => getComputedStyle(el).backgroundColor);
    // semantic.color.muted-bg (light) → gray.100 = rgb(243, 244, 246).
    expect(bg).toMatch(/rgba?\(\s*243,\s*244,\s*246/);
  });

  test('default animation is the pulse keyframes', async ({ page }) => {
    const sk = page.getByTestId('sk-pulse');
    const name = await sk.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('hc-skeleton-pulse');
  });

  test('data-animation="wave" swaps to the wave keyframes', async ({ page }) => {
    const sk = page.getByTestId('sk-wave');
    const name = await sk.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('hc-skeleton-wave');
  });

  test('data-animation="none" disables animation', async ({ page }) => {
    const sk = page.getByTestId('sk-none');
    const name = await sk.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });

  test('data-shape="circle" renders a fully-rounded block', async ({ page }) => {
    const sk = page.getByTestId('sk-circle');
    const { radius, width, height } = await sk.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { radius: cs.borderTopLeftRadius, width: r.width, height: r.height };
    });
    // 9999px clamps to half the box → a pill/circle; assert it is at
    // least half the rendered size (well above the rect md radius of 6px).
    expect(parseFloat(radius)).toBeGreaterThanOrEqual(Math.min(width, height) / 2 - 1);
    // aspect-ratio: 1 keeps it square.
    expect(Math.abs(width - height)).toBeLessThan(1.5);
  });

  test('data-shape="text" uses the tighter text radius', async ({ page }) => {
    const text = await page.getByTestId('sk-text').evaluate(
      (el) => getComputedStyle(el).borderTopLeftRadius,
    );
    const rect = await page.getByTestId('sk-rect').evaluate(
      (el) => getComputedStyle(el).borderTopLeftRadius,
    );
    // primitive.radius.sm (4px) for text vs radius.md (6px) for rect.
    expect(parseFloat(text)).toBeLessThan(parseFloat(rect));
  });

  test('prefers-reduced-motion: reduce suppresses all animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const id of ['sk-pulse', 'sk-wave']) {
      const name = await page.getByTestId(id).evaluate(
        (el) => getComputedStyle(el).animationName,
      );
      expect(name).toBe('none');
    }
    await page.emulateMedia({ reducedMotion: null });
  });

  test('axe finds no violations in the skeleton section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-skeleton')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
