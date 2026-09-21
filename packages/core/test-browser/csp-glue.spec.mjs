import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The CSP-safe glue batch (#621 + the audit's A/B/C): a Print button, an
// auto-growing textarea (CSS `field-sizing`), a character count, and a
// select-all checkbox — each replacing a line of inline script consumers
// used to write. The fixture has no <script> beyond the kit bundle.

test.beforeEach(async ({ page }) => {
  // window.print() would open the native dialog; record the call instead.
  await page.addInitScript(() => {
    window.__prints = 0;
    window.print = () => { window.__prints += 1; };
  });
  await page.goto('/csp-glue.html');
});

test.describe('csp-safe glue', () => {
  test('axe finds no violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('data-hc-print calls window.print() with no inline script', async ({ page }) => {
    await page.getByTestId('print').click();
    expect(await page.evaluate(() => window.__prints)).toBe(1);
    await page.getByTestId('print').press('Enter');
    expect(await page.evaluate(() => window.__prints)).toBe(2);
  });

  test('data-autosize grows the textarea with its content where field-sizing is supported', async ({ page }) => {
    const ta = page.getByTestId('autosize');
    const supported = await page.evaluate(() => CSS.supports('field-sizing', 'content'));
    const before = (await ta.boundingBox()).height;
    await ta.fill(Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n'));
    const after = (await ta.boundingBox()).height;
    console.log(`[csp-glue] field-sizing supported: ${supported} (${before}px → ${after}px)`);
    if (supported) {
      expect(after).toBeGreaterThan(before + 40); // several lines taller
      expect(await ta.evaluate((el) => getComputedStyle(el).resize)).toBe('none');
    } else {
      expect(after).toBe(before); // rows height, handle kept
      expect(await ta.evaluate((el) => getComputedStyle(el).resize)).toBe('vertical');
    }
  });

  test('data-autosize stops at --hc-input-autosize-max and scrolls', async ({ page }) => {
    const supported = await page.evaluate(() => CSS.supports('field-sizing', 'content'));
    test.skip(!supported, 'engine has no field-sizing');
    const ta = page.getByTestId('autosize');
    await ta.evaluate((el) => { el.style.setProperty('--hc-input-autosize-max', '6rem'); });
    await ta.fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n'));
    const h = (await ta.boundingBox()).height;
    expect(h).toBeLessThanOrEqual(96 + 2); // 6rem + border
    expect(await ta.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  });

  test('the character count follows typing, marks near, and the <output> announces after a pause', async ({ page }) => {
    const memo = page.getByTestId('memo');
    const out = page.getByTestId('memo-count');
    await expect(out).toHaveText('0 / 20');
    await memo.fill('hello world');
    // <output> is live: the text lands after the 500 ms typing pause.
    await expect(out).toHaveText('11 / 20');
    await memo.fill('x'.repeat(19));
    await expect(out).toHaveText('19 / 20');
    await expect(out).toHaveAttribute('data-count-state', 'near');
    // maxlength is hard: typing past it is refused by the browser.
    await memo.press('End');
    await memo.type('zz');
    await expect(memo).toHaveValue('x'.repeat(19) + 'z');
    await expect(out).toHaveText('20 / 20');
  });

  test('a soft limit lets the value overflow and marks the count over', async ({ page }) => {
    const soft = page.getByTestId('soft');
    const out = page.getByTestId('soft-count');
    await soft.fill('1234567');
    await expect(out).toHaveText('7 / 5'); // plain <p>: immediate
    await expect(out).toHaveAttribute('data-count-state', 'over');
    await soft.fill('12');
    await expect(out).toHaveText('2 / 5');
    await expect(out).not.toHaveAttribute('data-count-state', /.+/);
  });

  test('select-all checks the enabled members and mirrors them back', async ({ page }) => {
    const all = page.getByTestId('all');
    const read = page.getByTestId('read');
    const write = page.getByTestId('write');
    const admin = page.getByTestId('admin');

    await all.check();
    await expect(read).toBeChecked();
    await expect(write).toBeChecked();
    await expect(admin).not.toBeChecked(); // disabled: left alone

    await write.uncheck();
    expect(await all.evaluate((el) => el.indeterminate)).toBe(true);
    await expect(all).not.toBeChecked();

    await write.check();
    await expect(all).toBeChecked();
    expect(await all.evaluate((el) => el.indeterminate)).toBe(false);

    // The master never serializes; the members do.
    const keys = await page.getByTestId('perm-form').evaluate((f) => [...new FormData(f).entries()]);
    expect(keys).toEqual([['perm', 'read'], ['perm', 'write']]);
  });
});
