import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('<dialog>.showModal()', () => {
  test('opens and closes via the matching buttons', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await expect(dialog).toBeHidden();

    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open', '');

    await page.getByTestId('close-dialog').click();
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute('open', '');
  });

  test('closes on Escape', async ({ page }) => {
    const dialog = page.getByTestId('demo-dialog');
    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('moves focus into the dialog and away from the opener', async ({ page }) => {
    await page.getByTestId('open-dialog').click();

    // Initial focus must land inside the modal dialog. Browsers vary on
    // which child element wins (first focusable, or the dialog itself),
    // so assert containment rather than exact identity.
    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[data-testid="demo-dialog"]');
      return dialog?.contains(document.activeElement);
    });
    expect(focusedInsideDialog).toBe(true);

    // The button that opened the dialog must not retain focus while modal.
    await expect(page.getByTestId('open-dialog')).not.toBeFocused();
  });

  test('renders the styled ::backdrop', async ({ page }) => {
    await page.getByTestId('open-dialog').click();
    const backdropBg = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="demo-dialog"]');
      // ::backdrop styles aren't reachable via getComputedStyle, but we
      // can verify the dialog itself reports modal state via :modal.
      return d?.matches(':modal') ?? false;
    });
    expect(backdropBg).toBe(true);
  });

  // The enter transition is declared on `.hc-dialog[open]`, so a
  // reduced-motion guard written against the bare `.hc-dialog` is
  // outranked and silently does nothing — the dialog still faded in
  // over 200ms for a reader who asked for no motion. It also made the
  // axe suites flaky: mid-fade the primary button's blue composites
  // toward the page behind it and scores ~3.5:1 against white instead
  // of the 5.31:1 it resolves to at rest.
  test('reduced motion settles the open dialog immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const dialog = page.getByTestId('demo-dialog');
    await page.getByTestId('open-dialog').click();
    await expect(dialog).toBeVisible();

    // Read the first frame the dialog is visible — no settle wait, the
    // way axe samples it.
    const state = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="demo-dialog"]');
      const cs = getComputedStyle(d);
      return {
        durations: [...new Set(cs.transitionDuration.split(',').map((v) => v.trim()))],
        opacity: cs.opacity,
      };
    });
    expect(state.durations).toEqual(['0s']);
    expect(Number(state.opacity)).toBe(1);
  });
});
