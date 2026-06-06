import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const day = (iso) => `.hc-calendar__day[data-date="${iso}"]`;

test.describe('hc-calendar', () => {
  // Scope to the single-date calendar — the section also holds a range one.
  const calOf = (page) => page.getByTestId('cal');

  test('renders the configured month grid', async ({ page }) => {
    const cal = calOf(page);
    await expect(cal.locator('.hc-calendar__title')).toHaveText('May 2026');
    await expect(cal.locator('.hc-calendar__grid')).toHaveAttribute('role', 'grid');
    await expect(cal.locator('.hc-calendar__grid th')).toHaveCount(7);
    await expect(cal.locator('.hc-calendar__day')).toHaveCount(42);
    await expect(cal.locator(day('2026-05-15'))).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking a day selects it and dispatches hc:calendarchange', async ({ page }) => {
    const cal = calOf(page);
    const value = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.querySelector('[data-testid="cal"]').addEventListener(
            'hc:calendarchange',
            (e) => resolve(e.detail.value),
            { once: true },
          );
        }),
    );
    await cal.locator(day('2026-05-20')).click();
    expect(await value).toBe('2026-05-20');
    await expect(cal.locator(day('2026-05-20'))).toHaveAttribute('aria-selected', 'true');
    await expect(cal.locator(day('2026-05-15'))).not.toHaveAttribute('aria-selected', 'true');
  });

  test('arrow keys move focus and cross the month boundary', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator(day('2026-05-31')).click(); // select + focus 31
    await page.keyboard.press('ArrowRight'); // → June 1, re-renders to June
    await expect(cal.locator('.hc-calendar__title')).toHaveText('June 2026');
    await expect(cal.locator(day('2026-06-01'))).toBeFocused();
  });

  test('PageDown moves forward a month', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator(day('2026-05-15')).click();
    await page.keyboard.press('PageDown');
    await expect(cal.locator('.hc-calendar__title')).toHaveText('June 2026');
  });

  test('the next button advances the month', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator('[data-hc-calendar-next]').click();
    await expect(cal.locator('.hc-calendar__title')).toHaveText('June 2026');
  });

  test('days outside min / max are disabled and not selectable', async ({ page }) => {
    const cal = calOf(page);
    const out = cal.locator(day('2026-05-01')); // before data-min 2026-05-04
    await expect(out).toHaveAttribute('aria-disabled', 'true');
    await out.click({ force: true });
    await expect(out).not.toHaveAttribute('aria-selected', 'true');
    await expect(cal.locator(day('2026-05-15'))).toHaveAttribute('aria-selected', 'true');
  });

  test('axe finds no violations in the calendar section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-calendar')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-calendar — range mode', () => {
  const calOf = (page) => page.getByTestId('cal-range');

  test('parses START/END and paints the band with both ends', async ({ page }) => {
    const cal = calOf(page);
    await expect(cal.locator(day('2026-05-10'))).toHaveAttribute('data-range-start', '');
    await expect(cal.locator(day('2026-05-10'))).toHaveAttribute('aria-selected', 'true');
    await expect(cal.locator(day('2026-05-14'))).toHaveAttribute('data-range-end', '');
    await expect(cal.locator(day('2026-05-12'))).toHaveAttribute('data-in-range', '');
  });

  test('two clicks pick a fresh range; the band fills between them', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator(day('2026-05-20')).click(); // both ends were set → new start
    await expect(cal.locator(day('2026-05-20'))).toHaveAttribute('data-range-start', '');
    await expect(cal.locator(day('2026-05-22'))).not.toHaveAttribute('data-in-range', '');

    await cal.locator(day('2026-05-22')).click();
    await expect(cal.locator(day('2026-05-22'))).toHaveAttribute('data-range-end', '');
    await expect(cal.locator(day('2026-05-21'))).toHaveAttribute('data-in-range', '');
  });

  test('hovering after the first click previews the tentative band', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator(day('2026-05-20')).click(); // start a new range
    await cal.locator(day('2026-05-24')).hover();
    await expect(cal.locator(day('2026-05-24'))).toHaveAttribute('data-range-preview-end', '');
    await expect(cal.locator(day('2026-05-22'))).toHaveAttribute('data-range-preview', '');
  });

  test('emits hc:calendarrangechange with start and end', async ({ page }) => {
    const cal = calOf(page);
    const result = page.evaluate(
      () =>
        new Promise((resolve) => {
          const el = document.querySelector('[data-testid="cal-range"]');
          const seen = [];
          el.addEventListener('hc:calendarrangechange', (e) => {
            seen.push({ start: e.detail.start, end: e.detail.end });
            if (seen.length === 2) resolve(seen);
          });
        }),
    );
    await cal.locator(day('2026-05-20')).click();
    await cal.locator(day('2026-05-23')).click();
    expect(await result).toEqual([
      { start: '2026-05-20', end: null },
      { start: '2026-05-20', end: '2026-05-23' },
    ]);
  });

  test('keyboard: Enter sets both ends', async ({ page }) => {
    const cal = calOf(page);
    await cal.locator(day('2026-05-10')).click(); // new start at 10
    await cal.locator(day('2026-05-10')).press('ArrowRight'); // focus 11
    await cal.locator(day('2026-05-11')).press('Enter'); // end at 11
    await expect(cal.locator(day('2026-05-10'))).toHaveAttribute('data-range-start', '');
    await expect(cal.locator(day('2026-05-11'))).toHaveAttribute('data-range-end', '');
  });
});
