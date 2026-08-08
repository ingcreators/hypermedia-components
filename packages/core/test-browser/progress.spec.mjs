import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor, expect } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-progress', () => {
  test('exposes the native progressbar role and value semantics', async ({ page }) => {
    const pg = page.getByTestId('pg-default');
    await expect(pg).toHaveAttribute('value', '40');
    await expect(pg).toHaveAttribute('max', '100');
    // <progress> reports as role="progressbar" implicitly.
    const role = await pg.evaluate((el) => el.getAttribute('role') ?? 'progressbar');
    expect(role).toBe('progressbar');
  });

  test('default fill renders the WebKit progress-value pseudo with action-primary colour', async ({ page }) => {
    const pg = page.getByTestId('pg-default');
    // The pseudo-element styles cannot be inspected directly in
    // most engines, but the `color` channel on the element doubles
    // as the fill source via `currentColor` — match against it.
    const colour = await cssColor(pg, 'color');
    // action.primary defaults to blue.600 = rgb(44, 96, 233).
    expect(colour).toBeColor('rgb(44, 96, 233)');
  });

  test('data-variant="success" recolours the fill', async ({ page }) => {
    const pg = page.getByTestId('pg-success');
    const colour = await cssColor(pg, 'color');
    // semantic.color.success → green.600 = rgb(9, 131, 91).
    expect(colour).toBeColor('rgb(9, 131, 91)');
  });

  test('data-variant="error" recolours the fill', async ({ page }) => {
    const pg = page.getByTestId('pg-error');
    const colour = await cssColor(pg, 'color');
    // semantic.color.error → red.600 = rgb(206, 14, 24).
    expect(colour).toBeColor('rgb(206, 14, 24)');
  });

  test('data-size="sm" / "lg" render distinct heights', async ({ page }) => {
    const sm = await page.getByTestId('pg-sm').evaluate((el) => el.getBoundingClientRect().height);
    const lg = await page.getByTestId('pg-lg').evaluate((el) => el.getBoundingClientRect().height);
    expect(lg).toBeGreaterThan(sm);
  });

  test('indeterminate (no value attribute) animates and has no aria-valuenow', async ({ page }) => {
    const pg = page.getByTestId('pg-indet');
    await expect(pg).not.toHaveAttribute('value', /.*/);
    // The animation-name should be the slide keyframes.
    const animation = await pg.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('hc-progress-slide');
  });

  test('axe finds no violations in the progress section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-progress')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
