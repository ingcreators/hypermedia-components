import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/idempotency-key';

function getForm() {
  return handleDemoApi(new Request(`${BASE}/form`, { headers: { 'HX-Request': 'true' } }));
}

function order(params) {
  return handleDemoApi(
    new Request(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }),
  );
}

describe('idempotency-key demo API', () => {
  it('mints a fresh key per form render', async () => {
    const first = await (await getForm()).text();
    const second = await (await getForm()).text();
    const key = (body) => body.match(/name="idempotency_key" value="(ik_[0-9a-f-]+)"/)?.[1];
    expect(key(first)).toBeTruthy();
    expect(key(second)).toBeTruthy();
    expect(key(first)).not.toBe(key(second));
    expect(first).toContain('name="receipt" value=""');
  });

  it('first commit answers with the order and spends the key out-of-band', async () => {
    const response = await order([
      ['idempotency_key', 'ik_test1234'], ['amount', '1200'],
      ['receipt', ''], ['receipt_amount', ''],
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get('HX-Trigger')).toContain('hc:toast');
    const body = await response.text();
    expect(body).toMatch(/ORD-\d+/);
    expect(body).toContain('name="receipt" value="ik_test1234"');
    expect(body).toContain('data-hx-swap-oob="true"');
    expect(body).not.toContain('replayed');
  });

  it('a replayed key with the same payload gets the ORIGINAL response back, not an error', async () => {
    const first = await (
      await order([['idempotency_key', 'ik_test1234'], ['amount', '1200'], ['receipt', ''], ['receipt_amount', '']])
    ).text();
    const replay = await order([
      ['idempotency_key', 'ik_test1234'], ['amount', '1200'],
      ['receipt', 'ik_test1234'], ['receipt_amount', '1200'],
    ]);
    expect(replay.status).toBe(200);
    expect(replay.headers.get('HX-Trigger')).toContain('hc:toast');
    const body = await replay.text();
    const no = (b) => b.match(/ORD-\d+/)?.[0];
    expect(no(body)).toBe(no(first)); // the same order, not a second one
    expect(body).toContain('original');
  });

  it('the same key with a DIFFERENT payload is a real conflict: 422 naming the existing order', async () => {
    const response = await order([
      ['idempotency_key', 'ik_test1234'], ['amount', '9999'],
      ['receipt', 'ik_test1234'], ['receipt_amount', '1200'],
    ]);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('different values');
    expect(body).toContain('¥1,200'.replace('1,200', '1200')); // names the existing amount
    expect(body).toContain('role="status"');
  });

  it('a validation failure leaves the key live (no receipt written)', async () => {
    const response = await order([
      ['idempotency_key', 'ik_test1234'], ['amount', 'abc'],
      ['receipt', ''], ['receipt_amount', ''],
    ]);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('still live');
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('answers no-JS form GETs with a full page', async () => {
    const response = await handleDemoApi(new Request(`${BASE}/form`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});
