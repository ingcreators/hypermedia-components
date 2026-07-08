import { describe, expect, it } from 'vitest';
import * as datagridPager from '../recipes/datagrid-pager.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/datagrid-pager';
const URL_FOR = (p, size = 100) => `${API}/products?page=${p}&size=${size}`;

const countRows = (body) => (body.match(/<tr class="hc-datagrid__row">/g) ?? []).length;

describe('datagrid-pager demo API', () => {
  it('GET /products defaults to page 1 size 100 and returns exactly the rows', async () => {
    const response = await call(datagridPager, 'GET', '/products');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(countRows(body)).toBe(100);
    // First row of page 1: row index 1 → id 101.
    expect(body).toContain('scope="row">101</th>');
    expect(body).toContain('scope="row">200</th>');
    expect(body).not.toContain('scope="row">201</th>');
    expect(body).not.toContain('<!doctype');
  });

  it('renders rows with the contract column structure', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=1&size=10');
    const body = await response.text();
    expect(body).toContain(
      '<td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" aria-label="Select ',
    );
    expect(body).toContain(
      '<th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">101</th>',
    );
    expect(body).toContain('<td class="hc-datagrid__cell" data-col="name">');
    expect(body).toMatch(/<td class="hc-datagrid__cell">\$[\d,]+<\/td>/);
  });

  it('page 1 ships the OOB pager: aria-current on 1, Prev disabled, Next live', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=1&size=100');
    const body = await response.text();
    expect(body).toContain(
      '<nav class="hc-pagination" id="datagrid-pager-demo-pager" hx-swap-oob="true" aria-label="Pagination">',
    );
    expect(body).toContain(`aria-current="page" href="?page=1&size=100" data-hx-get="${URL_FOR(1)}"`);
    // Disabled Prev: aria-disabled, data-hc-rel, and no htmx wiring.
    const prev = body.match(/<a class="hc-pagination__item" data-hc-rel="prev"[^>]*>Prev<\/a>/)?.[0];
    expect(prev).toBeDefined();
    expect(prev).toContain('aria-disabled="true"');
    expect(prev).not.toContain('data-hx-get');
    // Live Next points at page 2.
    const next = body.match(/<a class="hc-pagination__item" data-hc-rel="next"[^>]*>Next<\/a>/)?.[0];
    expect(next).toContain(`data-hx-get="${URL_FOR(2)}"`);
    expect(next).toContain('data-hx-target="#datagrid-pager-demo-rows"');
    expect(next).toContain('data-hx-swap="innerHTML"');
    expect(next).not.toContain('aria-disabled');
  });

  it('page 3 ships the OOB status with the correct bounds', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=3&size=100');
    const body = await response.text();
    expect(body).toContain(
      '<p id="datagrid-pager-demo-status" hx-swap-oob="true" aria-live="polite">201–300 / 5,000</p>',
    );
    expect(countRows(body)).toBe(100);
    expect(body).toContain('scope="row">301</th>'); // row 201 → id 301
  });

  it('windows the numbers around the current page with ellipses and first/last', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=25&size=100');
    const body = await response.text();
    // 1 … 23 24 [25] 26 27 … 50
    for (const p of [1, 23, 24, 26, 27, 50]) {
      expect(body).toContain(`data-hx-get="${URL_FOR(p)}" data-hx-target="#datagrid-pager-demo-rows" data-hx-swap="innerHTML">${p}</a>`);
    }
    expect(body).toContain(`aria-current="page" href="?page=25&size=100"`);
    expect(body.match(/<span class="hc-pagination__ellipsis">…<\/span>/g)).toHaveLength(2);
    expect(body).not.toContain('>22</a>');
  });

  it('clamps page beyond the last page and disables Next there', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=999&size=100');
    const body = await response.text();
    expect(body).toContain('>4,901–5,000 / 5,000</p>');
    expect(body).toContain('aria-current="page" href="?page=50&size=100"');
    const next = body.match(/<a class="hc-pagination__item" data-hc-rel="next"[^>]*>Next<\/a>/)?.[0];
    expect(next).toContain('aria-disabled="true"');
    expect(next).not.toContain('data-hx-get');
    // The last page is full here (5,000 / 100), rendered entirely.
    expect(countRows(body)).toBe(100);
    expect(body).toContain('scope="row">5100</th>'); // row 5000 → id 5100
  });

  it('clamps size to [10, 200] and page/size garbage to the defaults', async () => {
    const tiny = await (await call(datagridPager, 'GET', '/products?page=1&size=3')).text();
    expect(countRows(tiny)).toBe(10);
    const huge = await (await call(datagridPager, 'GET', '/products?page=1&size=9999')).text();
    expect(countRows(huge)).toBe(200);
    const garbage = await (await call(datagridPager, 'GET', '/products?page=abc&size=xyz')).text();
    expect(countRows(garbage)).toBe(100);
    expect(garbage).toContain('>1–100 / 5,000</p>');
  });

  it('threads the size through every pager URL', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=2&size=25');
    const body = await response.text();
    expect(body).toContain(`data-hx-get="${URL_FOR(3, 25)}"`);
    expect(body).toContain('href="?page=3&size=25"');
    expect(body).toContain('>26–50 / 5,000</p>');
  });

  it('GET without HX-Request renders the full page with that window (href fallback)', async () => {
    const response = await call(datagridPager, 'GET', '/products?page=2&size=100', {
      htmx: false,
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(countRows(body)).toBe(100);
    expect(body).toContain('scope="row">201</th>');
    // The full page carries the pager/status inline, not out-of-band.
    expect(body).not.toContain('hx-swap-oob');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(datagridPager, 'GET', '/nope')).toBeNull();
    expect(await call(datagridPager, 'POST', '/products')).toBeNull();
  });
});
