import { test, expect } from '@playwright/test';

// The elevation scale (--hc-shadow-sm/md/lg/overlay) ships from the token
// pipeline with [data-theme="dark"] overrides: a shadow tuned for a light
// page is nearly invisible on a dark surface, so the dark steps carry
// stronger alphas. Components read the scale with var(), so the same
// element re-resolves its elevation inside a dark wrapper.

const NAMES = ['--hc-shadow-sm', '--hc-shadow-md', '--hc-shadow-lg', '--hc-shadow-overlay'];

test.describe('elevation shadow tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const wrap = document.createElement('section');
      wrap.innerHTML = `
        <span data-testid="st-light-probe"></span>
        <menu class="hc-menu" data-testid="st-light-menu" style="display:block">
          <li><button type="button" class="hc-menu__item">Item</button></li>
        </menu>
        <div data-theme="dark">
          <span data-testid="st-dark-probe"></span>
          <menu class="hc-menu" data-testid="st-dark-menu" style="display:block">
            <li><button type="button" class="hc-menu__item">Item</button></li>
          </menu>
        </div>`;
      document.body.appendChild(wrap);
    });
  });

  for (const name of NAMES) {
    test(`${name} resolves and differs between light and dark`, async ({ page }) => {
      const read = (testid) =>
        page.getByTestId(testid).evaluate(
          (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim(),
          name,
        );
      const light = await read('st-light-probe');
      const dark = await read('st-dark-probe');
      expect(light, `${name} (light)`).not.toBe('');
      expect(dark, `${name} (dark)`).not.toBe('');
      expect(dark).not.toBe(light);
    });
  }

  test('hc-menu box-shadow is the token value, re-resolved per theme', async ({ page }) => {
    const shadowOf = (testid) =>
      page.getByTestId(testid).evaluate((el) => getComputedStyle(el).boxShadow);
    const light = await shadowOf('st-light-menu');
    const dark = await shadowOf('st-dark-menu');
    // Chromium serialises the colour first: "rgba(0, 0, 0, 0.12) 0px 8px 24px 0px".
    expect(light).not.toBe('none');
    expect(light).toContain('0.12');
    expect(dark).not.toBe('none');
    expect(dark).toContain('0.5');
    expect(dark).not.toBe(light);
  });
});
