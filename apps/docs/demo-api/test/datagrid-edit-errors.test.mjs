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
    expect(body).toContain('aria-describedby="edit-errors-demo-1-note"');
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

  it('a future ship date comes back as a proposal, not a commit', async () => {
    const response = await call(editErrors, 'PATCH', '/items/1', {
      body: form({ col: 'ship', value: '2099-01-01' }),
    });
    // Nothing failed and nothing was rejected — the server is asking.
    expect(response.status).toBe(200);
    const body = await response.text();
    // The PROPOSED value is shown (the user cannot confirm what they
    // cannot see), marked as needing them rather than as saved.
    expect(body).toContain('data-value="2099-01-01"');
    expect(body).toContain('data-attention="warning"');
    // …and it is NOT a spinner: nothing is in flight.
    expect(body).not.toContain('data-pending');
    expect(body).toContain('is in the future');
    expect(body).toContain('Confirm');
    expect(body).toContain('Cancel');
  });

  it('confirming with the bound token commits the value', async () => {
    const proposal = await (
      await call(editErrors, 'PATCH', '/items/1', {
        body: form({ col: 'ship', value: '2099-01-01' }),
      })
    ).text();
    const token = /&quot;confirm&quot;:&quot;([a-z0-9]+)&quot;/.exec(proposal)?.[1];
    expect(token).toBeTruthy();

    const response = await call(editErrors, 'PATCH', '/items/1', {
      body: form({ col: 'ship', value: '2099-01-01', confirm: token }),
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('data-value="2099-01-01"');
    expect(body).not.toContain('data-attention');
    expect(body).not.toContain('hc-datagrid__error-row');
  });

  it('a token issued for one value cannot commit another', async () => {
    const proposal = await (
      await call(editErrors, 'PATCH', '/items/1', {
        body: form({ col: 'ship', value: '2099-01-01' }),
      })
    ).text();
    const token = /&quot;confirm&quot;:&quot;([a-z0-9]+)&quot;/.exec(proposal)[1];

    // Same token, different date: the binding must refuse to commit.
    const body = await (
      await call(editErrors, 'PATCH', '/items/1', {
        body: form({ col: 'ship', value: '2098-05-05', confirm: token }),
      })
    ).text();
    expect(body).toContain('data-attention="warning"'); // asked again
  });

  it('a past ship date needs no confirmation', async () => {
    const body = await (
      await call(editErrors, 'PATCH', '/items/2', {
        body: form({ col: 'ship', value: '2020-01-01' }),
      })
    ).text();
    expect(body).toContain('data-value="2020-01-01"');
    expect(body).not.toContain('data-attention');
  });

  it('GET restores the stored record — what Cancel asks for', async () => {
    const body = await (await call(editErrors, 'GET', '/items/1')).text();
    expect(body).toContain('data-value="2026-08-01"');
    expect(body).not.toContain('data-attention');
    expect(body).not.toContain('hc-datagrid__error-row');
  });

  it('404s an unknown row or column', async () => {
    expect((await call(editErrors, 'PATCH', '/items/99', { body: form({ col: 'price', value: '1' }) })).status).toBe(404);
    expect((await call(editErrors, 'PATCH', '/items/1', { body: form({ col: 'name', value: 'x' }) })).status).toBe(404);
  });
});
