import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const RADIUS = '6px'; // --hc-button-radius (semantic.control.radius -> 6px)

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-button-group', () => {
  test('a horizontal group rounds only the outer corners', async ({ page }) => {
    const first = page.getByTestId('bg-first');
    const middle = page.getByTestId('bg-middle');
    const last = page.getByTestId('bg-last');

    // First button: left corners rounded, right corners square.
    await expect(first).toHaveCSS('border-top-left-radius', RADIUS);
    await expect(first).toHaveCSS('border-bottom-left-radius', RADIUS);
    await expect(first).toHaveCSS('border-top-right-radius', '0px');
    await expect(first).toHaveCSS('border-bottom-right-radius', '0px');

    // Middle button: all corners square.
    await expect(middle).toHaveCSS('border-top-left-radius', '0px');
    await expect(middle).toHaveCSS('border-top-right-radius', '0px');

    // Last button: right corners rounded, left corners square.
    await expect(last).toHaveCSS('border-top-right-radius', RADIUS);
    await expect(last).toHaveCSS('border-bottom-right-radius', RADIUS);
    await expect(last).toHaveCSS('border-top-left-radius', '0px');
  });

  test('adjacent buttons overlap by 1px so borders read as one hairline', async ({ page }) => {
    await expect(page.getByTestId('bg-middle')).toHaveCSS('margin-left', '-1px');
    await expect(page.getByTestId('bg-last')).toHaveCSS('margin-left', '-1px');
    // The first button is flush — no negative margin.
    await expect(page.getByTestId('bg-first')).toHaveCSS('margin-left', '0px');
  });

  test('a vertical group stacks and collapses top/bottom borders', async ({ page }) => {
    const group = page.getByTestId('bg-vertical');
    await expect(group).toHaveCSS('flex-direction', 'column');

    const vFirst = page.getByTestId('bg-v-first');
    const vMiddle = page.getByTestId('bg-v-middle');
    const vLast = page.getByTestId('bg-v-last');

    // Outer corners follow the vertical axis: top rounded on first, bottom on last.
    await expect(vFirst).toHaveCSS('border-top-left-radius', RADIUS);
    await expect(vFirst).toHaveCSS('border-top-right-radius', RADIUS);
    await expect(vFirst).toHaveCSS('border-bottom-left-radius', '0px');
    await expect(vLast).toHaveCSS('border-bottom-left-radius', RADIUS);
    await expect(vLast).toHaveCSS('border-top-left-radius', '0px');

    // Overlap is on the block axis, not the inline axis.
    await expect(vMiddle).toHaveCSS('margin-top', '-1px');
    await expect(vMiddle).toHaveCSS('margin-left', '0px');
  });

  test('axe finds no violations across the button-group examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-button-group').analyze();
    expect(results.violations).toEqual([]);
  });
});
