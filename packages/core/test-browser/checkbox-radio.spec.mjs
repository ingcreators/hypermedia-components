import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-checkbox', () => {
  test('Space toggles the underlying checkbox', async ({ page }) => {
    const cb = page.getByTestId('cb-default');
    await expect(cb).not.toBeChecked();

    await cb.focus();
    await page.keyboard.press('Space');
    await expect(cb).toBeChecked();

    await page.keyboard.press('Space');
    await expect(cb).not.toBeChecked();
  });

  test('a pre-checked input renders the SVG check mark', async ({ page }) => {
    const cb = page.getByTestId('cb-checked');
    await expect(cb).toBeChecked();

    // The check mark is delivered via background-image. The element
    // computed style should contain "svg" for the data URI.
    const bgImage = await cb.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('svg');
  });

  test('clicking the wrapping label toggles the input', async ({ page }) => {
    const cb = page.getByTestId('cb-default');
    await expect(cb).not.toBeChecked();

    // Click the text portion of the label (not the input itself).
    await page.getByText('Default', { exact: true }).click();
    await expect(cb).toBeChecked();
  });

  test('disabled does not toggle on click', async ({ page }) => {
    const cb = page.getByTestId('cb-disabled');
    await expect(cb).not.toBeChecked();
    await cb.click({ force: true });
    await expect(cb).not.toBeChecked();
    await expect(cb).toBeDisabled();
  });

  test('aria-invalid swaps the border to the danger colour', async ({ page }) => {
    const cb = page.getByTestId('cb-invalid');
    const borderColor = await cb.evaluate((el) => getComputedStyle(el).borderColor);
    // --hc-checkbox-invalid-border resolves to --hc-color-danger (red.600 #dc2626).
    expect(borderColor).toMatch(/rgba?\(\s*220,\s*38,\s*38/);
  });

  test('data-variant="danger" uses the danger checked colour', async ({ page }) => {
    const cb = page.getByTestId('cb-danger');
    await cb.check();

    // The element has a 120ms background-color transition. Poll until it
    // settles on the resolved variable value (red.600 = rgb(220, 38, 38)).
    await expect
      .poll(() => cb.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toMatch(/rgba?\(\s*220,\s*38,\s*38/);
  });

  test('data-variant="warning" uses the warning checked colour', async ({ page }) => {
    const cb = page.getByTestId('cb-warning');
    await cb.check();

    // amber.600 = #d97706 = rgb(217, 119, 6).
    await expect
      .poll(() => cb.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toMatch(/rgba?\(\s*217,\s*119,\s*6/);
  });

  test('data-size="sm" / "lg" render at the dedicated sm / lg sizes', async ({ page }) => {
    const sm = page.getByTestId('cb-sm');
    const lg = page.getByTestId('cb-lg');

    const smW = await sm.evaluate((el) => el.getBoundingClientRect().width);
    const lgW = await lg.evaluate((el) => el.getBoundingClientRect().width);

    // sm = 0.875rem = 14 px; lg = 1.375rem = 22 px (at the docs' 16 px root).
    expect(smW).toBeGreaterThanOrEqual(13);
    expect(smW).toBeLessThanOrEqual(15);
    expect(lgW).toBeGreaterThanOrEqual(21);
    expect(lgW).toBeLessThanOrEqual(23);
    expect(lgW - smW).toBeGreaterThan(5);
  });
});

test.describe('hc-radio', () => {
  test('arrow keys move selection within the same name group', async ({ page }) => {
    const free = page.getByTestId('radio-free');
    const pro  = page.getByTestId('radio-pro');
    const team = page.getByTestId('radio-team');

    await expect(free).toBeChecked();

    await free.focus();
    await page.keyboard.press('ArrowDown');
    await expect(pro).toBeChecked();
    await expect(free).not.toBeChecked();

    await page.keyboard.press('ArrowDown');
    await expect(team).toBeChecked();

    await page.keyboard.press('ArrowUp');
    await expect(pro).toBeChecked();
  });

  test('Space selects a focused radio', async ({ page }) => {
    const free = page.getByTestId('radio-free');
    const pro  = page.getByTestId('radio-pro');

    await expect(free).toBeChecked();

    await pro.focus();
    await page.keyboard.press('Space');
    await expect(pro).toBeChecked();
    await expect(free).not.toBeChecked();
  });

  test('clicking a label selects the wrapped radio', async ({ page }) => {
    const team = page.getByTestId('radio-team');
    await expect(team).not.toBeChecked();

    await page.getByText('Team', { exact: true }).click();
    await expect(team).toBeChecked();
  });

  test('data-variant="warning" radio uses the warning checked colour', async ({ page }) => {
    const warning = page.getByTestId('radio-warning');
    await expect(warning).toBeChecked();

    await expect
      .poll(() => warning.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toMatch(/rgba?\(\s*217,\s*119,\s*6/);
  });

  test('data-size="sm" / "lg" render the radio at sm / lg sizes', async ({ page }) => {
    const sm = page.getByTestId('radio-sm');
    const lg = page.getByTestId('radio-lg');

    const smW = await sm.evaluate((el) => el.getBoundingClientRect().width);
    const lgW = await lg.evaluate((el) => el.getBoundingClientRect().width);

    expect(smW).toBeGreaterThanOrEqual(13);
    expect(smW).toBeLessThanOrEqual(15);
    expect(lgW).toBeGreaterThanOrEqual(21);
    expect(lgW).toBeLessThanOrEqual(23);
  });

  test('checked radio renders the SVG inner dot via background-image', async ({ page }) => {
    const free = page.getByTestId('radio-free');
    await expect(free).toBeChecked();

    const bgImage = await free.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('svg');
  });
});
