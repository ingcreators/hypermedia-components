import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed chat-messages recipe against real htmx: one POST
// appends the user message plus the aria-busy assistant placeholder to
// the role="log" transcript and resets the composer out of band; an
// empty prompt is a 422 whose only payload is the OOB composer
// re-render, so the transcript never gains a bogus entry. The
// /mock/chat routes (serve.mjs) stand in for the server.

test.beforeEach(async ({ page }) => {
  await page.goto('/chat-messages.html');
  await page.request.get('/mock/chat/reset');
  await expect(page.getByTestId('composer')).toBeVisible();
});

test.describe('chat-messages recipe', () => {
  test('send appends the user message and the aria-busy placeholder', async ({ page }) => {
    await page.getByTestId('prompt').fill('What failed in CI?');
    await page.getByTestId('send').click();

    const user = page.getByTestId('user-1');
    await expect(user).toHaveText('What failed in CI?');
    await expect(user).toHaveAttribute('data-role', 'user');

    const reply = page.getByTestId('reply-1');
    await expect(reply).toHaveAttribute('aria-busy', 'true');
    await expect(reply).toHaveAttribute('data-state', 'streaming');
    // Chronological order: placeholder follows the user message.
    await expect(page.getByTestId('list').locator('.hc-chat__message')).toHaveCount(3);
  });

  test('the composer resets out of band after a send', async ({ page }) => {
    await page.getByTestId('prompt').fill('First question');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('user-1')).toBeVisible();
    await expect(page.getByTestId('prompt')).toHaveValue('');
  });

  test('an empty prompt is a 422: composer error, transcript untouched', async ({ page }) => {
    await page.getByTestId('send').click();

    await expect(page.getByTestId('prompt-error')).toHaveText('Type a message first.');
    await expect(page.getByTestId('composer')).toHaveAttribute('data-invalid', 'true');
    await expect(page.getByTestId('prompt')).toHaveAttribute('aria-invalid', 'true');
    // Nothing appended: only the seeded greeting remains.
    await expect(page.getByTestId('list').locator('.hc-chat__message')).toHaveCount(1);
  });

  test('the transcript stays pinned to the newest exchange', async ({ page }) => {
    for (const q of ['one', 'two', 'three', 'four', 'five', 'six']) {
      await page.getByTestId('prompt').fill(`Question ${q} with enough text to add height.`);
      await page.getByTestId('send').click();
      await expect(page.getByTestId('prompt')).toHaveValue('');
    }
    await expect(page.getByTestId('chat')).toHaveAttribute('data-stuck', 'true');
    const m = await page.getByTestId('list').evaluate((el) => ({
      gap: el.scrollHeight - el.scrollTop - el.clientHeight,
      overflowing: el.scrollHeight > el.clientHeight,
    }));
    expect(m.overflowing).toBe(true);
    expect(m.gap).toBeLessThanOrEqual(24);
  });

  test('axe finds no violations with the placeholder pending', async ({ page }) => {
    await page.getByTestId('prompt').fill('Accessibility check');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('reply-1')).toHaveAttribute('aria-busy', 'true');
    const results = await new AxeBuilder({ page }).include('#section-chat-messages').analyze();
    expect(results.violations).toEqual([]);
  });
});
