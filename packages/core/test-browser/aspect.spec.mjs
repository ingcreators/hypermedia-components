import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-aspect', () => {
  test('data-ratio preset sets the box aspect-ratio and measured shape', async ({ page }) => {
    const box = page.getByTestId('aspect-16-9');
    await expect(box).toHaveCSS('aspect-ratio', '16 / 9');

    const bb = await box.boundingBox();
    expect(bb.width / bb.height).toBeCloseTo(16 / 9, 1);
  });

  test('the default ratio is 1 / 1', async ({ page }) => {
    const box = page.getByTestId('aspect-default');
    await expect(box).toHaveCSS('aspect-ratio', '1 / 1');

    const bb = await box.boundingBox();
    expect(bb.width / bb.height).toBeCloseTo(1, 1);
  });

  test('an inline --hc-aspect-ratio override wins (escape hatch)', async ({ page }) => {
    const box = page.getByTestId('aspect-custom');
    await expect(box).toHaveCSS('aspect-ratio', '4 / 3');

    const bb = await box.boundingBox();
    expect(bb.width / bb.height).toBeCloseTo(4 / 3, 1);
  });

  test('a media child fills the box with object-fit: cover', async ({ page }) => {
    const img = page.getByTestId('aspect-16-9-img');
    await expect(img).toHaveCSS('object-fit', 'cover');

    // The image fills the box on both axes.
    const box = await page.getByTestId('aspect-16-9').boundingBox();
    const imgBox = await img.boundingBox();
    expect(imgBox.width).toBeCloseTo(box.width, 0);
    expect(imgBox.height).toBeCloseTo(box.height, 0);
  });

  test('axe finds no violations across the aspect examples', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-aspect').analyze();
    expect(results.violations).toEqual([]);
  });
});
