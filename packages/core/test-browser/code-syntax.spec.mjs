import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-code syntax tokens (#261) — server-emitted `.hc-code__tok[data-tok]`
// spans coloured from the `--hc-code-tok-*` palette. Pure CSS, no client
// tokenizer; composes with line state and diff mode, themed light + dark.
test.beforeEach(async ({ page }) => {
  // hc.a11y.css zeroes the kit's gated transitions under reduced motion,
  // so the dark flip applies instantly and axe samples final palettes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/code-syntax.html');
});

const color = (locator) => locator.evaluate((el) => getComputedStyle(el).color);

test.describe('hc-code syntax tokens', () => {
  test('each data-tok colours its span distinctly', async ({ page }) => {
    const toks = ['kw', 'str', 'num', 'cm', 'op', 'meta'];
    const seen = new Set();
    for (const t of toks) {
      seen.add(await color(page.getByTestId(t)));
    }
    // Six categories → six distinct colours.
    expect(seen.size).toBe(6);
  });

  test('property / tag / attribute each colour distinctly (and differ from plain)', async ({
    page,
  }) => {
    const plain = await color(page.getByTestId('plain'));
    const prop = await color(page.getByTestId('prop'));
    const tag = await color(page.getByTestId('tag'));
    const attr = await color(page.getByTestId('attr'));
    const set = new Set([prop, tag, attr]);
    expect(set.size).toBe(3); // three distinct hues
    for (const c of set) expect(c).not.toBe(plain);
  });

  test('an unknown data-tok inherits the plain code colour', async ({ page }) => {
    const plain = await color(page.getByTestId('plain'));
    expect(await color(page.getByTestId('unknown'))).toBe(plain);
    // identifier resolves to the same plain text colour by design.
    expect(await color(page.getByTestId('id'))).toBe(plain);
  });

  test('token colour wins inside a tinted (covered) line', async ({ page }) => {
    const covLine = page.getByTestId('cov-line');
    const tint = await covLine.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(tint).not.toBe('rgba(0, 0, 0, 0)'); // line still tinted

    const kw = await color(page.getByTestId('kw'));
    expect(await color(page.getByTestId('cov-kw'))).toBe(kw); // keyword keeps its colour
  });

  test('tokens render on a diff added line', async ({ page }) => {
    const kw = await color(page.getByTestId('kw'));
    expect(await color(page.getByTestId('add-kw'))).toBe(kw);
    // The added line is still tinted (composition with diff state).
    const tint = await page
      .getByTestId('diff-add')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(tint).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('token colours re-resolve under data-theme="dark"', async ({ page }) => {
    const light = await color(page.getByTestId('kw'));
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await color(page.getByTestId('kw'))).not.toBe(light);
  });

  test('axe (incl. colour contrast) passes in light and dark', async ({ page }) => {
    expect(
      (await new AxeBuilder({ page }).include('#section-code-syntax').analyze()).violations,
    ).toEqual([]);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(
      (await new AxeBuilder({ page }).include('#section-code-syntax').analyze()).violations,
    ).toEqual([]);
  });
});
