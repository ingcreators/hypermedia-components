import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed date-field pattern (#219) — the exact markup the
// calendar docs bless for code generators ("As a custom date field"):
// hc-field + readonly named hc-input + popovertarget trigger +
// hc-calendar[data-target]. Every assertion here is a claim the docs
// make about keyboard, focus, and value sync.
const day = (iso) => `.hc-calendar__day[data-date="${iso}"]`;

test.beforeEach(async ({ page }) => {
  await page.goto('/datefield.html');
});

test.describe('blessed date field (input + popover + hc-calendar)', () => {
  test('the calendar seeds its selection from the input value', async ({ page }) => {
    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('calendar').locator(day('2026-05-15')))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('keyboard flow: open, tab to grid, pick — input fills, popover closes, focus returns to trigger', async ({ page }) => {
    const trigger = page.getByTestId('trigger');
    const popover = page.getByTestId('popover');

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(popover).toBeVisible();

    // Tab walks the calendar header (previous / next month), then the grid —
    // a single tab stop whose roving tabindex sits on the selected day.
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-hc-calendar-prev]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-hc-calendar-next]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('calendar').locator(day('2026-05-15'))).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('input')).toHaveValue('2026-05-16');
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Escape closes the popover without changing the field', async ({ page }) => {
    const trigger = page.getByTestId('trigger');
    await trigger.click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('popover')).toBeHidden();
    await expect(page.getByTestId('input')).toHaveValue('2026-05-15');
  });

  test('the visible input carries the form value (no hidden duplicate)', async ({ page }) => {
    await page.getByTestId('trigger').click();
    await page.getByTestId('calendar').locator(day('2026-05-20')).click();

    const entries = await page.getByTestId('form').evaluate((form) => {
      return [...new FormData(form).entries()];
    });
    expect(entries).toEqual([['due', '2026-05-20']]);
  });

  test('picking fires input and change on the target field', async ({ page }) => {
    await page.getByTestId('input').evaluate((el) => {
      window.__events = [];
      el.addEventListener('input', () => window.__events.push('input'));
      el.addEventListener('change', () => window.__events.push('change'));
    });
    await page.getByTestId('trigger').click();
    await page.getByTestId('calendar').locator(day('2026-05-20')).click();
    expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change']);
  });

  test('axe finds no violations, closed and open', async ({ page }) => {
    const closed = await new AxeBuilder({ page }).analyze();
    expect(closed.violations).toEqual([]);

    await page.getByTestId('trigger').click();
    const open = await new AxeBuilder({ page }).analyze();
    expect(open.violations).toEqual([]);
  });
});
