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
    return { top: r.top, left: r.left, right: r.right, width: r.width, height: r.height };
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

  test('lays sidebar | main | aside left-to-right in one row', async ({ page }) => {
    const sidebar = await rect(page.getByTestId('shell-sidebar'));
    const main = await rect(page.getByTestId('shell-main'));
    const aside = await rect(page.getByTestId('shell-aside'));
    expect(sidebar.left).toBeLessThan(main.left);
    expect(main.left).toBeLessThan(aside.left);
    // sidebar spans the full height on the left
    expect(Math.abs(sidebar.height - DESKTOP.height)).toBeLessThan(4);
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
