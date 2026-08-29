import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/confirm-page';

function post(path, params) {
  return handleDemoApi(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }),
  );
}

describe('confirm-page demo API', () => {
  it('the flow opens on the input step with the stepper on step 1', async () => {
    const response = await handleDemoApi(
      new Request(`${BASE}/flow`, { headers: { 'HX-Request': 'true' } }),
    );
    const body = await response.text();
    expect(body).toContain('id="confirm-page-demo-flow"');
    expect(body).toMatch(/aria-current="step"[^]*?>1</);
    expect(body).toContain('name="item"');
    expect(body).not.toContain('idempotency_key');
  });

  it('confirm validates: 422 re-renders the input step with field errors and echoed values', async () => {
    const response = await post('/confirm', { item: '', amount: 'abc' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('Item is required.');
    expect(body).toContain('value="abc"'); // the bad raw value comes back
  });

  it('a valid confirm renders the review step: parsed values, hidden fields, a fresh key', async () => {
    const body = await (await post('/confirm', { item: 'Chair', amount: '48000' })).text();
    expect(body).toContain('¥48,000'); // the SERVER's parse, formatted
    expect(body).toMatch(/name="idempotency_key" value="ik_[0-9a-f-]+"/);
    expect(body).toContain('<input type="hidden" name="item" value="Chair">');
    expect(body).toContain('name="nav" value="back"');
    expect(body).toContain('name="nav" value="place"');
  });

  it('review mints a fresh key per render', async () => {
    const key = (b) => b.match(/name="idempotency_key" value="(ik_[0-9a-f-]+)"/)?.[1];
    const first = await (await post('/confirm', { item: 'Chair', amount: '1' })).text();
    const second = await (await post('/confirm', { item: 'Chair', amount: '1' })).text();
    expect(key(first)).toBeTruthy();
    expect(key(first)).not.toBe(key(second));
  });

  it('Back re-renders the input step with the values intact', async () => {
    const body = await (
      await post('/place', { nav: 'back', item: 'Chair', amount: '48000', idempotency_key: 'ik_x' })
    ).text();
    expect(body).toContain('value="Chair"');
    expect(body).toContain('value="48000"');
    expect(body).toMatch(/aria-current="step"[^]*?>1</);
  });

  it('Place renders the done step; a replayed key gets the SAME receipt', async () => {
    const params = { nav: 'place', item: 'Chair', amount: '48000', idempotency_key: 'ik_test1' };
    const first = await (await post('/place', params)).text();
    const second = await (await post('/place', params)).text();
    const no = (b) => b.match(/REQ-\d+/)?.[0];
    expect(no(first)).toBeTruthy();
    expect(no(first)).toBe(no(second));
    expect(first).toMatch(/aria-current="step"[^]*?>3</);
  });

  it('answers no-JS flow GETs with a full page', async () => {
    const response = await handleDemoApi(new Request(`${BASE}/flow`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});
