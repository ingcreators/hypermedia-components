import { test, expect } from '@playwright/test';

// Regression: nested data-density wrappers must shrink/grow every
// theme-dependent control primitive (button height, input height).
// Pre-fix, --hc-button-height resolved its var(--hc-control-height)
// chain on :root and inherited as a frozen 40 px; the same overlay
// machinery that fixes data-color now also fixes data-density.

const CASES = [
  { density: 'comfortable', height: 40 },
  { density: 'compact',     height: 32 },
  { density: 'dense',       height: 28 },
];

test.describe('nested data-density wrappers resize control primitives', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((cases) => {
      const wrap = document.createElement('section');
      wrap.id = 'section-nested-density';
      wrap.setAttribute('data-testid', 'section-nested-density');
      wrap.innerHTML = cases
        .map(
          (c) => `
            <div data-density="${c.density}" data-testid="nd-preview-${c.density}" style="padding:.5rem;">
              <button class="hc-button" data-testid="nd-btn-${c.density}">Save</button>
              <input class="hc-input" type="text" data-testid="nd-input-${c.density}">
            </div>`,
        )
        .join('');
      document.body.appendChild(wrap);
    }, CASES);
  });

  for (const { density, height } of CASES) {
    test(`data-density="${density}" → button min-block-size = ${height}px`, async ({ page }) => {
      const btn = page.getByTestId(`nd-btn-${density}`);
      // --hc-button-height is the source of truth; min-block-size
      // takes that value via the component CSS.
      const h = await btn.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--hc-button-height').trim(),
      );
      expect(h).toBe(`${height}px`);
    });

    test(`data-density="${density}" → input height = ${height}px`, async ({ page }) => {
      const input = page.getByTestId(`nd-input-${density}`);
      const h = await input.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--hc-input-height').trim(),
      );
      expect(h).toBe(`${height}px`);
    });
  }
});
