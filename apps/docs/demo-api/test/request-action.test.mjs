import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/request-action.mjs';
import { call } from './helpers.mjs';

describe('request-action demo API', () => {
  it('returns the initial region (no items, button carrying count=0)', async () => {
    const response = await call(mod, 'GET', '/items');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('<div id="request-action-demo-items">');
    expect(body).not.toContain('<li>');
    expect(body).toContain(
      'data-hx-post="/hypermedia-components/api/recipes/request-action/items?count=0"',
    );
    expect(body).toContain('data-hx-target="#request-action-demo-items"');
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
    expect(body).toContain('request-action-demo-items');
  });

  it('POST with count=n returns n+1 items, the next count, and a success toast', async () => {
    const response = await call(mod, 'POST', '/items?count=0');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<ul class="hc-list">');
    expect(body.match(/<li>/g)).toHaveLength(1);
    expect(body).toContain('<li>Item 1</li>');
    expect(body).toContain('items?count=1"');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('Item 1 added');
    expect(trigger).toContain('"variant":"success"');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('threads the counter through the button URL', async () => {
    const body = await (await call(mod, 'POST', '/items?count=5')).text();
    expect(body.match(/<li>/g)).toHaveLength(6);
    expect(body).toContain('<li>Item 6</li>');
    expect(body).toContain('items?count=6"');
  });

  it('reaching the cap keeps the button off and notes fullness', async () => {
    const response = await call(mod, 'POST', '/items?count=11');
    const body = await response.text();
    expect(body.match(/<li>/g)).toHaveLength(12);
    expect(body).not.toContain('data-hx-post');
    expect(body).toContain('Demo list is full');
    expect(response.headers.get('HX-Trigger')).toContain('Item 12 added');
  });

  it('POST at the cap returns the full list, a note, and an info toast', async () => {
    const response = await call(mod, 'POST', '/items?count=12');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.match(/<li>/g)).toHaveLength(12);
    expect(body).toContain(
      '<p class="hc-field__message">Demo list is full — reload the page to reset.</p>',
    );
    expect(body).not.toContain('data-hx-post');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('Demo list is full');
    expect(trigger).toContain('"variant":"info"');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('clamps a bogus or overflowing count', async () => {
    const fromNaN = await (await call(mod, 'POST', '/items?count=abc')).text();
    expect(fromNaN.match(/<li>/g)).toHaveLength(1);
    const overflow = await call(mod, 'POST', '/items?count=999');
    expect((await overflow.text()).match(/<li>/g)).toHaveLength(12);
    expect(overflow.headers.get('HX-Trigger')).toContain('"variant":"info"');
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'DELETE', '/items')).toBeNull();
    expect(call(mod, 'GET', '/other')).toBeNull();
  });
});
