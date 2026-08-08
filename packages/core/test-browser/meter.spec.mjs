import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-meter — pure-CSS skin for the native <meter>. The element keeps its
// own role/value semantics; the CSS replaces the UA chrome (appearance:
// none + vendor pseudo-elements) and maps the browser's optimum /
// suboptimum / even-less-good regions onto the status tokens.
test.beforeEach(async ({ page }) => {
  await page.goto('/meter.html');
});

// The region fills live in vendor pseudo-elements that getComputedStyle
// cannot query, so color assertions sample a rendered pixel instead.
async function fillPixel(locator) {
  const shot = await locator.screenshot();
  const png = await locator.evaluate(async (_el, bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    // Sample inside the filled region: x at 10% of the bar, y centred.
    const { data } = ctx.getImageData(Math.round(bmp.width * 0.1), Math.round(bmp.height / 2), 1, 1);
    return [data[0], data[1], data[2]];
  }, Array.from(shot));
  return png;
}

const tokenRgb = (page, name) =>
  page.evaluate((n) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    // Tokens are oklch(), so the computed string is not rgb() — paint it
    // and read the pixel back to get the sRGB triple that gets rendered.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, name);

test.describe('hc-meter', () => {
  test('replaces the UA chrome and keeps the native meter role', async ({ page }) => {
    const meter = page.getByTestId('plain');
    const styles = await meter.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { appearance: cs.appearance, display: cs.display, border: cs.borderTopWidth };
    });
    expect(styles.appearance).toBe('none');
    expect(styles.display).toBe('block');
    expect(styles.border).toBe('0px');

    // Native semantics survive the restyle: the element is exposed as a
    // meter with its value, no ARIA needed.
    await expect(meter).toHaveJSProperty('value', 7);
    await expect(meter).toHaveRole('meter');
  });

  test('the three value regions map onto the status tokens', async ({ page }) => {
    const cases = [
      ['optimum', '--hc-meter-optimum-fill'],
      ['suboptimum', '--hc-meter-suboptimum-fill'],
      ['critical', '--hc-meter-critical-fill'],
    ];
    for (const [id, token] of cases) {
      const [er, eg, eb] = await tokenRgb(page, token);
      const [r, g, b] = await fillPixel(page.getByTestId(id));
      // Rendered pixel ≈ token color (allow AA/rounding drift).
      expect(Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb), `${id} fill`).toBeLessThan(24);
    }
  });

  test('data-size swaps the height preset', async ({ page }) => {
    const heights = {};
    for (const id of ['sm', 'plain', 'lg']) {
      heights[id] = await page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().height);
    }
    expect(heights.sm).toBeLessThan(heights.plain);
    expect(heights.plain).toBeLessThan(heights.lg);
  });

  test('axe finds no violations in the meter section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-meter').analyze();
    expect(results.violations).toEqual([]);
  });
});
