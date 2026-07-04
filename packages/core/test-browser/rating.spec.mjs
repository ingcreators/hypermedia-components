import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-rating — a star rating as a native radio group. Pure CSS: fill-up-
// to-checked via :has()/sibling selectors, platform arrow-key radio
// navigation, native form serialization.
test.beforeEach(async ({ page }) => {
  await page.goto('/rating.html');
});

const starColor = (page, nth) =>
  page
    .getByTestId('interactive')
    .locator('.hc-rating__star')
    .nth(nth)
    .evaluate((el) => getComputedStyle(el).color);

const tokenColor = (page, name) =>
  page.evaluate((n) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);

test.describe('hc-rating', () => {
  test('fills up to the checked star and no further', async ({ page }) => {
    const filled = await tokenColor(page, '--hc-rating-filled-color');
    const empty = await tokenColor(page, '--hc-rating-color');
    // value=3 is checked in the fixture.
    expect(await starColor(page, 0)).toBe(filled);
    expect(await starColor(page, 1)).toBe(filled);
    expect(await starColor(page, 2)).toBe(filled);
    expect(await starColor(page, 3)).toBe(empty);
    expect(await starColor(page, 4)).toBe(empty);
  });

  test('clicking a star checks its radio and refills', async ({ page }) => {
    await page.getByTestId('interactive').locator('.hc-rating__star').nth(4).click();
    await expect(page.locator('#r5')).toBeChecked();
    const filled = await tokenColor(page, '--hc-rating-filled-color');
    const stars = page.getByTestId('interactive').locator('.hc-rating__star');
    // toHaveCSS retries — the 120ms color transition settles under it.
    await expect(stars.nth(3)).toHaveCSS('color', filled);
    await expect(stars.nth(4)).toHaveCSS('color', filled);
    // Native serialization: the form reads the radio group's value.
    const value = await page
      .getByTestId('form')
      .evaluate((form) => new FormData(form).get('rate'));
    expect(value).toBe('5');
  });

  test('arrow keys move the selection (platform radio-group behavior)', async ({ page }) => {
    await page.locator('#r3').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#r4')).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#r3')).toBeChecked();
  });

  test('read-only form fills data-filled stars and exposes one label', async ({ page }) => {
    const ro = page.getByTestId('readonly');
    await expect(ro).toHaveRole('img');
    const filled = await tokenColor(page, '--hc-rating-filled-color');
    const colors = await ro
      .locator('.hc-rating__star')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    expect(colors.filter((c) => c === filled)).toHaveLength(4);
  });

  test('data-size swaps the glyph size', async ({ page }) => {
    const base = await page
      .getByTestId('interactive')
      .locator('.hc-rating__star')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const lg = await page
      .getByTestId('lg')
      .locator('.hc-rating__star')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(lg).toBeGreaterThan(base);
  });

  test('axe finds no violations in the rating section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-rating').analyze();
    expect(results.violations).toEqual([]);
  });
});
