// Accessibility audit using @axe-core/playwright.
//
// Scans the fixture page under WCAG 2.0/2.1 A and AA rule sets in a
// few interesting states:
//   - the page on load (every component rendered)
//   - while a <dialog>.showModal() is open
//   - while a native popover is open
//   - while a toast is showing
//
// The fixture intentionally exercises the components our docs
// recommend (native semantics, labels, aria-current, …) so axe
// violations here would indicate a regression in the components
// themselves, not in the docs.

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function violationSummary(violations) {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('a11y — initial page state', () => {
  test('no WCAG 2.1 AA violations on the fixture page', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });
});

test.describe('a11y — dialog open', () => {
  test('no violations while the demo dialog is open', async ({ page }) => {
    await page.getByTestId('open-dialog').click();
    await expect(page.getByTestId('demo-dialog')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });

  test('no violations while the shared confirm dialog is open', async ({ page }) => {
    await page.getByTestId('trigger-confirm').click();
    await expect(page.locator('.hc-confirm-dialog')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });
});

test.describe('a11y — popover open', () => {
  test('no violations while the demo popover is open', async ({ page }) => {
    await page.getByTestId('open-popover').click();
    await expect(page.getByTestId('demo-popover')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });
});

test.describe('a11y — toast visible', () => {
  test('no violations while a sticky toast is showing', async ({ page }) => {
    await page.getByTestId('toast-sticky').click();
    await expect(page.locator('.hc-toast')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });

  test('no violations while a danger toast (role="alert") is showing', async ({ page }) => {
    await page.getByTestId('toast-danger').click();
    await expect(page.locator('.hc-toast[data-variant="danger"]')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violationSummary(violations)).toEqual([]);
  });
});
