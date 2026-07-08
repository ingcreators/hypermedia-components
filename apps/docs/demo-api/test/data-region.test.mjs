import { describe, expect, it } from 'vitest';
import * as dataRegion from '../recipes/data-region.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/data-region';

describe('data-region demo API', () => {
  it('GET /items renders the complete section for htmx (idempotent swap unit)', async () => {
    const response = await call(dataRegion, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="data-region-demo-items"');
    expect(body).toContain('class="hc-data-region"');
    expect(body).toContain(`data-hx-get="${API}/items"`);
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('data-hx-indicator="closest .hc-data-region"');
    expect(body).toContain('aria-busy="false"');
    expect(body).toContain('<header class="hc-data-region__header">');
    expect(body).toContain('<h2>Items</h2>');
    expect(body).toContain('<span class="hc-spinner htmx-indicator" aria-hidden="true"></span>');
    // The three canned items.
    expect(body).toContain('<li>Anvil</li>');
    expect(body).toContain('<li>Rocket skates</li>');
    expect(body).toContain('<li>Tornado seeds</li>');
    // The id appears exactly once — the outerHTML swap stays idempotent.
    expect(body.match(/id="data-region-demo-items"/g)).toHaveLength(1);
    expect(body).not.toContain('<!doctype');
  });

  it('GET /items re-renders with an event-only trigger (no `load` — no refetch loop)', async () => {
    const response = await call(dataRegion, 'GET', '/items');
    const body = await response.text();
    // htmx fires `load` on every freshly processed element, so echoing
    // it back in an outerHTML self-swap would refetch forever. The
    // fragment listens for the domain event only.
    expect(body).toContain('data-hx-trigger="items:changed from:body"');
    expect(body).not.toContain('load,');
  });

  it('GET /items carries the timestamp line that makes refetches visible', async () => {
    const response = await call(dataRegion, 'GET', '/items');
    const body = await response.text();
    expect(body).toMatch(
      /<p class="hc-field__message">Rendered at \d{2}:\d{2}:\d{2} UTC<\/p>/,
    );
  });

  it('GET /items without HX-Request renders the full-page fallback', async () => {
    const response = await call(dataRegion, 'GET', '/items', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<li>Anvil</li>');
  });

  it('POST /refresh answers 204 with both events in one ASCII-safe HX-Trigger', async () => {
    const response = await call(dataRegion, 'POST', '/refresh');
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const header = response.headers.get('HX-Trigger');
    expect(header).toContain('"items:changed":{}');
    expect(header).toContain('"hc:toast"');
    expect(header).toContain('"variant":"success"');
    // The em dash is \uXXXX-escaped — the header stays pure ASCII.
    expect(header).toContain('\\u2014');
    // (printable ASCII only)
    expect(header).toMatch(/^[\x20-\x7e]*$/);
  });

  it('returns null for unknown routes', async () => {
    expect(await call(dataRegion, 'GET', '/refresh')).toBeNull();
    expect(await call(dataRegion, 'POST', '/items')).toBeNull();
    expect(await call(dataRegion, 'GET', '/nope')).toBeNull();
  });
});
