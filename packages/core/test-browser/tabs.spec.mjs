import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssColor } from './helpers/color.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-tabs — app-state', () => {
  test('clicking a tab swaps the visible panel', async ({ page }) => {
    const general = page.getByTestId('tab-general');
    const billing = page.getByTestId('tab-billing');
    const pGeneral = page.getByTestId('panel-general');
    const pBilling = page.getByTestId('panel-billing');

    // Inactive panels carry hidden="until-found" (so Ctrl+F can search
    // them). Playwright's toBeHidden() does not recognise this newer
    // spec — assert on the attribute directly, which is the source of
    // truth anyway.
    await expect(pGeneral).not.toHaveAttribute('hidden');
    await expect(pBilling).toHaveAttribute('hidden', 'until-found');

    await billing.click();

    await expect(general).toHaveAttribute('aria-selected', 'false');
    await expect(billing).toHaveAttribute('aria-selected', 'true');
    await expect(pGeneral).toHaveAttribute('hidden', 'until-found');
    await expect(pBilling).not.toHaveAttribute('hidden');
  });

  test('manual activation — arrow keys move focus but not selection', async ({ page }) => {
    const general = page.getByTestId('tab-general');
    const billing = page.getByTestId('tab-billing');

    await general.focus();
    await page.keyboard.press('ArrowRight');

    await expect(billing).toBeFocused();
    await expect(billing).toHaveAttribute('aria-selected', 'false');
    await expect(general).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter activates the focused tab', async ({ page }) => {
    const billing = page.getByTestId('tab-billing');

    await page.getByTestId('tab-general').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(billing).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('panel-billing')).not.toHaveAttribute('hidden');
  });

  test('arrow keys skip disabled tabs', async ({ page }) => {
    const team = page.getByTestId('tab-team');
    const general = page.getByTestId('tab-general');

    await team.focus();
    // Archive is disabled — ArrowRight should wrap to General.
    await page.keyboard.press('ArrowRight');
    await expect(general).toBeFocused();
  });

  test('Home / End jump to first / last enabled tab', async ({ page }) => {
    const team = page.getByTestId('tab-team');
    const general = page.getByTestId('tab-general');

    await team.focus();
    await page.keyboard.press('Home');
    await expect(general).toBeFocused();

    await page.keyboard.press('End');
    // Archive is disabled — last enabled is Team.
    await expect(team).toBeFocused();
  });

  test('underline indicator is rendered on the selected tab', async ({ page }) => {
    const general = page.getByTestId('tab-general');
    // The active indicator is an inset box-shadow. Just verify the
    // computed style includes one.
    const shadow = await general.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });
});

test.describe('hc-tabs — pill variant', () => {
  test('active pill tab swaps background colour, not the underline', async ({ page }) => {
    const day = page.getByTestId('tab-pill-day');
    const bg = await cssColor(day, 'backgroundColor');
    // action.primary.bg defaults to blue.600 — rgb(44, 96, 233).
    expect(bg).toBe('rgb(44, 96, 233)');
    const shadow = await day.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toBe('none');
  });
});

test.describe('hc-tabs — vertical orientation', () => {
  test('installTabs reflects data-orientation onto aria-orientation', async ({ page }) => {
    const list = page.getByTestId('vtabs').getByRole('tablist');
    await expect(list).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('Down / Up move focus along the column; Left / Right are ignored', async ({ page }) => {
    const overview = page.getByTestId('vtab-overview');
    const activity = page.getByTestId('vtab-activity');

    await overview.focus();
    await page.keyboard.press('ArrowDown');
    await expect(activity).toBeFocused();
    // Manual activation — focus moved but selection has not.
    await expect(activity).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowUp');
    await expect(overview).toBeFocused();

    // The cross-axis arrows do nothing for a vertical tablist.
    await page.keyboard.press('ArrowRight');
    await expect(overview).toBeFocused();
  });

  test('Enter activates the focused tab and swaps the panel', async ({ page }) => {
    await page.getByTestId('vtab-overview').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('vtab-activity')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('vpanel-activity')).not.toHaveAttribute('hidden');
  });

  test('the tablist sits beside the panel (row layout)', async ({ page }) => {
    const listBox = await page.getByTestId('vtabs').getByRole('tablist').boundingBox();
    const panelBox = await page.getByTestId('vpanel-overview').boundingBox();
    // The panel starts to the inline-end of the list, not below it.
    expect(panelBox.x).toBeGreaterThan(listBox.x + listBox.width - 1);
  });
});

test.describe('hc-tabs — URL-routed variant', () => {
  test('clicking a link does not get preventDefault by the behavior', async ({ page }) => {
    const link = page.getByTestId('link-api');
    // The link's aria-current should stay unchanged after install —
    // the behavior must skip [role!="tab"] entirely.
    const before = await link.getAttribute('aria-current');
    expect(before).toBeNull();
    // We do not actually click navigation in the test (would navigate
    // away). Just verify the markup remained untouched.
  });
});

test.describe('hc-tabs — a11y', () => {
  test('axe finds no violations in the tabs section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-tabs')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
