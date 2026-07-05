import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-chat + installChatScroll: chronological DOM, stick-to-bottom
// behavior, aria-busy streaming deferral markup, and the attachment
// cards. The scroll behavior has no network and no timers, so every
// assertion here is on settled DOM state.
test.beforeEach(async ({ page }) => {
  // Gated transitions off so the dark-theme axe pass samples final
  // palettes (hc.a11y.css zeroes them under reduced motion).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/chat.html');
});

const metrics = (list) =>
  list.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));

test.describe('hc-chat / installChatScroll', () => {
  test('starts pinned to the bottom and reflects data-stuck', async ({ page }) => {
    const chat = page.getByTestId('chat');
    await expect(chat).toHaveAttribute('data-stuck', 'true');
    const m = await metrics(page.getByTestId('list'));
    expect(m.scrollHeight - m.scrollTop - m.clientHeight).toBeLessThanOrEqual(24);
  });

  test('appended content keeps the pinned list at the bottom', async ({ page }) => {
    const list = page.getByTestId('list');
    await list.evaluate((el) => {
      const li = document.createElement('li');
      li.className = 'hc-chat__message';
      li.setAttribute('data-role', 'assistant');
      li.innerHTML = '<div class="hc-chat__body">A brand new reply that adds height.</div>';
      el.appendChild(li);
    });
    await expect(page.getByTestId('chat')).toHaveAttribute('data-stuck', 'true');
    const m = await metrics(list);
    expect(m.scrollHeight - m.scrollTop - m.clientHeight).toBeLessThanOrEqual(24);
  });

  test('scrolling up releases the pin and reveals the jump button', async ({ page }) => {
    const chat = page.getByTestId('chat');
    const jump = page.getByTestId('jump');
    await expect(jump).toBeHidden();

    await page.getByTestId('list').evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(chat).toHaveAttribute('data-stuck', 'false');
    await expect(jump).toBeVisible();

    // Streamed text into the body must NOT drag the reader back down.
    await page.getByTestId('stream-body').evaluate((el) => {
      el.append(' a missing fixture file, repeated across several lines of explanation.');
    });
    await expect(chat).toHaveAttribute('data-stuck', 'false');
    const m = await metrics(page.getByTestId('list'));
    expect(m.scrollTop).toBeLessThanOrEqual(24);
  });

  test('the jump button re-pins to the bottom', async ({ page }) => {
    await page.getByTestId('list').evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(page.getByTestId('jump')).toBeVisible();
    await page.getByTestId('jump').click();
    await expect(page.getByTestId('chat')).toHaveAttribute('data-stuck', 'true');
    await expect(page.getByTestId('jump')).toBeHidden();
    const m = await metrics(page.getByTestId('list'));
    expect(m.scrollHeight - m.scrollTop - m.clientHeight).toBeLessThanOrEqual(24);
  });

  test('roles align the bubbles and the streaming caret is markup-free', async ({ page }) => {
    // user message hugs the inline end, assistant the inline start
    const [user, assistant] = await Promise.all([
      page.getByTestId('m-user').boundingBox(),
      page.getByTestId('m-assistant').boundingBox(),
    ]);
    const list = await page.getByTestId('list').boundingBox();
    expect(user.x + user.width).toBeGreaterThan(assistant.x + assistant.width - 1);
    expect(assistant.x - list.x).toBeLessThan(user.x - list.x);

    // The streaming placeholder defers announcement via aria-busy and
    // draws its caret with CSS only (no extra DOM inside the body).
    const streaming = page.getByTestId('m-streaming');
    await expect(streaming).toHaveAttribute('aria-busy', 'true');
    const caret = await streaming.evaluate(
      (el) => getComputedStyle(el.querySelector('.hc-chat__body'), '::after').content,
    );
    expect(caret).toContain('▍');
  });

  test('attachment states show and hide the progress row', async ({ page }) => {
    await expect(
      page.getByTestId('att-uploading').locator('.hc-attachment__progress'),
    ).toBeVisible();
    await expect(
      page.getByTestId('att-settled').locator('.hc-attachment__progress'),
    ).toHaveCount(0);
    // Error card picks up the status tint.
    const settledBg = await page
      .getByTestId('att-settled')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const errorBg = await page
      .getByTestId('att-error')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(errorBg).not.toBe(settledBg);
  });

  test('axe finds no violations in light and dark', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
