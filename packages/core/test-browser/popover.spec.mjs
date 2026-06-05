import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('native popover', () => {
  test('opens when the popovertarget button is clicked', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await expect(popover).toBeHidden();

    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    const open = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="demo-popover"]');
      return el?.matches(':popover-open') ?? false;
    });
    expect(open).toBe(true);
  });

  test('closes on Escape', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
  });

  test('closes via popovertarget+popovertargetaction=hide', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    await page.getByTestId('close-popover').click();
    await expect(popover).toBeHidden();
  });

  test('light-dismiss closes when clicking outside (popover=auto)', async ({ page }) => {
    const popover = page.getByTestId('demo-popover');
    await page.getByTestId('open-popover').click();
    await expect(popover).toBeVisible();

    // Click an element that is outside the popover.
    await page.getByTestId('outside-popover').click();
    await expect(popover).toBeHidden();
  });
});

test.describe('installPopover — anchored placement', () => {
  test('wires aria-expanded / aria-controls and syncs on open', async ({ page }) => {
    const trigger = page.getByTestId('place-trigger');
    await expect(trigger).toHaveAttribute('aria-controls', 'place-popover');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('data-side="right" places the popover to the inline-end of the trigger', async ({
    page,
  }) => {
    const trigger = page.getByTestId('place-trigger');
    await trigger.click();
    const pop = page.getByTestId('place-popover');
    await expect(pop).toBeVisible();
    const t = await trigger.boundingBox();
    const p = await pop.boundingBox();
    // To the right of the trigger…
    expect(p.x).toBeGreaterThan(t.x + t.width - 1);
    // …and roughly top-aligned (data-align="start").
    expect(Math.abs(p.y - t.y)).toBeLessThan(t.height + 8);
  });

  test('renders the arrow via the ::before pseudo-element', async ({ page }) => {
    await page.getByTestId('place-trigger').click();
    const size = await page
      .getByTestId('place-popover')
      .evaluate((el) => getComputedStyle(el, '::before').width);
    expect(parseFloat(size)).toBeGreaterThan(0);
  });

  test('axe finds no violations with the anchored popover open', async ({ page }) => {
    await page.getByTestId('place-trigger').click();
    await expect(page.getByTestId('place-popover')).toBeVisible();
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    const results = await new AxeBuilder({ page }).include('#section-popover').analyze();
    expect(results.violations).toEqual([]);
  });
});
