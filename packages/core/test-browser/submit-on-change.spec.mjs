import { test, expect } from '@playwright/test';

// data-hc-submit-on-change against real htmx: the switch's change calls
// form.requestSubmit(), htmx takes the submit and POSTs, the target swaps.
// A form that htmx already triggers on change is exempt — exactly one
// request, never two.

test.beforeEach(async ({ page }) => {
  await page.goto('/submit-on-change.html');
});

test.describe('submit-on-change (real htmx)', () => {
  test('toggling the switch posts its form through the submit path', async ({ page }) => {
    const posts = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/mock/dirty/save')) posts.push(r.postData());
    });

    await page.getByTestId('switch-a').check();
    await expect(page.getByTestId('status-a')).toHaveText('Saved.');
    expect(posts).toHaveLength(1);
    // The whole form serialised (hidden false + checked true), no submitter value.
    expect(posts[0]).toBe('beta=false&beta=true');
  });

  test('a form htmx already drives on change is exempt: one request, not two', async ({ page }) => {
    const posts = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/mock/dirty/save')) posts.push(r.url());
    });

    await page.getByTestId('switch-b').check();
    await expect(page.getByTestId('status-b')).toHaveText('Saved.');
    // Give a would-be second request time to show up.
    await page.waitForTimeout(400);
    expect(posts).toHaveLength(1);
  });
});
