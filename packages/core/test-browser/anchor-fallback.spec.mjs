import { test, expect } from '@playwright/test';

// Popovers position with CSS Anchor Positioning where available, and fall
// back to JS positioning (anchor-fallback.js) where it isn't (e.g. current
// Firefox). Chromium *does* support anchor positioning, so to exercise the
// fallback we stub CSS.supports('anchor-name', …) to false before the
// behaviors initialise.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = (...args) =>
      /anchor-name|position-anchor/.test(args.join(' ')) ? false : real(...args);
  });
  await page.goto('/anchor-fallback.html');
});

test.describe('anchor-positioning fallback', () => {
  test('the anchor-positioning stub is in effect (sanity)', async ({ page }) => {
    const supported = await page.evaluate(() => CSS.supports('anchor-name', '--x'));
    expect(supported).toBe(false);
  });

  test('the menu is placed next to its trigger (not centred in the viewport)', async ({ page }) => {
    await page.getByTestId('fb-trigger').click();
    const menu = page.getByTestId('fb-menu');
    await expect(menu).toBeVisible();

    const { menuBox, triggerBox, position } = await page.evaluate(() => {
      const m = document.getElementById('fb-menu');
      const t = document.getElementById('menu-trigger');
      return {
        menuBox: m.getBoundingClientRect().toJSON(),
        triggerBox: t.getBoundingClientRect().toJSON(),
        position: getComputedStyle(m).position,
      };
    });

    expect(position).toBe('fixed');
    // Placed just below the trigger (within a few px of the 4px gap)…
    expect(Math.abs(menuBox.top - triggerBox.bottom)).toBeLessThan(12);
    // …and inline-aligned to it, not centred in the viewport.
    expect(Math.abs(menuBox.left - triggerBox.left)).toBeLessThan(4);
  });

  test('the menu tracks the trigger on scroll', async ({ page }) => {
    await page.getByTestId('fb-trigger').click();
    const menu = page.getByTestId('fb-menu');
    await expect(menu).toBeVisible();

    const topBefore = await menu.evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollBy(0, 120));
    // Allow the scroll listener to reposition.
    await page.waitForFunction(
      (before) => {
        const m = document.getElementById('fb-menu');
        const t = document.getElementById('menu-trigger');
        // The menu should have followed the trigger up and stay adjacent.
        return (
          m.getBoundingClientRect().top !== before &&
          Math.abs(m.getBoundingClientRect().top - t.getBoundingClientRect().bottom) < 12
        );
      },
      topBefore,
    );
  });
});
