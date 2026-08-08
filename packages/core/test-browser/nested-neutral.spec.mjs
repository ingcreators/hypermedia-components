import { test, expect } from '@playwright/test';
import { cssColor } from './helpers/color.mjs';

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
        </div>
        <div data-theme="dark" style="padding:.5rem;">
          <div data-neutral="slate">
            <div class="hc-card" data-testid="nn-card-dark-descendant"><div class="hc-card__body">x</div></div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    });
  });

  test('light slate: card surface stays white, border becomes slate.300', async ({ page }) => {
    const card = page.getByTestId('nn-card-light');
    const bg = await cssColor(card, 'backgroundColor');
    const border = await cssColor(card, 'borderTopColor');
    expect(bg).toBe('rgb(255, 255, 255)'); // white surface in light
    expect(border).toBe('rgb(203, 213, 225)'); // slate.300 #cbd5e1
  });

  test('dark slate (both attrs on one element): card surface becomes slate.800', async ({ page }) => {
    const card = page.getByTestId('nn-card-dark');
    const bg = await cssColor(card, 'backgroundColor');
    expect(bg).toBe('rgb(30, 41, 59)'); // slate.800 #1e293b
  });

  // The realistic case: data-theme="dark" on an ancestor (e.g. <html>),
  // data-neutral on a descendant. Must still pick the dark ramp, not the
  // light one. (Regression: the compound selector alone missed this.)
  test('dark slate (theme on ancestor, neutral on descendant): card surface becomes slate.800', async ({ page }) => {
    const card = page.getByTestId('nn-card-dark-descendant');
    const bg = await cssColor(card, 'backgroundColor');
    expect(bg).toBe('rgb(30, 41, 59)'); // slate.800 #1e293b, not light
  });
});
