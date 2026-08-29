import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/network-retry';

function save(params, query = '') {
  return handleDemoApi(
    new Request(`${BASE}/save${query}`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }),
  );
}

describe('network-retry demo API', () => {
  it('a healthy save answers instantly with the receipt', async () => {
    const response = await save({ amount: '1200' });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Saved — ¥1200');
    expect(body).toContain('hc-card');
  });

  it('the down flavour answers only after the client would have given up', async () => {
    // ?fast=1 skips the real 4s sleep; the marker shows this body is
    // the one htmx discards after its declared timeout aborts.
    const response = await save({ amount: '1200', down: '1' }, '?fast=1');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('data-late-response');
  });

  it('answers no-JS saves with a full page', async () => {
    const response = await handleDemoApi(
      new Request(`${BASE}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ amount: '800' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});
