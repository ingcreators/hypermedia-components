import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/filter-popover.mjs';
import { call } from './helpers.mjs';

describe('filter-popover demo API', () => {
  it('returns all eight items unfiltered, with status badges', async () => {
    const response = await call(mod, 'GET', '/items');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('<ul class="hc-list">');
    expect(body.match(/<li>/g)).toHaveLength(8);
    expect(body).toContain('Ingest pipeline <span class="hc-badge" data-variant="success">Active</span>');
    expect(body).toContain('<span class="hc-badge" data-variant="warning">Pending</span>');
    expect(body).toContain('<span class="hc-badge" data-variant="error">Failed</span>');
    expect(body).not.toContain('<!doctype');
  });

  it('filters on status', async () => {
    const body = await (await call(mod, 'GET', '/items?status=failed')).text();
    expect(body.match(/<li>/g)).toHaveLength(2);
    expect(body).toContain('Legacy sync');
    expect(body).toContain('Report mailer');
    expect(body).not.toContain('Ingest pipeline');
  });

  it('treats status=all as no status filter', async () => {
    const body = await (await call(mod, 'GET', '/items?status=all')).text();
    expect(body.match(/<li>/g)).toHaveLength(8);
  });

  it('filters on q as a case-insensitive substring', async () => {
    const body = await (await call(mod, 'GET', '/items?q=BACK')).text();
    expect(body.match(/<li>/g)).toHaveLength(1);
    expect(body).toContain('Nightly backup');
  });

  it('combines status and q filters', async () => {
    const body = await (
      await call(mod, 'GET', '/items?status=pending&q=billing')
    ).text();
    expect(body.match(/<li>/g)).toHaveLength(1);
    expect(body).toContain('Billing export');

    // Same q under a non-matching status → empty state.
    const miss = await (
      await call(mod, 'GET', '/items?status=failed&q=billing')
    ).text();
    expect(miss).not.toContain('<li>');
  });

  it('returns the explicit empty state when nothing matches', async () => {
    const body = await (await call(mod, 'GET', '/items?q=zzz')).text();
    expect(body).toBe(
      '<p class="hc-field__message">No items match the current filters.</p>',
    );
  });

  it('answers a plain GET (no-JS fallback) with a full page, escaping q', async () => {
    const response = await call(mod, 'GET', '/items?status=pending&q=<zzz>', {
      htmx: false,
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<option value="pending" selected>');
    expect(body).toContain('value="&lt;zzz&gt;"');
    expect(body).not.toContain('value="<zzz>"');
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'POST', '/items')).toBeNull();
    expect(call(mod, 'GET', '/items/1')).toBeNull();
  });
});
