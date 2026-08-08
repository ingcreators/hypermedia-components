import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/mask.html');
});

test.describe('installMask', () => {
  test('inserts literals while typing and caps at the mask', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('123');
    await expect(postal).toHaveValue('123');
    await postal.pressSequentially('4');
    await expect(postal).toHaveValue('123-4');
    await postal.pressSequentially('56789');
    await expect(postal).toHaveValue('123-4567');
  });

  test('upcases letter slots', async ({ page }) => {
    const product = page.getByTestId('product');
    await product.pressSequentially('ab12');
    await expect(product).toHaveValue('AB-12');
  });

  test('backspace hops the literal and lands the caret after the raw run', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('1234567');
    await expect(postal).toHaveValue('123-4567');
    // Place the caret right after the hyphen, then Backspace: the literal
    // run and one raw char go together.
    await postal.evaluate((el) => el.setSelectionRange(4, 4));
    await postal.press('Backspace');
    await expect(postal).toHaveValue('124-567');
    const caret = await postal.evaluate((el) => el.selectionStart);
    expect(caret).toBe(2);
  });

  test('strips literals on the wire with data-hc-mask-submit="raw"', async ({ page }) => {
    await page.getByTestId('postal').pressSequentially('1234567');
    await page.getByTestId('product').pressSequentially('ab12');
    await page.getByTestId('snapshot').click();
    await expect(page.getByTestId('wire')).toHaveText('postal=1234567&product=AB-12');
    await expect(page.getByTestId('postal')).toHaveValue('123-4567');
  });

  test('no axe violations', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
