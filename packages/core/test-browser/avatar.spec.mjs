import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-avatar', () => {
  test('renders the initials centred inside a circular surface', async ({ page }) => {
    const av = page.getByTestId('av-initials');
    const radius = await av.evaluate((el) => getComputedStyle(el).borderRadius);
    // Circle default radius is 9999px.
    expect(radius).toMatch(/9999px/);
    await expect(av).toHaveText('AL');
  });

  test('data-shape="square" swaps the radius to the square preset', async ({ page }) => {
    const sq = page.getByTestId('av-square');
    const radius = await sq.evaluate((el) => getComputedStyle(el).borderRadius);
    // primitive.radius.md = 0.5rem = 8px at the default font size.
    expect(radius).not.toMatch(/9999px/);
  });

  test('size variants render at distinct widths', async ({ page }) => {
    const xs = await page.getByTestId('av-xs').evaluate((el) => el.getBoundingClientRect().width);
    const sm = await page.getByTestId('av-sm').evaluate((el) => el.getBoundingClientRect().width);
    const md = await page.getByTestId('av-md').evaluate((el) => el.getBoundingClientRect().width);
    const lg = await page.getByTestId('av-lg').evaluate((el) => el.getBoundingClientRect().width);
    const xl = await page.getByTestId('av-xl').evaluate((el) => el.getBoundingClientRect().width);
    expect(xs).toBeLessThan(sm);
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
    expect(lg).toBeLessThan(xl);
  });

  test('an avatar group overlaps siblings via a negative margin', async ({ page }) => {
    const group = page.getByTestId('av-group');
    const children = group.locator('.hc-avatar');
    await expect(children).toHaveCount(4);
    // Second through Nth child should have negative margin-inline-start.
    const margin = await children.nth(1).evaluate((el) => getComputedStyle(el).marginInlineStart);
    expect(parseFloat(margin)).toBeLessThan(0);
  });

  test('axe finds no violations across the avatar section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-avatar')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-avatar — image fallback', () => {
  test('a loadable image resolves to data-state="loaded" with the fallback hidden', async ({
    page,
  }) => {
    const av = page.getByTestId('av-img-ok');
    await expect(av).toHaveAttribute('data-state', 'loaded');
    // The image is visible; the fallback is hidden.
    await expect(av.locator('.hc-avatar__image')).toBeVisible();
    const vis = await av
      .locator('.hc-avatar__fallback')
      .evaluate((el) => getComputedStyle(el).visibility);
    expect(vis).toBe('hidden');
  });

  test('a broken image falls back to the initials with data-state="error"', async ({ page }) => {
    const av = page.getByTestId('av-img-broken');
    await expect(av).toHaveAttribute('data-state', 'error');
    // The broken image is removed; the fallback initials show.
    const display = await av
      .locator('.hc-avatar__image')
      .evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
    await expect(av.locator('.hc-avatar__fallback')).toBeVisible();
    await expect(av.locator('.hc-avatar__fallback')).toHaveText('JS');
  });
});
