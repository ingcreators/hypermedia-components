import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-breadcrumb', () => {
  test('renders a nav landmark with an aria-label', async ({ page }) => {
    const nav = page.getByTestId('bc-default');
    await expect(nav).toHaveAttribute('aria-label', 'Default breadcrumb');
    // The container is a <nav> element.
    await expect(nav).toHaveJSProperty('tagName', 'NAV');
  });

  test('the current page is marked with aria-current="page" and not a link', async ({ page }) => {
    const current = page.getByTestId('bc-current');
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toHaveJSProperty('tagName', 'SPAN');
  });

  test('separator is injected via ::before on every item except the first', async ({ page }) => {
    const home = page.getByTestId('bc-home').locator('xpath=..');   // <li>
    const docs = page.getByTestId('bc-docs').locator('xpath=..');

    const homeSep = await home.evaluate((el) => getComputedStyle(el, '::before').content);
    const docsSep = await docs.evaluate((el) => getComputedStyle(el, '::before').content);
    // First item — no separator (content is "none" in modern Chromium).
    expect(homeSep).toBe('none');
    // Subsequent items — default content is "/".
    expect(docsSep).toMatch(/\//);
  });

  test('per-instance --hc-breadcrumb-separator override swaps the glyph', async ({ page }) => {
    const chevronNav = page.getByTestId('bc-chevron');
    // The second <li> inside the chevron breadcrumb.
    const secondItem = chevronNav.locator('li.hc-breadcrumb__item').nth(1);
    const sep = await secondItem.evaluate((el) => getComputedStyle(el, '::before').content);
    expect(sep).toMatch(/›/);
  });

  test('the ellipsis marker is aria-hidden so it is not announced', async ({ page }) => {
    await expect(page.getByTestId('bc-ellipsis')).toHaveAttribute('aria-hidden', 'true');
  });

  test('axe finds no violations across all breadcrumb examples', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-breadcrumb')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
