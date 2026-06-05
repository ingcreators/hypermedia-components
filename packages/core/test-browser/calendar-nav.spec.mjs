import { test, expect } from '@playwright/test';

// data-nav="select": the calendar header shows month + year dropdowns for
// jumping to a far month/year in one step.
test.beforeEach(async ({ page }) => {
  await page.goto('/calendar-nav.html');
});

const day = (page, iso) => page.locator(`.hc-calendar__day[data-date="${iso}"]`);

test.describe('calendar month/year quick nav', () => {
  test('shows month + year dropdowns instead of a static title', async ({ page }) => {
    const cal = page.getByTestId('cal');
    await expect(cal.locator('.hc-calendar__month-select')).toBeVisible();
    await expect(cal.locator('.hc-calendar__year-select')).toBeVisible();
    await expect(cal.locator('.hc-calendar__title')).toHaveCount(0);
    // reflects the pinned month (May = "4") / year
    await expect(cal.locator('.hc-calendar__month-select')).toHaveValue('4');
    await expect(cal.locator('.hc-calendar__year-select')).toHaveValue('2026');
  });

  test('selecting a month jumps to it', async ({ page }) => {
    await page.getByTestId('cal').locator('.hc-calendar__month-select').selectOption('0'); // January
    await expect(day(page, '2026-01-01')).toBeVisible();
    await expect(day(page, '2026-05-15')).toHaveCount(0); // left May
  });

  test('selecting a year jumps to it', async ({ page }) => {
    await page.getByTestId('cal').locator('.hc-calendar__year-select').selectOption('2030');
    await expect(day(page, '2030-05-01')).toBeVisible();
  });
});
