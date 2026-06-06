import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-drawer', () => {
  test('showModal opens the right-side drawer with native modal semantics', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('open', '');
  });

  test('right-side drawer anchors to the inline-end edge of the viewport', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    // Wait for the slide animation to land.
    await page.waitForTimeout(300);
    const box = await drawer.boundingBox();
    const vp = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeGreaterThanOrEqual(vp.width - 2);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2);
  });

  test('the close (×) button submits its form[method=dialog] and closes', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await expect(drawer).toBeVisible();
    await page.getByTestId('dr-right-x').click();
    await expect(drawer).toBeHidden();
  });

  test('Escape closes the drawer (native dialog behaviour)', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('clicking the backdrop (outside the drawer) closes it (installDrawer)', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await page.waitForTimeout(300);
    // Click on the far inline-start edge of the viewport — well
    // outside the drawer panel.
    await page.mouse.click(20, 200);
    await expect(drawer).toBeHidden();
  });

  test('clicking inside the drawer body does NOT close it', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await page.waitForTimeout(300);
    await page.getByTestId('dr-right-body').click();
    await expect(drawer).toBeVisible();
  });

  test('bottom-side drawer anchors to the block-end edge', async ({ page }) => {
    await page.getByTestId('dr-open-bottom').click();
    await page.waitForTimeout(300);
    const box = await page.getByTestId('dr-bottom').boundingBox();
    const vp = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeGreaterThanOrEqual(vp.height - 2);
  });

  test('dragging the header outward past the threshold closes the drawer', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await page.waitForTimeout(300); // settle the slide-in
    const title = drawer.locator('.hc-drawer__title');
    const box = await title.boundingBox();
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 280, y, { steps: 12 }); // drag right, well past 40%
    await page.mouse.up();

    await expect(drawer).toBeHidden();
  });

  test('a short drag snaps back and keeps the drawer open', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    const drawer = page.getByTestId('dr-right');
    await page.waitForTimeout(300);
    const title = drawer.locator('.hc-drawer__title');
    const box = await title.boundingBox();
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;

    // A small, deliberate drag (well under 40% of the panel, low velocity).
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y);
    await page.waitForTimeout(60);
    await page.mouse.move(x + 20, y);
    await page.waitForTimeout(60);
    await page.mouse.move(x + 28, y);
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(250); // let the snap-back settle

    await expect(drawer).toBeVisible();
  });

  test('axe finds no violations in the open drawer', async ({ page }) => {
    await page.getByTestId('dr-open-right').click();
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page })
      .include('#dr-right')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
