import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Disable transitions so the off-canvas sidebar snaps into place and
// geometry is deterministic. hc-shell.css already drops the transition
// under prefers-reduced-motion.
test.use({ reducedMotion: 'reduce' });

const DESKTOP = { width: 1280, height: 720 };
const MOBILE = { width: 480, height: 800 };

const rect = (loc) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });

const display = (loc) => loc.evaluate((el) => getComputedStyle(el).display);

test.beforeEach(async ({ page }) => {
  // The shell is static HTML; the behavior installs on DOMContentLoaded.
  // Waiting for full `load` adds several seconds for no benefit here.
  await page.goto('/shell.html', { waitUntil: 'domcontentloaded' });
  // Kill all transitions so geometry is measured at rest. Switching the
  // viewport (desktop ↔ mobile) animates the sidebar's transform; this
  // makes every rect read deterministic regardless of timing.
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
});

test.describe('hc-shell — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test('fills the viewport height', async ({ page }) => {
    const r = await rect(page.getByTestId('shell'));
    expect(Math.abs(r.height - DESKTOP.height)).toBeLessThan(4); // 100dvh
  });

  test('default layout: a full-width header over a sidebar | main | aside row', async ({
    page,
  }) => {
    const header = await rect(page.getByTestId('shell-header'));
    const sidebar = await rect(page.getByTestId('shell-sidebar'));
    const main = await rect(page.getByTestId('shell-main'));
    const aside = await rect(page.getByTestId('shell-aside'));
    const footer = await rect(page.getByTestId('shell-footer'));
    // header spans the full viewport width along the top
    expect(header.left).toBeLessThan(2);
    expect(Math.abs(header.right - DESKTOP.width)).toBeLessThan(2);
    expect(header.top).toBeLessThan(2);
    // below it: sidebar | main | aside, left-to-right
    expect(sidebar.left).toBeLessThan(main.left);
    expect(main.left).toBeLessThan(aside.left);
    expect(sidebar.top).toBeGreaterThanOrEqual(header.bottom - 1);
    // the footer matches the header — full width, bounding the sidebar bottom
    expect(footer.left).toBeLessThan(2);
    expect(Math.abs(footer.right - DESKTOP.width)).toBeLessThan(2);
    expect(footer.top).toBeGreaterThanOrEqual(sidebar.bottom - 1);
    // the aside lives in the same middle band as the sidebar — between the
    // global header and footer, vertically aligned with the left sidebar
    expect(aside.top).toBeGreaterThanOrEqual(header.bottom - 1);
    expect(aside.bottom).toBeLessThanOrEqual(footer.top + 1);
    expect(Math.abs(aside.top - sidebar.top)).toBeLessThan(2);
    expect(Math.abs(aside.bottom - sidebar.bottom)).toBeLessThan(2);
  });

  test('data-layout="sidebar-first" spans the sidebar full-height on the left', async ({
    page,
  }) => {
    await page
      .getByTestId('shell')
      .evaluate((el) => el.setAttribute('data-layout', 'sidebar-first'));
    const header = await rect(page.getByTestId('shell-header'));
    const sidebar = await rect(page.getByTestId('shell-sidebar'));
    const main = await rect(page.getByTestId('shell-main'));
    const footer = await rect(page.getByTestId('shell-footer'));
    // sidebar reaches the very top and spans the full height
    expect(sidebar.top).toBeLessThan(2);
    expect(Math.abs(sidebar.height - DESKTOP.height)).toBeLessThan(4);
    // the header AND footer are now inset to the right of the full-height sidebar
    expect(header.left).toBeGreaterThanOrEqual(sidebar.right - 1);
    expect(footer.left).toBeGreaterThanOrEqual(sidebar.right - 1);
    expect(sidebar.left).toBeLessThan(main.left);
  });

  test('the hamburger toggle is hidden', async ({ page }) => {
    expect(await display(page.getByTestId('shell-toggle'))).toBe('none');
  });

  test('main scrolls independently of the chrome', async ({ page }) => {
    const overflow = await page
      .getByTestId('shell-main')
      .evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflow);
  });

  test('axe finds no violations (desktop)', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the collapse button narrows the sidebar to an icon rail and hides labels', async ({
    page,
  }) => {
    const sidebar = page.getByTestId('shell-sidebar');
    const full = (await rect(sidebar)).width;

    await page.getByTestId('shell-collapse').click();
    await expect(page.getByTestId('shell')).toHaveAttribute('data-sidebar-collapsed', '');
    await expect(page.getByTestId('shell-collapse')).toHaveAttribute('aria-expanded', 'false');

    const collapsed = (await rect(sidebar)).width;
    expect(collapsed).toBeLessThan(full - 50); // narrowed to the rail
    // The label is visually clipped (but stays in the a11y tree — see the axe
    // test below), so the rail shows only the icon.
    const labelWidth = await sidebar
      .locator('.hc-shell__label')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(labelWidth).toBeLessThanOrEqual(1);
  });

  test('the directional collapse icon mirrors when the sidebar collapses', async ({ page }) => {
    const icon = page.getByTestId('shell-collapse-icon');
    expect(await icon.evaluate((el) => getComputedStyle(el).transform)).toBe('none');

    await page.getByTestId('shell-collapse').click();
    await expect(page.getByTestId('shell')).toHaveAttribute('data-sidebar-collapsed', '');
    // scaleX(-1) → the chevron now points the other way (« reads as »).
    expect(await icon.evaluate((el) => getComputedStyle(el).transform)).toBe('matrix(-1, 0, 0, 1, 0, 0)');

    await page.getByTestId('shell-collapse').click();
    expect(await icon.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('the collapsed state persists across a reload', async ({ page }) => {
    await page.getByTestId('shell-collapse').click();
    await expect(page.getByTestId('shell')).toHaveAttribute('data-sidebar-collapsed', '');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.setViewportSize(DESKTOP);
    await expect(page.getByTestId('shell')).toHaveAttribute('data-sidebar-collapsed', '');
    await expect(page.getByTestId('shell-collapse')).toHaveAttribute('aria-expanded', 'false');
  });

  test('axe finds no violations with the sidebar collapsed', async ({ page }) => {
    await page.getByTestId('shell-collapse').click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('hc-shell — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
  });

  test('shows the hamburger and pushes the sidebar off-canvas', async ({ page }) => {
    expect(await display(page.getByTestId('shell-toggle'))).not.toBe('none');
    const sidebar = await rect(page.getByTestId('shell-sidebar'));
    expect(sidebar.right).toBeLessThanOrEqual(1); // translated fully off the left edge
  });

  test('toggle opens the sidebar, sets ARIA, and moves focus into it', async ({ page }) => {
    await page.getByTestId('shell-toggle').click();

    const shellOpen = await page
      .getByTestId('shell')
      .evaluate((el) => el.getAttribute('data-sidebar'));
    expect(shellOpen).toBe('open');
    await expect(page.getByTestId('shell-toggle')).toHaveAttribute('aria-expanded', 'true');

    const sidebar = await rect(page.getByTestId('shell-sidebar'));
    expect(sidebar.left).toBeGreaterThanOrEqual(-1); // slid into view

    const focusInside = await page.evaluate(() =>
      document
        .querySelector('.hc-shell__sidebar')
        .contains(document.activeElement),
    );
    expect(focusInside).toBe(true);
  });

  test('Tab is trapped within the open sidebar', async ({ page }) => {
    await page.getByTestId('shell-toggle').click();
    await page.getByTestId('shell-link-last').focus();
    await page.keyboard.press('Tab');
    const wrapped = await page.evaluate(
      () => document.activeElement === document.querySelector('[data-testid="shell-link-first"]'),
    );
    expect(wrapped).toBe(true);
  });

  test('Escape closes and restores focus to the toggle', async ({ page }) => {
    const toggle = page.getByTestId('shell-toggle');
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shell')).not.toHaveAttribute('data-sidebar', 'open');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('clicking the scrim (outside the sidebar) closes', async ({ page }) => {
    await page.getByTestId('shell-toggle').click();
    await expect(page.getByTestId('shell')).toHaveAttribute('data-sidebar', 'open');
    // Click near the right edge — over the scrim, outside the sidebar.
    await page.mouse.click(MOBILE.width - 10, MOBILE.height / 2);
    await expect(page.getByTestId('shell')).not.toHaveAttribute('data-sidebar', 'open');
  });

  test('axe finds no violations (mobile, sidebar open)', async ({ page }) => {
    await page.getByTestId('shell-toggle').click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
