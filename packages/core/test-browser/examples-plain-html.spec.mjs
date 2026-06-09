import { test, expect } from '@playwright/test';

// Accessibility coverage for the plain-html example (next-phase plan §5.3).
// The example is served on its own port (see playwright.config webServer).
const PLAIN_HTML = 'http://localhost:4322/';

async function axeViolations(page, include) {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  return (await builder.analyze()).violations;
}

test.describe('examples/plain-html — accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PLAIN_HTML);
  });

  test('the whole page has no axe violations', async ({ page }) => {
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the open dialog has no axe violations', async ({ page }) => {
    await page.locator('#open-dialog').click();
    await expect(page.locator('#demo-dialog')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the open drawer has no axe violations', async ({ page }) => {
    await page.locator('#example-open-drawer').click();
    await expect(page.locator('#example-drawer')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
