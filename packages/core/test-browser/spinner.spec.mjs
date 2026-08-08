import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor, expect } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-spinner', () => {
  test('animates with the hc-spinner-spin keyframes', async ({ page }) => {
    const spinner = page.getByTestId('spinner-default');
    const anim = await spinner.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, duration: cs.animationDuration };
    });
    expect(anim.name).toBe('hc-spinner-spin');
    expect(parseFloat(anim.duration)).toBeGreaterThan(0);
  });

  test('data-size changes the diameter (sm < default < lg)', async ({ page }) => {
    // offsetWidth, not getBoundingClientRect: the spinner is mid-rotation
    // when sampled, and a rotated square's bounding box inflates by up to
    // √2 — enough for a sm spinner to measure wider than the default one.
    const width = (testId) =>
      page.getByTestId(testId).evaluate((el) => el.offsetWidth);
    const sm = await width('spinner-sm');
    const md = await width('spinner-default');
    const lg = await width('spinner-lg');
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
  });

  test('data-variant swaps the indicator colour', async ({ page }) => {
    const topColor = (testId) =>
      cssColor(page.getByTestId(testId), 'borderTopColor');
    const def = await topColor('spinner-default');
    const primary = await topColor('spinner-primary');
    // Primary resolves to the default accent (blue.600).
    expect(primary).toBeColor('rgb(44, 96, 233)');
    expect(primary).not.toBe(def);
  });

  test('a status name is exposed (live region with an accessible name)', async ({ page }) => {
    const section = page.getByTestId('section-spinner');
    // Pattern 1: the spinner itself is the named live region (aria-label).
    await expect(section.getByRole('status', { name: 'Loading', exact: true })).toBeVisible();
    // Pattern 2: a status region wrapping a decorative spinner + a
    // visually-hidden label. `status` is not named by its contents, but the
    // live region still announces the (clipped, not hidden) text on update.
    const wrapped = page.getByTestId('spinner-wrapped');
    await expect(wrapped).toHaveAttribute('role', 'status');
    await expect(wrapped).toContainText('Loading results…');
  });

  test('under reduced motion the spin slows but keeps running and the name persists', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const spinner = page.getByTestId('spinner-default');
    const duration = await spinner.evaluate((el) => getComputedStyle(el).animationDuration);
    // Reduced-motion duration token (2.4s) — slowed, not removed.
    expect(parseFloat(duration)).toBeGreaterThan(2);
    // The status name still announces busy regardless of motion.
    await expect(
      page.getByTestId('section-spinner').getByRole('status', { name: 'Loading', exact: true }),
    ).toBeVisible();
  });

  test('axe finds no violations across the spinner examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-spinner').analyze();
    expect(results.violations).toEqual([]);
  });
});
