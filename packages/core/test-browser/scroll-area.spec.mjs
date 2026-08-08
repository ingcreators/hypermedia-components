import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-scroll-area', () => {
  test('uses a thin, themed scrollbar', async ({ page, browserName }) => {
    // Firefox on the Linux CI runners (headless, no GTK settings
    // daemon) runs with overlay scrollbars and computes
    // scrollbar-width as "none" even though "thin" is specified — the
    // stylesheet contract is not observable there. scrollbar-width /
    // scrollbar-color are Firefox's own long-shipped standard, so
    // desktop Firefox applies them; assert where they are observable.
    test.skip(browserName === 'firefox', 'overlay scrollbars on headless Linux Firefox: computed scrollbar-width is "none"');
    const styles = await page.getByTestId('sa-vertical').evaluate((el) => {
      const cs = getComputedStyle(el);
      // scrollbar-color resolves to "<thumb> <track>". The thumb is an
      // oklch() token now, so paint it and read the pixel back to get
      // the sRGB triple that actually renders.
      const thumb = cs.scrollbarColor.split(/\s+(?=rgb|oklch|color\(|#|[a-z]+$)/)[0];
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = thumb;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return { width: cs.scrollbarWidth, thumb: `rgb(${r}, ${g}, ${b})` };
    });
    expect(styles.width).toBe('thin');
    // thumb defaults to semantic.color.border = gray.300.
    expect(styles.thumb).toBe('rgb(208, 213, 221)');
  });

  test('vertical region scrolls on the block axis only', async ({ page }) => {
    const m = await page.getByTestId('sa-vertical').evaluate((el) => ({
      scrollable: el.scrollHeight > el.clientHeight,
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(m.scrollable).toBe(true);
    expect(m.overflowY).toBe('auto');
    expect(m.overflowX).toBe('hidden');
  });

  test('data-orientation="horizontal" scrolls on the inline axis', async ({ page }) => {
    const m = await page.getByTestId('sa-horizontal').evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(m.scrollable).toBe(true);
    expect(m.overflowX).toBe('auto');
    expect(m.overflowY).toBe('hidden');
  });

  test('actually scrolls when driven programmatically', async ({ page }) => {
    const top = await page.getByTestId('sa-vertical').evaluate((el) => {
      el.scrollTop = 60;
      return el.scrollTop;
    });
    expect(top).toBeGreaterThan(0);
  });

  test('data-shadows paints the edge-shadow gradient layers', async ({ page }) => {
    const bg = await page
      .getByTestId('sa-shadows')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    // Two cover (linear) + two shadow (radial) layers.
    expect(bg).toContain('radial-gradient');
    expect(bg).toContain('linear-gradient');
    expect((bg.match(/gradient/g) || []).length).toBe(4);
  });

  test('a plain scroll-area has no shadow gradients', async ({ page }) => {
    const bg = await page
      .getByTestId('sa-vertical')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toBe('none');
  });

  test('the shadow region still scrolls natively', async ({ page }) => {
    const top = await page.getByTestId('sa-shadows').evaluate((el) => {
      el.scrollTop = 40;
      return el.scrollTop;
    });
    expect(top).toBeGreaterThan(0);
  });

  test('axe finds no violations in the scroll-area section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-scroll-area')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
