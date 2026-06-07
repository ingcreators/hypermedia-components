import { test, expect } from '@playwright/test';

// The neutral axis swaps the surface-family ramp. It must work on a nested
// wrapper (orthogonal to data-color / data-theme / data-density) and in both
// light and dark. Light keeps surfaces white (only bg/text/border/secondary
// change), so a card stays white with a slate border; dark re-tints the
// surface itself via the compound [data-theme="dark"][data-neutral] block.

test.describe('nested data-neutral wrappers re-tint the surface ramp', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const wrap = document.createElement('section');
      wrap.setAttribute('data-testid', 'section-nested-neutral');
      wrap.innerHTML = `
        <div data-neutral="slate" style="padding:.5rem;">
          <div class="hc-card" data-testid="nn-card-light"><div class="hc-card__body">x</div></div>
        </div>
        <div data-theme="dark" data-neutral="slate" style="padding:.5rem;">
          <div class="hc-card" data-testid="nn-card-dark"><div class="hc-card__body">x</div></div>
        </div>`;
      document.body.appendChild(wrap);
    });
  });

  test('light slate: card surface stays white, border becomes slate.300', async ({ page }) => {
    const card = page.getByTestId('nn-card-light');
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    const border = await card.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(bg).toMatch(/rgb\(\s*255,\s*255,\s*255/); // white surface in light
    expect(border).toMatch(/rgb\(\s*203,\s*213,\s*225/); // slate.300 #cbd5e1
  });

  test('dark slate: card surface becomes slate.800', async ({ page }) => {
    const card = page.getByTestId('nn-card-dark');
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(\s*30,\s*41,\s*59/); // slate.800 #1e293b
  });
});
