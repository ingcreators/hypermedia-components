import { describe, expect, it } from 'vitest';
import * as datagridColumns from '../recipes/datagrid-columns.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/datagrid-columns';

describe('datagrid-columns demo API', () => {
  it('renders the default set (all four columns) when cols is absent', async () => {
    const response = await call(datagridColumns, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    for (const label of ['Name', 'Status', 'Owner', 'Updated']) {
      expect(body).toContain(`scope="col">${label}</th>`);
    }
    expect(body).toContain('Ingest pipeline');
    expect(body).toContain('2026-08-05');
    // The chooser's fieldset rides along out-of-band, every box checked
    // (never the form — it carries the close-popover attribute).
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain(`id="datagrid-columns-demo-fields"`);
    expect(body).not.toContain('<form');
    const checked = body.match(/ checked>/g)?.length ?? 0;
    expect(checked).toBe(4);
  });

  it('renders exactly the requested columns with matching checked states', async () => {
    const body = await (
      await call(datagridColumns, 'GET', '/items?cols=name&cols=status')
    ).text();
    expect(body).toContain('scope="col">Name</th>');
    expect(body).toContain('scope="col">Status</th>');
    expect(body).not.toContain('scope="col">Owner</th>');
    expect(body).not.toContain('scope="col">Updated</th>');
    expect(body).not.toContain('Ada'); // owner cells gone with the column
    expect(body).toContain('value="name" checked');
    expect(body).toContain('value="status" checked');
    expect(body).not.toContain('value="owner" checked');
    expect(body).not.toContain('value="updated" checked');
  });

  it('renders the server canonical order regardless of the requested order', async () => {
    const body = await (
      await call(datagridColumns, 'GET', '/items?cols=updated&cols=name')
    ).text();
    const name = body.indexOf('scope="col">Name</th>');
    const updated = body.indexOf('scope="col">Updated</th>');
    expect(name).toBeGreaterThan(-1);
    expect(updated).toBeGreaterThan(-1);
    expect(name).toBeLessThan(updated);
  });

  it('ignores unknown col names — the server is the schema', async () => {
    const body = await (
      await call(datagridColumns, 'GET', '/items?cols=name&cols=salary')
    ).text();
    expect(body).toContain('scope="col">Name</th>');
    expect(body).not.toContain('salary');
    const headcells = body.match(/hc-datagrid__headcell/g)?.length ?? 0;
    expect(headcells).toBe(1);
  });

  it('falls back to the default set when nothing recognized remains', async () => {
    const body = await (
      await call(datagridColumns, 'GET', '/items?cols=salary&cols=bogus')
    ).text();
    const headcells = body.match(/hc-datagrid__headcell/g)?.length ?? 0;
    expect(headcells).toBe(4);
  });

  it('answers a plain navigation with a full page (no-JS Apply)', async () => {
    const response = await call(datagridColumns, 'GET', '/items?cols=name', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain(`action="${API}/items"`);
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(datagridColumns, 'POST', '/items')).toBeNull();
    expect(await call(datagridColumns, 'GET', '/other')).toBeNull();
  });
});
