import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-code — read-only code surface (#253 plain + line-number/coverage modes,
// #256 unified diff). Pure CSS: per-line `data-state` colours from the
// semantic status tokens and re-resolves with `data-theme`.
test.beforeEach(async ({ page }) => {
  // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
  // so the dark flip applies instantly and axe samples final palettes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/code.html');
});

const bg = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
const pseudo = (locator, sel, prop) =>
  locator.evaluate((el, [s, p]) => getComputedStyle(el, s)[p], [sel, prop]);

test.describe('hc-code', () => {
  test('plain block is a monospace, surfaced <pre>', async ({ page }) => {
    const pre = page.getByTestId('plain');
    const family = await pre.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.toLowerCase()).toContain('monospace');
    expect(await bg(pre)).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('line-number gutter renders a counter before each line', async ({ page }) => {
    const line = page.getByTestId('cov-plain');
    const content = await pseudo(line, '::before', 'content');
    // The counter resolves to a non-empty generated string.
    expect(content).not.toBe('none');
    expect(content).not.toBe('');
    // The line reserves the gutter as inline-start padding.
    const pad = await line.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineStart));
    expect(pad).toBeGreaterThan(16);
  });

  test('coverage states tint distinctly and differ from a plain line', async ({ page }) => {
    const plain = await bg(page.getByTestId('cov-plain'));
    const covered = await bg(page.getByTestId('cov-covered'));
    const missed = await bg(page.getByTestId('cov-missed'));
    expect(covered).not.toBe(plain);
    expect(missed).not.toBe(plain);
    expect(covered).not.toBe(missed);
  });

  test('diff prints a +/- sign marker coloured per state', async ({ page }) => {
    const added = page.getByTestId('diff-added');
    const removed = page.getByTestId('diff-removed');
    const context = page.getByTestId('diff-context');

    const addedMark = await pseudo(added, '::marker', 'content');
    const removedMark = await pseudo(removed, '::marker', 'content');
    expect(addedMark).toContain('+');
    expect(removedMark).toContain('-');

    // The sign colour tracks the state (added ≠ context ≠ removed).
    const addedColor = await pseudo(added, '::marker', 'color');
    const removedColor = await pseudo(removed, '::marker', 'color');
    const contextColor = await pseudo(context, '::marker', 'color');
    expect(addedColor).not.toBe(contextColor);
    expect(removedColor).not.toBe(contextColor);
    expect(addedColor).not.toBe(removedColor);
  });

  test('diff renders old/new line numbers in the gutter', async ({ page }) => {
    const context = page.getByTestId('diff-context');
    expect(await pseudo(context, '::before', 'content')).not.toBe('none');
    expect(await pseudo(context, '::after', 'content')).not.toBe('none');
    const pad = await context.evaluate((el) =>
      parseFloat(getComputedStyle(el).paddingInlineStart),
    );
    expect(pad).toBeGreaterThan(32); // two number columns reserved
  });

  test('added/removed lines tint distinctly from context', async ({ page }) => {
    const context = await bg(page.getByTestId('diff-context'));
    const added = await bg(page.getByTestId('diff-added'));
    const removed = await bg(page.getByTestId('diff-removed'));
    expect(added).not.toBe(context);
    expect(removed).not.toBe(context);
    expect(added).not.toBe(removed);
  });

  test('colours re-resolve under data-theme="dark"', async ({ page }) => {
    const lightSurface = await bg(page.getByTestId('plain'));
    const lightCovered = await bg(page.getByTestId('cov-covered'));

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    expect(await bg(page.getByTestId('plain'))).not.toBe(lightSurface);
    expect(await bg(page.getByTestId('cov-covered'))).not.toBe(lightCovered);
  });

  test('axe (incl. colour contrast) passes in light and dark', async ({ page }) => {
    expect(
      (await new AxeBuilder({ page }).include('#section-code').analyze()).violations,
    ).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(
      (await new AxeBuilder({ page }).include('#section-code').analyze()).violations,
    ).toEqual([]);
  });
});
