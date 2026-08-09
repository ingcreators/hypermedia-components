import { describe, expect, it } from 'vitest';
import * as editErrors from '../recipes/datagrid-edit-errors.mjs';
import { call, form } from './helpers.mjs';

describe('datagrid-edit-errors demo API', () => {
  it('accepts a valid value and answers the record with the server formatting', async () => {
    const response = await call(editErrors, 'PATCH', '/items/1', {
      body: form({ col: 'price', value: '25' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('hc-datagrid__record');
    expect(body).toContain('data-value="25">25.00');
    expect(body).not.toContain('data-invalid');
    expect(body).not.toContain('hc-datagrid__error-row');
  });

  it('rejects a non-number with 422 — server value restored, cell marked, message names the input', async () => {
    const response = await call(editErrors, 'PATCH', '/items/1', {
      body: form({ col: 'price', value: 'abc' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-value="18"'); // the server's value, not "abc"
    expect(body).toContain('>18.00</td>');
    expect(body).toContain('data-invalid');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('aria-describedby="edit-errors-demo-1-error"');
    expect(body).toContain('role="alert"');
    expect(body).toContain('&quot;abc&quot; is not a number');
  });

  it('rejects an out-of-range value with 422', async () => {
    const response = await call(editErrors, 'PATCH', '/items/2', {
      body: form({ col: 'price', value: '-4' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('must be greater than 0');
    expect(body).toContain('data-value="19"');
    expect(body).toContain('>19.00</td>');
  });

  it('404s an unknown row or column', async () => {
    expect((await call(editErrors, 'PATCH', '/items/99', { body: form({ col: 'price', value: '1' }) })).status).toBe(404);
    expect((await call(editErrors, 'PATCH', '/items/1', { body: form({ col: 'name', value: 'x' }) })).status).toBe(404);
  });
});
