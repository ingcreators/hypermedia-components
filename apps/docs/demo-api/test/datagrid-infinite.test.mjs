import { describe, expect, it } from 'vitest';
import * as datagridInfinite from '../recipes/datagrid-infinite.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/datagrid-infinite';

const rowCount = (body) => body.match(/scope="row"/g)?.length ?? 0;

describe('datagrid-infinite demo API', () => {
  it('answers the first batch plus a sentinel carrying the next cursor', async () => {
    const response = await call(datagridInfinite, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(rowCount(body)).toBe(5);
    expect(body).toContain('>item-1<');
    expect(body).toContain('>item-5<');
    expect(body).toContain(`data-hx-get="${API}/items?after=item-5"`);
    expect(body).toContain('data-hx-trigger="revealed"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('aria-live="polite"');
    expect(body).not.toContain('15 of 15');
  });

  it('continues from the cursor with the next batch + renewed sentinel', async () => {
    const body = await (await call(datagridInfinite, 'GET', '/items?after=item-5')).text();
    expect(rowCount(body)).toBe(5);
    expect(body).toContain('>item-6<');
    expect(body).toContain('>item-10<');
    expect(body).not.toContain('>item-5<');
    expect(body).toContain(`data-hx-get="${API}/items?after=item-10"`);
  });

  it('ends the list with the final batch, no sentinel, and the aria-live end marker', async () => {
    const body = await (await call(datagridInfinite, 'GET', '/items?after=item-10')).text();
    expect(rowCount(body)).toBe(5);
    expect(body).toContain('>item-15<');
    expect(body).not.toContain('data-hx-trigger="revealed"');
    expect(body).toContain('15 of 15');
    expect(body).toContain('aria-live="polite"');
  });

  it('answers a past-the-end cursor with the empty batch + end marker (never 4xx)', async () => {
    const response = await call(datagridInfinite, 'GET', '/items?after=item-15');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(rowCount(body)).toBe(0);
    expect(body).toContain('15 of 15');
    expect(body).not.toContain('data-hx-trigger="revealed"');
  });

  it('resumes stale cursors from the nearest stable point', async () => {
    // Garbage resumes from the start…
    const garbled = await (await call(datagridInfinite, 'GET', '/items?after=zzz')).text();
    expect(garbled).toContain('>item-1<');
    // …an overflowing id clamps to the end…
    const past = await (await call(datagridInfinite, 'GET', '/items?after=item-999')).text();
    expect(past).toContain('15 of 15');
    // …and a mid-batch id simply continues from it (any row id works).
    const mid = await (await call(datagridInfinite, 'GET', '/items?after=item-7')).text();
    expect(mid).toContain('>item-8<');
    expect(mid).toContain(`data-hx-get="${API}/items?after=item-12"`);
  });

  it('answers a plain navigation with a full page window', async () => {
    const response = await call(datagridInfinite, 'GET', '/items?after=item-5', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('6–10 of 15');
    expect(body).toContain(`href="${API}/items?after=item-10"`);
  });

  it('ignores other paths and methods', async () => {
    expect(await call(datagridInfinite, 'POST', '/items')).toBeNull();
    expect(await call(datagridInfinite, 'GET', '/other')).toBeNull();
  });
});
