import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('/postal-address.html');
});

test.describe('postal-address recipe', () => {
  test('a complete masked code fills the address out of band', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('1234567');
    await expect(postal).toHaveValue('123-4567');
    await postal.blur();
    await expect(page.getByTestId('result')).toContainText('Address filled');
    await expect(page.getByTestId('pref')).toHaveValue('Tokyo');
    await expect(page.getByTestId('city')).toHaveValue('Chiyoda-ku');
    await expect(page.getByTestId('addr1')).toHaveValue('Chiyoda 1-1');
    // The OOB swap kept the id, so the label still points at the input.
    await expect(page.locator('label[for="pref"]')).toBeVisible();
    await expect(page.getByLabel('Prefecture')).toHaveValue('Tokyo');
  });

  test('an incomplete code does not fire the lookup', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('123');
    await postal.blur();
    await expect(page.getByTestId('result')).toHaveText('');
    await expect(page.getByTestId('pref')).toHaveValue('');
  });

  test('a shared code lists candidates and a pick fills the form', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('6008216');
    await postal.blur();
    await expect(page.getByTestId('result')).toContainText('pick one');
    await page.getByRole('button', { name: /Nishishiokoji/ }).click();
    await expect(page.getByTestId('addr1')).toHaveValue('Nishishiokoji-cho');
    await expect(page.getByTestId('result')).toContainText('Address filled');
  });

  test('an unknown code reports no match and touches nothing', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('9990000');
    await postal.blur();
    await expect(page.getByTestId('result')).toContainText('No address');
    await expect(page.getByTestId('pref')).toHaveValue('');
  });

  test('no axe violations, including with a candidate list shown', async ({ page }) => {
    const postal = page.getByTestId('postal');
    await postal.pressSequentially('6008216');
    await postal.blur();
    await expect(page.getByTestId('result')).toContainText('pick one');
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(violations).toEqual([]);
  });
});
