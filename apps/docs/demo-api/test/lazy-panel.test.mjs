import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/lazy-panel.mjs';
import { call } from './helpers.mjs';

const PANELS = {
  usage: 'Usage',
  advanced: 'Advanced settings',
  overview: 'Overview',
  revenue: 'Revenue',
};

describe('lazy-panel demo API', () => {
  for (const [id, title] of Object.entries(PANELS)) {
    it(`returns the ${id} card with a load timestamp and no caching`, async () => {
      const response = await call(mod, 'GET', `/panels/${id}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.text();
      expect(body).toContain('<div class="hc-card">');
      expect(body).toContain(`<header class="hc-card__header">${title}</header>`);
      expect(body).toMatch(
        /<p class="hc-field__message">Loaded at \d{2}:\d{2}:\d{2} UTC<\/p>/,
      );
      expect(body).not.toContain('<!doctype');
    });
  }

  it('answers a plain GET (no-JS fallback) with a full page', async () => {
    const response = await call(mod, 'GET', '/panels/usage', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<header class="hc-card__header">Usage</header>');
  });

  it('answers the flaky panel with 503 + HX-Reswap + alert + error toast', async () => {
    const response = await call(mod, 'GET', '/panels/flaky');
    expect(response.status).toBe(503);
    expect(response.headers.get('HX-Reswap')).toBe('innerHTML');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text();
    expect(body).toBe(
      '<p class="hc-alert" data-variant="error" role="alert">Reports are temporarily unavailable. Refresh in a minute.</p>',
    );
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('Reports are temporarily unavailable');
    expect(trigger).toContain('"variant":"error"');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('returns null for unknown routes', async () => {
    // handle() is async (artificial delay), so resolve before asserting.
    await expect(call(mod, 'GET', '/panels/nope')).resolves.toBeNull();
    await expect(call(mod, 'POST', '/panels/usage')).resolves.toBeNull();
    await expect(call(mod, 'GET', '/panels')).resolves.toBeNull();
  });
});
