import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-empty', () => {
  test('is a centered vertical stack', async ({ page }) => {
    const empty = page.getByTestId('empty');
    const layout = await empty.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        direction: cs.flexDirection,
        align: cs.alignItems,
        textAlign: cs.textAlign,
      };
    });
    expect(layout.display).toBe('flex');
    expect(layout.direction).toBe('column');
    expect(layout.align).toBe('center');
    expect(layout.textAlign).toBe('center');
  });

  test('renders media, title, description and actions in order', async ({ page }) => {
    await expect(page.getByTestId('empty-media')).toBeVisible();
    await expect(page.getByTestId('empty-title')).toHaveText('No results');
    await expect(page.getByTestId('empty-description')).toBeVisible();
    await expect(page.getByTestId('empty-actions').getByRole('button')).toHaveCount(2);

    // The media slot sits above the title (vertical order).
    const mediaBox = await page.getByTestId('empty-media').boundingBox();
    const titleBox = await page.getByTestId('empty-title').boundingBox();
    expect(mediaBox.y).toBeLessThan(titleBox.y);
  });

  test('the decorative media glyph is hidden from assistive tech', async ({ page }) => {
    await expect(page.getByTestId('empty-media')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the description is width-capped for readability', async ({ page }) => {
    const maxWidth = await page
      .getByTestId('empty-description')
      .evaluate((el) => getComputedStyle(el).maxInlineSize);
    // --hc-empty-description-max-width resolves to a finite ch-based length.
    expect(maxWidth).not.toBe('none');
    expect(parseFloat(maxWidth)).toBeGreaterThan(0);
  });

  test('axe finds no violations across the empty-state example', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-empty').analyze();
    expect(results.violations).toEqual([]);
  });
});
