import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

function get(query = '', { htmx = true } = {}) {
  return handleDemoApi(
    new Request(`http://demo.test/api/recipes/live-search/items${query}`, {
      headers: htmx ? { 'HX-Request': 'true' } : {},
    }),
  );
}

describe('live-search demo API', () => {
  it('returns the full list as a ul fragment', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('<ul>');
    expect(body).toContain('<li>Button</li>');
    expect(body).not.toContain('<!doctype');
  });

  it('filters case-insensitively on q', async () => {
    const body = await (await get('?q=tab')).text();
    expect(body).toContain('<li>Table</li>');
    expect(body).toContain('<li>Tabs</li>');
    expect(body).not.toContain('<li>Button</li>');
  });

  it('returns the empty state when nothing matches, escaping the term', async () => {
    const body = await (await get('?q=<zzz>')).text();
    expect(body).toContain('hc-field__message');
    expect(body).toContain('&lt;zzz&gt;');
    expect(body).not.toContain('<zzz>');
  });

  it('answers plain form GETs (no-JS fallback) with a full page', async () => {
    const response = await get('?q=tab', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('role="search"');
    expect(body).toContain('<li>Tabs</li>');
  });
});
