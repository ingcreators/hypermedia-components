import { test, expect } from '@playwright/test';

// Visual regression suites (plans/hc-vrt-plan-en.md): full-page
// screenshots of three dense fixture sheets under the high-value axis
// slices. The sheets pin the font tokens to DejaVu (the family both the
// devcontainer and GitHub's runners ship) and render only deterministic
// states; toHaveScreenshot disables animations and hides the caret, and
// reduced motion zeroes the kit's gated transitions.
//
// Updating baselines after an intentional visual change (reviewed as
// image diffs in the PR):
//
//   pnpm --filter @hypermedia-components/core exec playwright test test-browser/vrt.spec.mjs --update-snapshots

const SHEETS = ['vrt-core', 'vrt-data', 'vrt-overlays'];

const AXES = {
  'light-ltr': {},
  'dark-ltr': { theme: 'dark' },
  'light-rtl': { dir: 'rtl' },
  'dark-rtl': { theme: 'dark', dir: 'rtl' },
};

// Extra slices on the densest sheet only (§3 of the plan).
const EXTRA = [
  ['vrt-core', 'compact', { density: 'compact' }],
  ['vrt-core', 'accent', { color: 'indigo' }],
];

async function prepare(page, sheet, axis) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${sheet}.html`);

  await page.evaluate((a) => {
    const root = document.documentElement;
    if (a.theme) root.setAttribute('data-theme', a.theme);
    if (a.dir) root.setAttribute('dir', a.dir);
    if (a.density) root.setAttribute('data-density', a.density);
    if (a.color) root.setAttribute('data-color', a.color);
  }, axis);

  // Deterministic paint: pinned fonts loaded, behaviors settled.
  await page.evaluate(() => document.fonts.ready);

  if (sheet === 'vrt-data') {
    // The selection actions bar renders once installDatagridActions has
    // processed the pre-checked row — wait on the outcome, not on time.
    await expect(page.locator('[data-hc-datagrid-count]')).toHaveText(/1/);
  }
  if (sheet === 'vrt-overlays') {
    // Open every overlay: dialog (non-modal so the page stays visible
    // behind it), drawer, popover, plus one sticky toast.
    await page.evaluate(() => {
      document.getElementById('vrt-dialog').show();
      document.getElementById('vrt-drawer').show();
      document.getElementById('vrt-popover').showPopover();
      document.body.dispatchEvent(
        new CustomEvent('hc:toast', {
          bubbles: true,
          detail: { message: 'Baseline toast', variant: 'success', duration: 0 },
        }),
      );
    });
    await expect(page.locator('.hc-toast')).toContainText('Baseline toast');
    await expect(page.locator('#vrt-popover')).toBeVisible();
  }
}

test.describe('visual regression', () => {
  for (const sheet of SHEETS) {
    for (const [name, axis] of Object.entries(AXES)) {
      test(`${sheet} — ${name}`, async ({ page }) => {
        await prepare(page, sheet, axis);
        await expect(page).toHaveScreenshot(`${sheet}-${name}.png`, { fullPage: true });
      });
    }
  }

  for (const [sheet, name, axis] of EXTRA) {
    test(`${sheet} — ${name}`, async ({ page }) => {
      await prepare(page, sheet, axis);
      await expect(page).toHaveScreenshot(`${sheet}-${name}.png`, { fullPage: true });
    });
  }
});
