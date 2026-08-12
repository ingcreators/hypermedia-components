import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The saved-views recall surface: the menu beside the screen title.
// Recall is navigation (a view is a named URL), so what these pin is
// that the markup keeps saying so — links, one applied view, and an
// undo that goes back to the view instead of resetting the form to the
// state it is supposed to undo.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/saved-views-menu.html', { waitUntil: 'domcontentloaded' });
});

test.describe('saved views menu', () => {
  test('the trigger names the applied view and says it is modified', async ({
    page,
  }) => {
    const trigger = page.getByTestId('trigger');
    await expect(trigger).toHaveAccessibleName(/Overdue shipments/);
    await expect(trigger).toHaveAccessibleName(/Modified/);
  });

  test('opens from the trigger and closes on Escape', async ({ page }) => {
    const menu = page.getByTestId('menu');
    await expect(menu).toBeHidden();
    await page.getByTestId('trigger').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('every view is a real link, so a view stays bookmarkable', async ({
    page,
  }) => {
    const items = await page.getByTestId('menu').evaluate((menu) =>
      [...menu.querySelectorAll('.hc-menu__item')].map((el) => ({
        tag: el.tagName,
        href: el.getAttribute('href'),
      })),
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.tag === 'A' && i.href)).toBe(true);
  });

  test('exactly one view is applied, with a none-of-them option', async ({
    page,
  }) => {
    const state = await page.getByTestId('menu').evaluate((menu) => {
      const radios = [...menu.querySelectorAll('[role="menuitemradio"]')];
      return {
        radios: radios.length,
        checked: radios.filter((r) => r.getAttribute('aria-checked') === 'true')
          .length,
      };
    });
    expect(state.checked).toBe(1);
    expect(state.radios).toBeGreaterThan(1);

    // "Show everything" is the way back: a bare list URL, no view param.
    const everything = await page.getByTestId('everything').getAttribute('href');
    expect(new URL(everything, 'https://x.test').searchParams.has('view')).toBe(
      false,
    );
  });

  test('the undo is a link to the view, never a form reset', async ({
    page,
  }) => {
    const reset = page.getByTestId('reset');
    await expect(reset).toHaveAttribute('href', /view=overdue/);

    // A native reset restores the values the server rendered — after an
    // apply plus a tweak, that IS the modified state.
    const resets = await page
      .getByTestId('panel')
      .evaluate((el) => el.querySelectorAll('button[type="reset"]').length);
    expect(resets).toBe(0);
  });

  test('no axe violations with the menu open', async ({ page }) => {
    // Theme transitions can be sampled mid-flight by the colour-contrast
    // check; reduced motion settles them first.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('menu')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
