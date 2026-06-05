import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-tooltip', () => {
  test('auto-attributes popover and role on each tooltip', async ({ page }) => {
    const tip = page.getByTestId('tt-save-tip');
    await expect(tip).toHaveAttribute('popover', 'manual');
    await expect(tip).toHaveAttribute('role', 'tooltip');
  });

  test('hovering the trigger shows the tooltip after the delay', async ({ page }) => {
    const trigger = page.getByTestId('tt-save');
    const tip = page.getByTestId('tt-save-tip');

    await trigger.hover();
    // Show delay is 300 ms — wait for the popover to actually open.
    await expect(tip).toBeVisible({ timeout: 1000 });
    await expect(tip).toHaveText('Save document');
  });

  test('focusing the trigger shows the tooltip immediately (a11y)', async ({ page }) => {
    const trigger = page.getByTestId('tt-save');
    const tip = page.getByTestId('tt-save-tip');

    await trigger.focus();
    // No 300 ms delay on focus — should be open right away.
    await expect(tip).toBeVisible({ timeout: 100 });
  });

  test('Escape on the trigger hides the tooltip without losing focus', async ({ page }) => {
    const trigger = page.getByTestId('tt-save');
    const tip = page.getByTestId('tt-save-tip');

    await trigger.focus();
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('mouseleave during the show delay cancels the pending show', async ({ page }) => {
    const trigger = page.getByTestId('tt-save');
    const tip = page.getByTestId('tt-save-tip');

    await trigger.hover();
    // Move away before the 300 ms delay completes.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    await expect(tip).toBeHidden();
  });

  test('CSS Anchor Positioning places the tooltip above the trigger by default', async ({ page }) => {
    const trigger = page.getByTestId('tt-save');
    const tip = page.getByTestId('tt-save-tip');

    await trigger.focus();
    await expect(tip).toBeVisible();
    const tBox = await trigger.boundingBox();
    const tipBox = await tip.boundingBox();
    expect(tipBox).not.toBeNull();
    // Default placement is `block-start` (above the trigger). Allow a
    // small fudge for the offset margin.
    expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(tBox.y + 4);
  });

  test('separate tooltips coexist without one closing the other', async ({ page }) => {
    const save = page.getByTestId('tt-save');
    const del = page.getByTestId('tt-delete');
    const saveTip = page.getByTestId('tt-save-tip');
    const delTip = page.getByTestId('tt-del-tip');

    await save.focus();
    await expect(saveTip).toBeVisible();
    // Tabbing to the Delete button blurs Save (hides its tooltip)
    // and focuses Delete (shows its tooltip). Without
    // popover="manual" these would clash — the menu uses
    // popover="auto" which would close the first one anyway. We
    // assert that Delete's tooltip is open and Save's is closed.
    await del.focus();
    await expect(delTip).toBeVisible();
    await expect(saveTip).toBeHidden();
  });

  test('data-side="right" places the tooltip to the inline-end and renders an arrow', async ({
    page,
  }) => {
    const trigger = page.getByTestId('tt-right');
    await trigger.focus(); // focus shows immediately (no delay)
    const tip = page.getByTestId('tt-right-tip');
    await expect(tip).toBeVisible();
    const t = await trigger.boundingBox();
    const p = await tip.boundingBox();
    expect(p.x).toBeGreaterThan(t.x + t.width - 1); // to the right of the trigger
    const arrow = await tip.evaluate((el) => getComputedStyle(el, '::before').width);
    expect(parseFloat(arrow)).toBeGreaterThan(0);
  });

  test('axe finds no violations in the tooltip section (open state)', async ({ page }) => {
    await page.getByTestId('tt-save').focus();
    await expect(page.getByTestId('tt-save-tip')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('#section-tooltip')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
