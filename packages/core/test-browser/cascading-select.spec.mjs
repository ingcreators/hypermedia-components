import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed cascading-select recipe against real htmx: each
// level's change GETs the child <select> fragment (same id/name,
// enabled, wired for ITS child), deeper levels reset out-of-band in the
// same response, and clearing a parent unwinds the chain. The
// /mock/areas/* routes (serve.mjs) stand in for the server.

test.beforeEach(async ({ page }) => {
  await page.goto('/cascading-select.html');
});


// htmx initializes swapped-in content as it settles (~20ms); a change
// fired before that is lost. Real users can't act that fast — the specs
// can, so interactions with a just-swapped select wait for settle.
const settled = async (page, sel) => {
  const el = page.locator(sel);
  await expect(el).toBeEnabled();
  await expect(el).not.toHaveClass(/htmx-(settling|added|swapping)/);
  return el;
};

test.describe('cascading select recipe', () => {
  test('choosing a parent populates and enables the child', async ({ page }) => {
    await page.locator('#prefecture').selectOption('13'); // Tokyo

    const city = page.locator('#city');
    await expect(city).toBeEnabled();
    await expect(city.locator('option')).toHaveCount(4); // placeholder + 3
    // The child comes back wired for its own child.
    await expect(city).toHaveAttribute('data-hx-get', '/mock/areas/wards');
    await expect(city).toHaveAttribute('data-hx-include', 'this');
  });

  test('the third level loads from the second', async ({ page }) => {
    await page.locator('#prefecture').selectOption('13');
    await (await settled(page, '#city')).selectOption('13101'); // Chiyoda

    const ward = page.locator('#ward');
    await expect(ward).toBeEnabled();
    await expect(ward.locator('option')).toHaveCount(3); // placeholder + 2
  });

  test('changing the parent resets deeper levels out-of-band', async ({ page }) => {
    await page.locator('#prefecture').selectOption('13');
    await (await settled(page, '#city')).selectOption('13101');
    await expect(page.locator('#ward')).toBeEnabled();

    // Switch prefecture: the city re-populates AND the ward resets via
    // the OOB fragment in the same response.
    await page.locator('#prefecture').selectOption('27'); // Osaka
    await expect(page.locator('#city').locator('option')).toHaveCount(3); // placeholder + 2
    await expect(page.locator('#ward')).toBeDisabled();
    await expect(page.locator('#ward')).toContainText('Select a city first');
  });

  test('clearing the parent unwinds the chain to placeholders', async ({ page }) => {
    await page.locator('#prefecture').selectOption('13');
    await settled(page, '#city');

    await page.locator('#prefecture').selectOption(''); // back to placeholder
    await expect(page.locator('#city')).toBeDisabled();
    await expect(page.locator('#city')).toContainText('Select a prefecture first');
    await expect(page.locator('#ward')).toBeDisabled();
  });

  test('every level keeps its label association across swaps', async ({ page }) => {
    await page.locator('#prefecture').selectOption('13');
    await expect(page.locator('#city')).toBeEnabled();
    // The swapped-in child keeps id="city", so the label still points at it.
    await expect(page.getByLabel('City')).toBeEnabled();

    const results = await new AxeBuilder({ page }).include('#section-cascade').analyze();
    expect(results.violations).toEqual([]);
  });
});
