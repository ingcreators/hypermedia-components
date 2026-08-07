// installShowWhen (#428) — declarative conditional field visibility.
// The fixture pins install-time evaluation, change-driven re-evaluation
// (no request, no focus loss), radio-group switches, and the
// data-hc-show-src cross-form override.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/show-when.html');
});

test.describe('installShowWhen', () => {
  test('install-time evaluation corrects visibility before any interaction', async ({ page }) => {
    // Server rendered `hidden` on upper (matches switch) and nothing on
    // bound (also matches) — both are as-rendered after install.
    await expect(page.getByTestId('bound-field')).toBeVisible();
    await expect(page.getByTestId('upper-field')).toBeHidden();
    // The src-override panel matches its out-of-form switch.
    await expect(page.getByTestId('sql-panel')).toBeVisible();
  });

  test('changing the switch shows/hides without focus loss', async ({ page }) => {
    const rule = page.getByTestId('rule-switch');
    await rule.focus();
    await rule.selectOption('range');

    await expect(page.getByTestId('upper-field')).toBeVisible();
    await expect(page.getByTestId('bound-field')).toBeVisible();
    await expect(rule).toBeFocused();

    await rule.selectOption('exact');
    await expect(page.getByTestId('upper-field')).toBeHidden();
  });

  test('a radio-group switch drives visibility by the checked value', async ({ page }) => {
    await expect(page.getByTestId('advanced-panel')).toBeHidden();
    await page.getByTestId('mode-advanced').check();
    await expect(page.getByTestId('advanced-panel')).toBeVisible();
    await page.getByTestId('mode-simple').check();
    await expect(page.getByTestId('advanced-panel')).toBeHidden();
  });

  test('data-hc-show-src overrides the closest-form switch', async ({ page }) => {
    await page.getByTestId('global-mode').selectOption('js');
    await expect(page.getByTestId('sql-panel')).toBeHidden();
    await page.getByTestId('global-mode').selectOption('sql');
    await expect(page.getByTestId('sql-panel')).toBeVisible();
  });

  test('hidden fields keep submitting (hidden attribute only, no disabled)', async ({ page }) => {
    const entries = await page.evaluate(() => {
      const form = document.querySelector('[data-testid="rule-form"]');
      form.querySelector('[name="upper"]').value = '9';
      return [...new FormData(form).keys()];
    });
    expect(entries).toContain('upper');
  });

  test('elements added after install are evaluated when they arrive', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('[data-testid="rule-form"]').insertAdjacentHTML(
        'beforeend',
        '<div data-hc-show-when="range" data-testid="late-panel">late</div>',
      );
    });
    await expect(page.getByTestId('late-panel')).toBeHidden();
    await page.getByTestId('rule-switch').selectOption('range');
    await expect(page.getByTestId('late-panel')).toBeVisible();
  });

  test('no axe violations in either switch state', async ({ page }) => {
    let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    await page.getByTestId('rule-switch').selectOption('range');
    await page.getByTestId('mode-advanced').check();
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
