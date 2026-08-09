import { describe, expect, it } from 'vitest';
import * as editConflict from '../recipes/datagrid-edit-conflict.mjs';
import { call, form } from './helpers.mjs';

describe('datagrid-edit-conflict demo API', () => {
  it('a stale version answers the 409 conflict presentation', async () => {
    const response = await call(editConflict, 'PATCH', '/items/1', {
      body: form({ col: 'price', value: '22', version: '3' }),
    });
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).toContain('data-version="4"'); // fresh version
    expect(body).toContain('data-value="20"'); // THEIR value in the cell
    expect(body).toContain('data-attention="error"');
    expect(body).toContain('role="alert"');
    expect(body).toContain('another user saved 20.00');
    expect(body).toContain('Your value: 22');
    // Overwrite re-submits yours against the fresh version, statically.
    expect(body).toContain('data-hx-vals=\'{"col":"price","value":"22","version":"4"}\'');
    expect(body).toContain('Discard mine');
  });

  it('a matching version accepts and increments the version', async () => {
    const response = await call(editConflict, 'PATCH', '/items/1', {
      body: form({ col: 'price', value: '22', version: '4' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-version="5"');
    expect(body).toContain('data-value="22"');
    expect(body).not.toContain('hc-datagrid__error-row');
  });

  it('a matching version with an invalid value takes the 422 branch, version kept', async () => {
    const response = await call(editConflict, 'PATCH', '/items/1', {
      body: form({ col: 'price', value: 'abc', version: '4' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-version="4"');
    expect(body).toContain('data-invalid');
    expect(body).toContain('not a valid price');
  });

  it('GET answers the record plain (the Discard target)', async () => {
    const response = await call(editConflict, 'GET', '/items/1');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-version="4"');
    expect(body).toContain('data-value="20"');
    expect(body).not.toContain('hc-datagrid__error-row');
  });
});
