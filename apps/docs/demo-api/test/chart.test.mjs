import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/chart.mjs';
import { call } from './helpers.mjs';

describe('chart demo API', () => {
  it('returns the EMEA chart figure by default', async () => {
    const response = await call(mod, 'GET', '/reports/sales');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain(
      '<figure class="hc-chart" data-hc-chart="bar" data-y-label="Sales ($k)"',
    );
    // The em dash stays literal in the body — it is UTF-8 HTML, only
    // HX-Trigger headers need ASCII escaping.
    expect(body).toContain('data-title="Monthly sales — EMEA"');
    expect(body).toContain('<caption>Monthly sales — EMEA</caption>');
    expect(body).toContain('<table class="hc-table">');
    expect(body).toContain('<thead><tr><th>Month</th><th>Sales</th></tr></thead>');
    expect(body.match(/<tr><td>/g)).toHaveLength(6);
    expect(body).not.toContain('<!doctype');
  });

  it('returns different data for the APAC region', async () => {
    const emea = await (await call(mod, 'GET', '/reports/sales?region=emea')).text();
    const apac = await (await call(mod, 'GET', '/reports/sales?region=apac')).text();
    expect(apac).toContain('data-title="Monthly sales — APAC"');
    expect(apac).not.toBe(emea);
    // Same months, different numbers
    for (const month of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']) {
      expect(emea).toContain(`<td>${month}</td>`);
      expect(apac).toContain(`<td>${month}</td>`);
    }
    expect(emea).toContain('<td>120</td>');
    expect(apac).toContain('<td>90</td>');
  });

  it('falls back to EMEA for an unknown region', async () => {
    const response = await call(mod, 'GET', '/reports/sales?region=mars');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Monthly sales — EMEA');
  });

  it('answers a plain GET (no-JS fallback) with the figure in a full page', async () => {
    const response = await call(mod, 'GET', '/reports/sales', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<figure class="hc-chart"');
    expect(body).toContain('<td>Jan</td>');
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'POST', '/reports/sales')).toBeNull();
    expect(call(mod, 'GET', '/reports')).toBeNull();
  });
});
