import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-range (installRange) — a dual-thumb range built from two
// overlapping native inputs. The behavior clamps low ≤ high, keeps the
// container's fill percentages in sync, and emits hc:rangechange.
test.beforeEach(async ({ page }) => {
  await page.goto('/range.html');
});

test.describe('hc-range', () => {
  test('both thumbs are keyboard-operable native inputs', async ({ page }) => {
    const low = page.locator('#low');
    await low.focus();
    await page.keyboard.press('ArrowRight');
    await expect(low).toHaveJSProperty('value', '21');

    const high = page.locator('#high');
    await high.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(high).toHaveJSProperty('value', '79');
  });

  test('the behavior syncs the fill percentages onto the container', async ({ page }) => {
    const range = page.getByTestId('range');
    await expect(range).toHaveCSS('--hc-range-low', '20');
    await page.locator('#low').focus();
    await page.keyboard.press('ArrowRight');
    await expect(range).toHaveCSS('--hc-range-low', '21');
  });

  test('dragging low past high clamps to high (the sibling holds)', async ({ page }) => {
    const low = page.locator('#low');
    await low.evaluate((el) => {
      el.value = '95';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(low).toHaveJSProperty('value', '80');
    await expect(page.locator('#high')).toHaveJSProperty('value', '80');
  });

  test('both values serialize natively with the form', async ({ page }) => {
    const values = await page.getByTestId('form').evaluate((form) => {
      const fd = new FormData(form);
      return { min: fd.get('price_min'), max: fd.get('price_max') };
    });
    expect(values).toEqual({ min: '20', max: '80' });
  });

  test('hc:rangechange bubbles with numeric values', async ({ page }) => {
    const detail = await page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('hc:rangechange', (e) => resolve(e.detail), { once: true });
        const low = document.getElementById('low');
        low.value = '25';
        low.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    expect(detail).toEqual({ low: 25, high: 80 });
  });

  test('each thumb is individually draggable despite the overlap', async ({ page }) => {
    // Pointer-events ride on the thumb pseudo-elements: click on the rail
    // near the low thumb must move the LOW input, not the high one.
    const range = page.getByTestId('range');
    const box = await range.boundingBox();
    // Grab the low thumb (at 20%) and drag it to ~40%.
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const low = Number(await page.locator('#low').inputValue());
    expect(low).toBeGreaterThan(30);
    expect(low).toBeLessThan(50);
    await expect(page.locator('#high')).toHaveJSProperty('value', '80');
  });

  test('axe finds no violations in the range section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-range').analyze();
    expect(results.violations).toEqual([]);
  });
});
