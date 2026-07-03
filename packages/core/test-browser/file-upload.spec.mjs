import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed file-upload recipe against real htmx and a real
// multipart request: the progress bar is visible in flight and settles
// at 100, the new item lands afterbegin in #files, the form resets via
// the out-of-band swap (the file input is empty again), and a
// validation failure comes back as a retargeted 422 field-errors
// fragment. The /mock/upload route (serve.mjs) stands in for the server.

test.beforeEach(async ({ page }) => {
  await page.goto('/file-upload.html');
});

function pickFile(page, name, sizeKb = 64) {
  return page.getByTestId('file').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(sizeKb * 1024, 7),
  });
}

test.describe('file upload', () => {
  test('uploads: progress bar shows in flight, item lands afterbegin, form resets out-of-band', async ({ page }) => {
    await pickFile(page, 'report.pdf');
    await page.getByTestId('submit').click();

    // Visibility is htmx-native: the indicator shows while in flight
    // (the mock delays its response to keep the window observable).
    await expect(page.getByTestId('bar')).toBeVisible();

    const items = page.getByTestId('files').locator('li');
    await expect(items.first()).toContainText('report.pdf');
    await expect(items).toHaveCount(2); // afterbegin, initial item kept

    // The out-of-band fresh form: pristine file input, bar back at 0.
    await expect(page.getByTestId('file')).toHaveValue('');
    await expect(page.getByTestId('bar')).toBeHidden();

    await expect(page.locator('.hc-toast')).toContainText('report.pdf');
  });

  test('the bridge drives the bar to 100 while the request is still in flight', async ({ page }) => {
    await pickFile(page, 'big.pdf', 512);
    await page.getByTestId('submit').click();

    // The mock delays its response after consuming the body — inside
    // that window the upload phase is complete and the bridge has moved
    // the (visible) bar to 100. Observed live, before the out-of-band
    // fresh form resets it to 0.
    await page.waitForFunction(() => {
      const bar = document.querySelector('[data-testid="bar"]');
      return !!bar && bar.value === 100;
    });

    await expect(page.getByTestId('files').locator('li').first()).toContainText('big.pdf');
    await expect(page.getByTestId('bar')).toHaveJSProperty('value', 0); // pristine OOB form
  });

  test('validation failure: 422 is retargeted into the in-form container and distributed', async ({ page }) => {
    await pickFile(page, 'fail.exe');
    await page.getByTestId('submit').click();

    await expect(page.locator('#doc-field .hc-field__error')).toContainText('not allowed');
    await expect(page.getByTestId('file')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('files').locator('li')).toHaveCount(1); // nothing appended

    // The form was NOT reset on failure — the user keeps their context.
    await expect(page.getByTestId('submit')).toBeEnabled();
  });

  test('axe finds no violations, idle and after an upload', async ({ page }) => {
    const idle = await new AxeBuilder({ page }).analyze();
    expect(idle.violations).toEqual([]);

    await pickFile(page, 'report.pdf');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('files').locator('li').first()).toContainText('report.pdf');
    const after = await new AxeBuilder({ page }).analyze();
    expect(after.violations).toEqual([]);
  });
});
