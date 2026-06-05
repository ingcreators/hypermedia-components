import { test, expect } from '@playwright/test';

// data-groups="3-3" renders separators between OTP slot groups.
test.beforeEach(async ({ page }) => {
  await page.goto('/inputotp-groups.html');
});

test.describe('inputotp group separators', () => {
  test('"3-3" renders one visible separator between the groups', async ({ page }) => {
    const otp = page.getByTestId('otp33');
    const seps = otp.locator('.hc-inputotp__separator');
    await expect(seps).toHaveCount(1);
    await expect(seps.first()).toBeVisible();

    // It shows the dash glyph (default content).
    const glyph = await seps.first().evaluate((el) => getComputedStyle(el, '::before').content);
    expect(glyph).toContain('–');

    // …and it sits between the 3rd and 4th slots horizontally.
    const xs = await otp.evaluate((root) => {
      const x = (el) => el.getBoundingClientRect().left;
      const slots = [...root.querySelectorAll('.hc-inputotp__slot')];
      const sep = root.querySelector('.hc-inputotp__separator');
      return { slot3: x(slots[2]), sep: x(sep), slot4: x(slots[3]) };
    });
    expect(xs.sep).toBeGreaterThan(xs.slot3);
    expect(xs.sep).toBeLessThan(xs.slot4);
  });

  test('"2-2-2" renders two separators', async ({ page }) => {
    await expect(page.getByTestId('otp222').locator('.hc-inputotp__separator')).toHaveCount(2);
  });

  test('typing still fills the slots with separators present', async ({ page }) => {
    await page.getByTestId('otp33-input').fill('1234');
    const text = await page
      .getByTestId('otp33')
      .evaluate((root) =>
        [...root.querySelectorAll('.hc-inputotp__slot')].map((s) => s.textContent).join(''),
      );
    expect(text).toBe('1234');
  });
});
