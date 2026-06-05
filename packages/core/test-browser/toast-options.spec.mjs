import { test, expect } from '@playwright/test';

const fire = (page, message) =>
  page.evaluate(
    (m) =>
      document.body.dispatchEvent(
        new CustomEvent('hc:toast', { bubbles: true, detail: { message: m, duration: 0 } }),
      ),
    message,
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/toast-options.html');
});

test.describe('toast options', () => {
  test('data-position anchors the region (top-center)', async ({ page }) => {
    await fire(page, 'Positioned');
    const geom = await page.getByTestId('region').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, centerX: r.left + r.width / 2, vw: window.innerWidth };
    });
    // Anchored to the top (the default bottom-right region would sit near the
    // bottom of the viewport)…
    expect(geom.top).toBeLessThan(40);
    // …and horizontally centred.
    expect(Math.abs(geom.centerX - geom.vw / 2)).toBeLessThan(6);
  });

  test('data-limit caps the visible stack, evicting the oldest', async ({ page }) => {
    await fire(page, 'one');
    await fire(page, 'two');
    await fire(page, 'three');
    await fire(page, 'four');

    const region = page.getByTestId('region');
    await expect(region.locator('.hc-toast')).toHaveCount(3);
    await expect(region.getByText('one')).toHaveCount(0); // oldest gone
    await expect(region.getByText('four')).toHaveCount(1);
  });

  test('swiping a toast far enough dismisses it', async ({ page }) => {
    await fire(page, 'Swipe to dismiss');
    const toast = page.getByTestId('region').locator('.hc-toast');
    await expect(toast).toHaveCount(1);

    const box = await toast.boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 240, y, { steps: 8 });
    await page.mouse.up();

    await expect(toast).toHaveCount(0);
  });
});
