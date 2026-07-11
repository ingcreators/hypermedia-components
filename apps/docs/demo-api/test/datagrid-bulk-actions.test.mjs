import { describe, expect, it } from 'vitest';
import * as bulkActions from '../recipes/datagrid-bulk-actions.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/datagrid-bulk-actions';

const toast = (response) => {
  const header = response.headers.get('HX-Trigger');
  return JSON.parse(header)['hc:toast'];
};
const countRows = (body) => (body.match(/<tr class="hc-datagrid__row">/g) ?? []).length;

describe('datagrid-bulk-actions demo API', () => {
  it('GET /products/rows returns the six pristine rows for the load trigger', async () => {
    const response = await call(bulkActions, 'GET', '/products/rows?state=');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(countRows(body)).toBe(6);
    expect(body).toContain('name="ids" value="101" aria-label="Select Anvil"');
    expect(body).toContain(
      '<th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">101</th>',
    );
    expect(body.match(/<td class="hc-datagrid__cell">Active<\/td>/g)).toHaveLength(6);
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('GET /products/rows reads the threaded state', async () => {
    const response = await call(
      bulkActions,
      'GET',
      '/products/rows?state=archived%3A102%3Bdeleted%3A105',
    );
    const body = await response.text();
    expect(countRows(body)).toBe(5);
    expect(body).not.toContain('Jet-propelled pogo stick');
    expect(body).toMatch(/value="102"[^]*?<td class="hc-datagrid__cell">Archived<\/td>/);
  });

  it('archive two ids → Archived rows + success toast + updated OOB state', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['102', '104'], action: 'archive', state: '' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(countRows(body)).toBe(6);
    expect(body.match(/<td class="hc-datagrid__cell">Archived<\/td>/g)).toHaveLength(2);
    expect(body).toContain(
      '<input type="hidden" id="datagrid-bulk-actions-demo-state" name="state" data-hx-swap-oob="true" value="archived:102,104">',
    );
    expect(body).toContain(
      '<p id="datagrid-bulk-actions-demo-rows-status" data-hx-swap-oob="true" aria-live="polite">6 products</p>',
    );
    expect(toast(response)).toEqual({ message: '2 archived', variant: 'success' });
  });

  it('including protected 101 → partial failure: warning toast, 101 untouched', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['101', '102', '103'], action: 'archive', state: '' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(toast(response)).toEqual({ message: '2 archived, 1 failed', variant: 'warning' });
    expect(body).toContain('value="archived:102,103"');
    // Anvil's row stays Active.
    expect(body).toMatch(/value="101"[^]*?<td class="hc-datagrid__cell">Active<\/td>/);
  });

  it('only 101 selected → "0 archived, 1 failed" warning, state unchanged', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['101'], action: 'delete', state: 'archived:102' }),
    });
    expect(toast(response)).toEqual({ message: '0 deleted, 1 failed', variant: 'warning' });
    const body = await response.text();
    expect(body).toContain('value="archived:102"');
    expect(countRows(body)).toBe(6);
  });

  it('unknown or stale ids only → info "Nothing to do", nothing changes', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['999', '105'], action: 'archive', state: 'deleted:105' }),
    });
    expect(response.status).toBe(200);
    expect(toast(response)).toEqual({ message: 'Nothing to do', variant: 'info' });
    const body = await response.text();
    expect(countRows(body)).toBe(5);
    expect(body).toContain('value="deleted:105"');
  });

  it('empty selection → info "Nothing to do"', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ action: 'archive', state: '' }),
    });
    expect(toast(response)).toEqual({ message: 'Nothing to do', variant: 'info' });
  });

  it('delete removes the rows and drops the status count', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['105', '106'], action: 'delete', state: '' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(countRows(body)).toBe(4);
    expect(body).not.toContain('Jet-propelled pogo stick');
    expect(body).not.toContain('Tornado seeds');
    expect(body).toContain('value="deleted:105,106"');
    expect(body).toContain('>4 products</p>');
    expect(toast(response)).toEqual({ message: '2 deleted', variant: 'success' });
  });

  it('deleting an archived product moves it out of the archived state', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['102'], action: 'delete', state: 'archived:102,104' }),
    });
    const body = await response.text();
    expect(body).toContain('value="archived:104;deleted:102"');
    expect(countRows(body)).toBe(5);
  });

  it('parses garbage state defensively', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      body: form({ ids: ['103'], action: 'archive', state: 'nonsense;;archived:999,abc:1' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('value="archived:103"');
  });

  it('non-htmx POST answers 303 to the products page', async () => {
    const response = await call(bulkActions, 'POST', '/products/bulk', {
      htmx: false,
      body: form({ ids: ['102'], action: 'archive', state: '' }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(`${API}/products`);
  });

  it('GET /products renders the 303 landing page', async () => {
    const response = await call(bulkActions, 'GET', '/products', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('post/redirect/get');
    expect(countRows(body)).toBe(6);
  });

  it('returns null for unknown routes', async () => {
    expect(await call(bulkActions, 'GET', '/products/bulk')).toBeNull();
    expect(await call(bulkActions, 'POST', '/nope')).toBeNull();
  });
});
