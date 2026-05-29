import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const leftPanel = (page) => page.getByTestId('sp').locator('.hc-splitter__panel').first();

test.describe('hc-splitter', () => {
  test('exposes the window-splitter separator semantics', async ({ page }) => {
    const h = page.getByTestId('sp-handle');
    await expect(h).toHaveAttribute('role', 'separator');
    await expect(h).toHaveAttribute('aria-orientation', 'vertical');
    await expect(h).toHaveAttribute('aria-valuenow', '50');
    await expect(h).toHaveAttribute('aria-valuemin', '10');
    await expect(h).toHaveAttribute('aria-valuemax', '90');
  });

  test('arrow keys resize the primary pane', async ({ page }) => {
    const before = (await leftPanel(page).boundingBox()).width;
    await page.getByTestId('sp-handle').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('sp-handle')).toHaveAttribute('aria-valuenow', '55');
    const after = (await leftPanel(page).boundingBox()).width;
    expect(after).toBeGreaterThan(before);
  });

  test('Home and End jump to the min / max sizes', async ({ page }) => {
    const handle = page.getByTestId('sp-handle');
    await handle.focus();
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '90');
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '10');
  });

  test('dragging the handle resizes the panes', async ({ page }) => {
    const handle = page.getByTestId('sp-handle');
    // The section is far down the page; page.mouse uses viewport
    // coordinates, so bring the handle on-screen before measuring.
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const now = Number(await handle.getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThan(50);
  });

  test('axe finds no violations in the splitter section', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#section-splitter')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
