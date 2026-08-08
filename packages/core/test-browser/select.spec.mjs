import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-select', () => {
  test('renders an embedded chevron SVG via background-image', async ({ page }) => {
    const sel = page.getByTestId('sel-default');
    const bg = await sel.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('svg');
    // Chevron stroke colour is hardcoded gray.500 (#6b7280 → %236b7280).
    expect(bg).toContain('%236b7280');
  });

  test('chevron flips to the inline-end under RTL (no overlap with text)', async ({ page }) => {
    const sel = page.getByTestId('sel-default');
    const ltr = await sel.evaluate((el) => getComputedStyle(el).backgroundPositionX);
    await sel.evaluate((el) => el.setAttribute('dir', 'rtl'));
    const rtl = await sel.evaluate((el) => getComputedStyle(el).backgroundPositionX);
    await sel.evaluate((el) => el.removeAttribute('dir'));
    // The `.hc-select:dir(rtl)` override re-anchors the chevron from the
    // physical right to the physical left, so it no longer lands on top of
    // the right-aligned text.
    expect(rtl).not.toBe(ltr);
    expect(rtl).toMatch(/^\d+(\.\d+)?px$/);
  });

  test('focus shows the focus-ring box-shadow', async ({ page }) => {
    const sel = page.getByTestId('sel-default');
    await sel.focus();
    const shadow = await sel.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });

  test('aria-invalid + data-variant="error" swaps the border to error', async ({ page }) => {
    // semantic.color.error → primitive.color.red.600
    expect(await cssColor(page.getByTestId('sel-error'), 'borderTopColor')).toBe('rgb(206, 14, 24)');
  });

  test('data-variant="success" swaps the border to success', async ({ page }) => {
    // semantic.color.success → primitive.color.green.600
    expect(await cssColor(page.getByTestId('sel-success'), 'borderTopColor')).toBe('rgb(9, 131, 91)');
  });

  test('disabled state reduces opacity and changes cursor', async ({ page }) => {
    const sel = page.getByTestId('sel-disabled');
    await expect(sel).toBeDisabled();
    const opacity = await sel.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeLessThan(1);
    const cursor = await sel.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('not-allowed');
  });

  test('data-size="sm" / "lg" change the min height', async ({ page }) => {
    const sm = page.getByTestId('sel-sm');
    const lg = page.getByTestId('sel-lg');

    const smH = await sm.evaluate((el) => el.getBoundingClientRect().height);
    const lgH = await lg.evaluate((el) => el.getBoundingClientRect().height);
    expect(lgH).toBeGreaterThan(smH);
  });

  test('selecting an option fires the native change event (form integration)', async ({ page }) => {
    const sel = page.getByTestId('sel-default');
    // Bind a probe listener and pick "jp".
    await sel.evaluate((el) => {
      el.dataset.lastChange = '';
      el.addEventListener('change', () => { el.dataset.lastChange = el.value; });
    });
    await sel.selectOption('jp');
    const seen = await sel.evaluate((el) => el.dataset.lastChange);
    expect(seen).toBe('jp');
  });

  test('axe finds no violations in the select section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-select')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
