import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// A dialog taller than the viewport must scroll its BODY. Before the
// column layout, the dialog itself scrolled: the header left the top of
// the screen and the footer — where the primary action lives — left the
// bottom, which is exactly what a filter panel with a dozen fields does.

test.beforeEach(async ({ page }) => {
  // Short viewport so the fixture's fields overflow.
  await page.setViewportSize({ width: 1200, height: 460 });
  // The dialog animates in (opacity + scale). Reduced motion zeroes the
  // duration, so geometry is settled the moment it opens — otherwise a
  // measurement taken mid-transition drifts by a pixel or two, and axe
  // can sample a colour mid-fade (#342).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dialog-tall.html', { waitUntil: 'domcontentloaded' });
});

const box = (loc) => loc.boundingBox();

// The dialog animates in (opacity + scale). Reduced motion is emulated
// above, but the enter frame can still be in flight for a frame or two,
// so wait until the geometry stops moving before measuring it.
async function settled(page) {
  const read = () => page.getByTestId('dialog').evaluate((el) => el.getBoundingClientRect().top);
  let prev = await read();
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(25);
    const next = await read();
    if (next === prev) return;
    prev = next;
  }
}

test.describe('a dialog taller than the viewport', () => {
  test('a closed dialog stays hidden', async ({ page }) => {
    // The column layout is scoped to [open] on purpose: an unscoped
    // `display` would beat the UA's dialog:not([open]) { display: none }.
    await expect(page.getByTestId('dialog')).toBeHidden();
    await expect(page.getByTestId('plain-dialog')).toBeHidden();
  });

  test('the body scrolls, not the dialog', async ({ page }) => {
    await page.getByTestId('open').click();
    const m = await page.evaluate(() => {
      const d = document.querySelector('#filters');
      const b = d.querySelector('.hc-dialog__body');
      return {
        dialogScrolls: d.scrollHeight > d.clientHeight + 1,
        bodyScrolls: b.scrollHeight > b.clientHeight + 1,
      };
    });
    expect(m).toEqual({ dialogScrolls: false, bodyScrolls: true });
  });

  test('header and footer stay put while the body scrolls', async ({ page }) => {
    await page.getByTestId('open').click();
    await settled(page);
    const before = {
      header: (await box(page.getByTestId('header'))).y,
      footer: (await box(page.getByTestId('footer'))).y,
    };
    await page.getByTestId('body').evaluate((el) => {
      el.scrollTop = 9999;
    });
    const after = {
      header: (await box(page.getByTestId('header'))).y,
      footer: (await box(page.getByTestId('footer'))).y,
    };
    expect(after).toEqual(before);

    // …and the primary action is still on screen, which is the point.
    const apply = await box(page.getByTestId('apply'));
    const viewport = page.viewportSize();
    expect(apply.y + apply.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test('the same holds without a wrapping form', async ({ page }) => {
    await page.getByTestId('open-plain').click();
    const scrolls = await page.evaluate(() => {
      const d = document.querySelector('#plain');
      const b = d.querySelector('.hc-dialog__body');
      return {
        dialogScrolls: d.scrollHeight > d.clientHeight + 1,
        bodyScrolls: b.scrollHeight > b.clientHeight + 1,
      };
    });
    expect(scrolls).toEqual({ dialogScrolls: false, bodyScrolls: true });
  });

  test('axe: no violations with the dialog open', async ({ page }) => {
    await page.getByTestId('open').click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
});
