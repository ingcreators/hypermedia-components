import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Pins data-hc-nav-current (#272): aria-current="page" tracks the URL on
// load, after htmx history navigation, and on back/forward — without
// actually navigating away (history.pushState + the events the behavior
// listens for).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function navigate(page, path, { popstate = false } = {}) {
  await page.evaluate(
    ({ p, pop }) => {
      history.pushState({}, '', p);
      if (pop) {
        window.dispatchEvent(new Event('popstate'));
      } else {
        document.body.dispatchEvent(new CustomEvent('htmx:pushedIntoHistory', { bubbles: true }));
      }
    },
    { p: path, pop: popstate },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/nav-current.html');
});

test.describe('data-hc-nav-current', () => {
  test('marks the link for the current page on load', async ({ page }) => {
    await expect(page.getByTestId('nav-here')).toHaveAttribute('aria-current', 'page');
  });

  test('re-marks the exact match after htmx history navigation', async ({ page }) => {
    await navigate(page, '/app/docs');
    await expect(page.getByTestId('nav-docs')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-here')).not.toHaveAttribute('aria-current', 'page');
  });

  test('longest prefix wins on a subpage', async ({ page }) => {
    await navigate(page, '/app/docs/coverage/detail');
    await expect(page.getByTestId('nav-cov')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-docs')).not.toHaveAttribute('aria-current', 'page');
  });

  test('re-marks on back/forward (popstate)', async ({ page }) => {
    await navigate(page, '/app/docs');
    await navigate(page, '/app/explorer', { popstate: true });
    await expect(page.getByTestId('nav-explorer')).toHaveAttribute('aria-current', 'page');
  });

  test('ignores a cross-origin link with a matching pathname', async ({ page }) => {
    await navigate(page, '/app/docs');
    await expect(page.getByTestId('nav-ext')).not.toHaveAttribute('aria-current', 'page');
  });

  test('marks exactly one link at a time', async ({ page }) => {
    await navigate(page, '/app/docs/coverage');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('no WCAG 2.1 AA violations', async ({ page }) => {
    await navigate(page, '/app/docs');
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(violations.map((v) => ({ id: v.id, help: v.help }))).toEqual([]);
  });
});
