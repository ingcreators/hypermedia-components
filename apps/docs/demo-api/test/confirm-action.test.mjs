import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/confirm-action.mjs';
import { call } from './helpers.mjs';

describe('confirm-action demo API', () => {
  it('returns the three rows with confirm-gated delete buttons', async () => {
    const response = await call(mod, 'GET', '/items');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body.match(/<tr>/g)).toHaveLength(3);
    for (const name of ['Anvil', 'Sprocket', 'Widget']) {
      expect(body).toContain(`data-hc-confirm="Delete ${name}?"`);
    }
    expect(body).toContain(
      'data-hx-delete="/hypermedia-components/api/recipes/confirm-action/items/1"',
    );
    expect(body).toContain('data-hx-trigger="hc:confirmed"');
    expect(body).toContain('data-hx-target="closest tr"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('data-hx-disabled-elt="this"');
    expect(body).toContain('data-hx-indicator="closest .hc-action"');
    expect(body).toContain('hc-spinner htmx-indicator');
    expect(body).not.toContain('<!doctype');
  });

  it('answers a plain GET (no-JS fallback) with a full page', async () => {
    const response = await call(mod, 'GET', '/items', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<td>Anvil</td>');
  });

  it('answers DELETE on a known id with 200, empty body, and a named toast', async () => {
    const response = await call(mod, 'DELETE', '/items/2');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('\\"Sprocket\\" deleted');
    expect(trigger).toContain('"variant":"success"');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('answers DELETE on an unknown id with 404', async () => {
    const response = await call(mod, 'DELETE', '/items/99');
    expect(response.status).toBe(404);
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'POST', '/items')).toBeNull();
    expect(call(mod, 'GET', '/items/1')).toBeNull();
  });
});
