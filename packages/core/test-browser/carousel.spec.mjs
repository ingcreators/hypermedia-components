import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-carousel', () => {
  test('starts on the first slide with prev disabled', async ({ page }) => {
    await expect(page.getByTestId('car-0')).toHaveAttribute('data-active');
    await expect(page.getByTestId('car-prev')).toBeDisabled();
    await expect(page.getByTestId('car-next')).toBeEnabled();
  });

  test('next / prev move the active slide and toggle the end buttons', async ({ page }) => {
    await page.getByTestId('car-next').click();
    await expect(page.getByTestId('car-1')).toHaveAttribute('data-active');
    await expect(page.getByTestId('car-prev')).toBeEnabled();

    await page.getByTestId('car-next').click();
    await expect(page.getByTestId('car-2')).toHaveAttribute('data-active');
    await expect(page.getByTestId('car-next')).toBeDisabled();

    await page.getByTestId('car-prev').click();
    await expect(page.getByTestId('car-1')).toHaveAttribute('data-active');
  });

  test('one dot per slide is generated and navigates', async ({ page }) => {
    const dots = page.getByTestId('car-dots').getByRole('button');
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');

    await dots.nth(2).click();
    await expect(page.getByTestId('car-2')).toHaveAttribute('data-active');
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
  });

  test('a real scroll to the end marks the last slide active', async ({ page }) => {
    // Scroll the rail itself (not the behavior's buttons/dots) so the
    // IntersectionObserver tracking path is exercised. Land exactly on
    // the last slide's snap position: Firefox re-snaps a programmatic
    // scroll to the nearest snap point, so overshooting with
    // scrollLeft = scrollWidth (clamped off-snap) can snap back to an
    // earlier slide there.
    await page.getByTestId('car-2').evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', inline: 'start', block: 'nearest' });
    });
    await expect(page.getByTestId('car-2')).toHaveAttribute('data-active');
    await expect(page.getByTestId('car-next')).toBeDisabled();
  });

  test('ArrowRight on the focused rail advances', async ({ page }) => {
    await page.getByTestId('carousel').locator('.hc-carousel__viewport').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('car-1')).toHaveAttribute('data-active');
  });

  test('axe finds no violations across the carousel example', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-carousel').analyze();
    expect(results.violations).toEqual([]);
  });
});
