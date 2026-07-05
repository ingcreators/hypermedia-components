import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pins the blessed streaming-response recipe against real htmx + the
// vendored SSE extension and a real event stream (serve.mjs
// /mock/chat/stream/:id): `chunk` events append into the aria-busy
// placeholder's body, `done` outerHTML-swaps the complete final
// message over it (which also closes the EventSource — the connect
// element leaves the DOM), `error` swaps in a retry affordance, and
// the stop button cancels in one round trip. The composer POST is the
// chat-messages contract with ?stream=1.

test.beforeEach(async ({ page }) => {
  await page.goto('/streaming-response.html');
  await page.request.get('/mock/chat/reset');
  await expect(page.getByTestId('composer')).toBeVisible();
});

test.describe('streaming-response recipe', () => {
  test('chunks grow the placeholder body while aria-busy holds; done swaps the final message', async ({ page }) => {
    await page.getByTestId('prompt').fill('Stream me an answer');
    await page.getByTestId('send').click();

    // Mid-stream: the body is growing but the reply is still deferred.
    const reply = page.getByTestId('reply-1');
    await expect(reply.locator('.hc-chat__body')).toContainText('Here');
    await expect(reply).toHaveAttribute('aria-busy', 'true');
    await expect(reply).toHaveAttribute('data-state', 'streaming');

    // Final swap: the complete message replaces the placeholder — no
    // aria-busy, no data-state, no stop button, stream markup gone.
    const done = page.getByTestId('done-1');
    await expect(done).toHaveText('Here is the answer.');
    await expect(done).not.toHaveAttribute('aria-busy');
    await expect(done).not.toHaveAttribute('data-state');
    await expect(page.getByTestId('reply-1')).toHaveCount(0);
    await expect(page.locator('[data-sse-connect]')).toHaveCount(0);
    // Chronology intact: greeting, user, final reply.
    await expect(page.getByTestId('list').locator('.hc-chat__message')).toHaveCount(3);
  });

  test('the transcript stays pinned while chunks stream in', async ({ page }) => {
    // Fill the list past overflow first (non-streamed height helpers).
    for (const q of ['one', 'two', 'three', 'four', 'five']) {
      await page.getByTestId('prompt').fill(`Warm-up ${q} with enough text to add height.`);
      await page.getByTestId('send').click();
      await expect(page.getByTestId('prompt')).toHaveValue('');
      await expect(page.getByTestId(`done-${['one', 'two', 'three', 'four', 'five'].indexOf(q) + 1}`)).toBeVisible();
    }
    await page.getByTestId('prompt').fill('Stream a long reply');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('done-6')).toBeVisible();

    await expect(page.getByTestId('chat')).toHaveAttribute('data-stuck', 'true');
    const m = await page.getByTestId('list').evaluate((el) => ({
      gap: el.scrollHeight - el.scrollTop - el.clientHeight,
      overflowing: el.scrollHeight > el.clientHeight,
    }));
    expect(m.overflowing).toBe(true);
    expect(m.gap).toBeLessThanOrEqual(24);
  });

  test('an error event replaces the placeholder with a retry affordance', async ({ page }) => {
    await page.getByTestId('prompt').fill('fail');
    await page.getByTestId('send').click();

    const error = page.getByTestId('error-1');
    await expect(error).toHaveAttribute('data-state', 'error');
    await expect(error).not.toHaveAttribute('aria-busy');
    await expect(error.getByTestId('retry-1')).toBeVisible();
    await expect(page.getByTestId('reply-1')).toHaveCount(0);
    await expect(page.locator('[data-sse-connect]')).toHaveCount(0);

    // The retry affordance re-enters the normal contract.
    await error.getByTestId('retry-1').click();
    await expect(page.getByTestId('done-2')).toHaveText('Here is the answer.');
  });

  test('the stop button cancels the stream in one round trip', async ({ page }) => {
    await page.getByTestId('prompt').fill('slow');
    await page.getByTestId('send').click();

    const reply = page.getByTestId('reply-1');
    await expect(reply.locator('.hc-chat__body')).toContainText('tok2');
    await reply.getByTestId('stop-1').click();

    const stopped = page.getByTestId('stopped-1');
    await expect(stopped).toHaveText('Generation stopped.');
    await expect(stopped).not.toHaveAttribute('aria-busy');
    await expect(page.locator('[data-sse-connect]')).toHaveCount(0);

    // The stream is really closed: the transcript stays put.
    const text = await stopped.textContent();
    await page.waitForTimeout(600);
    await expect(stopped).toHaveText(text);
    await expect(page.getByTestId('list').locator('.hc-chat__message')).toHaveCount(3);
  });

  test('axe finds no violations mid-stream', async ({ page }) => {
    await page.getByTestId('prompt').fill('slow');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('reply-1').locator('.hc-chat__body')).toContainText('tok1');
    const results = await new AxeBuilder({ page }).include('#section-streaming-response').analyze();
    expect(results.violations).toEqual([]);
  });
});
