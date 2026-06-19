import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Pins the hc-toc scrollspy (#271) against a real IntersectionObserver:
// scrolling a section to the top marks its link with
// aria-current="location"; the others are cleared.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/spy.html');
});

async function scrollToSection(page, id) {
  await page.evaluate((sectionId) => {
    document.getElementById(sectionId).scrollIntoView();
  }, id);
  // Let the IntersectionObserver callback run.
  await page.waitForTimeout(150);
}

test.describe('hc-toc scrollspy with a real IntersectionObserver', () => {
  test('marks the first section active on load', async ({ page }) => {
    await expect(page.getByTestId('link-inputs')).toHaveAttribute('aria-current', 'location');
  });

  test('moves the active marker as sections scroll to the top', async ({ page }) => {
    await scrollToSection(page, 'sec-sql');
    await expect(page.getByTestId('link-sql')).toHaveAttribute('aria-current', 'location');
    await expect(page.getByTestId('link-inputs')).not.toHaveAttribute('aria-current', 'location');

    await scrollToSection(page, 'sec-tests');
    await expect(page.getByTestId('link-tests')).toHaveAttribute('aria-current', 'location');
    await expect(page.getByTestId('link-sql')).not.toHaveAttribute('aria-current', 'location');
  });

  test('only ever marks one link at a time', async ({ page }) => {
    await scrollToSection(page, 'sec-tests');
    await expect(page.locator('.hc-toc__link[aria-current="location"]')).toHaveCount(1);
  });

  test('does not track a link whose target section is missing', async ({ page }) => {
    await scrollToSection(page, 'sec-tests');
    await expect(page.getByTestId('link-missing')).not.toHaveAttribute('aria-current', 'location');
  });

  test('no WCAG 2.1 AA violations', async ({ page }) => {
    await scrollToSection(page, 'sec-sql');
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations.map((v) => ({ id: v.id, help: v.help }))).toEqual([]);
  });
});
