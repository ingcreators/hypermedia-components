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

  test('dropzone variant: a real drop runs the whole pipeline and the OOB reset restores a pristine zone', async ({ page }) => {
    const zone = page.locator('#upload-form-dz .hc-dropzone');

    // Construct a real DataTransfer + File in the page and drop it.
    await zone.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(64 * 1024).fill(7)], 'dropped.pdf', { type: 'application/pdf' }));
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    // The zone accepted the file: names shown, input filled.
    await expect(page.getByTestId('names-dz')).toHaveText('dropped.pdf');

    await page.getByTestId('submit-dz').click();

    // The shipped pipeline, unchanged: item appended…
    await expect(page.getByTestId('files').locator('li').first()).toContainText('dropped.pdf');
    await expect(page.locator('.hc-toast')).toContainText('dropped.pdf');

    // …and the OOB fresh form restored a pristine dropzone.
    await expect(page.getByTestId('names-dz')).toHaveText('');
    await expect(page.getByTestId('file-dz')).toHaveValue('');
  });

  test('dropzone variant: dragover state sets and clears', async ({ page }) => {
    const zone = page.locator('#upload-form-dz .hc-dropzone');
    await zone.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['x'], 'x.pdf'));
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await expect(zone).toHaveAttribute('data-dragover', '');
    await zone.evaluate((el) => {
      el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: document.body }));
    });
    await expect(zone).not.toHaveAttribute('data-dragover', '');
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
