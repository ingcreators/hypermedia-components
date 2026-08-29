import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

function get(query = '', { htmx = true } = {}) {
  return handleDemoApi(
    new Request(`http://demo.test/api/recipes/result-cap/orders${query}`, {
      headers: htmx ? { 'HX-Request': 'true' } : {},
    }),
  );
}

describe('result-cap demo API', () => {
  it('truncates the empty search: banner, cap+ count, exactly cap rows', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-hc-result-cap');
    expect(body).toContain('role="status"');
    expect(body).toContain('data-variant="warning"');
    expect(body).toContain('25+ results');
    expect(body.match(/<li>/g)).toHaveLength(25);
    expect(body).not.toContain('role="alert"');
  });

  it('renders exact counts and no banner at or under the cap', async () => {
    const body = await (await get('?q=anvil')).text();
    expect(body).not.toContain('data-hc-result-cap');
    expect(body).toMatch(/\d+ results?/);
    expect(body).toContain('Anvil Co.');
  });

  it('hard-rejects over the cap in reject mode: no rows, still 200', async () => {
    const response = await get('?mode=reject');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('hc-empty');
    expect(body).toContain('data-hc-result-cap');
    expect(body).not.toContain('<li>');
  });

  it('returns the plain empty state when nothing matches, escaping the term', async () => {
    const body = await (await get('?q=<zzz>')).text();
    expect(body).toContain('hc-empty');
    expect(body).not.toContain('data-hc-result-cap');
    expect(body).toContain('&lt;zzz&gt;');
    expect(body).not.toContain('<zzz>');
  });

  it('answers plain form GETs (no-JS fallback) with a full page, same branch', async () => {
    const response = await get('?mode=reject', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('role="search"');
    expect(body).toContain('data-hc-result-cap');
    expect(body).not.toContain('<li>');
  });
});
