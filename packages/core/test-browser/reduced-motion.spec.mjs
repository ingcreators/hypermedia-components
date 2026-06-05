import { test, expect } from '@playwright/test';

// These components animate via a `transition` shorthand. Under
// prefers-reduced-motion the hc.a11y / hc.htmx reduced-motion blocks zero
// their transition-duration. Emulate the preference and assert every value
// in the (possibly multi-part) transition-duration is zero.
const TESTIDS = [
  'rm-button',
  'rm-check',
  'rm-radio',
  'rm-input',
  'rm-select',
  'rm-datepicker',
  'rm-tab',
  'rm-page',
  'rm-toggle',
  'rm-htmx',
];

const durations = (loc) =>
  loc.evaluate((el) =>
    getComputedStyle(el)
      .transitionDuration.split(',')
      .map((s) => s.trim()),
  );

test.describe('reduced motion', () => {
  test('without the preference, transitions are non-zero (sanity)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/reduced-motion.html');
    const vals = await durations(page.getByTestId('rm-button'));
    expect(vals.some((d) => d !== '0s')).toBe(true);
  });

  test('with prefers-reduced-motion, gated components zero their transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/reduced-motion.html');

    for (const id of TESTIDS) {
      const vals = await durations(page.getByTestId(id));
      expect(vals.every((d) => d === '0s'), `${id} should have 0 transition-duration`).toBe(true);
    }
  });
});
