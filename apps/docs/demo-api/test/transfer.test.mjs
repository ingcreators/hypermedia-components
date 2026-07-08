import { describe, expect, it } from 'vitest';
import * as transfer from '../recipes/transfer.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/transfer';
const URL_FOR = (assigned) => `${API}/roles/42/members?assigned=${assigned}`;

describe('transfer demo API', () => {
  it('GET renders the form fragment for htmx with counts and threaded URLs', async () => {
    const response = await call(transfer, 'GET', '/roles/42/members?assigned=2');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<form class="hc-transfer" id="transfer-demo-members"');
    expect(body).toContain(`action="${URL_FOR('2')}"`);
    expect(body).toContain(`data-hx-post="${URL_FOR('2')}"`);
    expect(body).toContain('data-hx-target="this" data-hx-swap="outerHTML"');
    expect(body).toContain('Available\n      <span class="hc-transfer__count">(4)</span>');
    expect(body).toContain('Assigned\n      <span class="hc-transfer__count">(1)</span>');
    expect(body).toContain('name="assigned" value="2"');
    expect(body).toContain('Alan Turing');
    expect(body).not.toContain('<!doctype');
  });

  it('GET without HX-Request renders the full page (no-JS / PRG landing)', async () => {
    const response = await call(transfer, 'GET', '/roles/42/members?assigned=2', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<form class="hc-transfer"');
  });

  it('add moves checked available ids; the re-rendered form carries the new assigned=', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=2', {
      body: form({ available: ['1', '4'], action: 'add' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`data-hx-post="${URL_FOR('1,2,4')}"`);
    expect(body).toContain(`action="${URL_FOR('1,2,4')}"`);
    expect(body).toContain('Assigned\n      <span class="hc-transfer__count">(3)</span>');
    expect(body).toContain('Available\n      <span class="hc-transfer__count">(2)</span>');
    expect(body).toContain('name="assigned" value="1"');
    expect(body).toContain('name="assigned" value="4"');
    // All checkboxes come back unchecked.
    expect(body).not.toContain(' checked');
  });

  it('remove moves checked assigned ids back to available', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=1,2,4', {
      body: form({ assigned: ['2'], action: 'remove' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`data-hx-post="${URL_FOR('1,4')}"`);
    expect(body).toContain('name="available" value="2"');
    expect(body).toContain('Assigned\n      <span class="hc-transfer__count">(2)</span>');
  });

  it('is idempotent per id: re-adding an already-assigned id is a no-op', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=2', {
      body: form({ available: ['2', '2'], action: 'add' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`data-hx-post="${URL_FOR('2')}"`);
    expect(body).toContain('Assigned\n      <span class="hc-transfer__count">(1)</span>');
  });

  it('ignores ids checked in the pane that does not match the verb', async () => {
    // Only the OTHER pane is checked → nothing relevant → 422.
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=2', {
      body: form({ assigned: ['2'], action: 'add' }),
    });
    expect(response.status).toBe(422);
  });

  it('empty selection answers 422 with the inline alert, membership unchanged', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=2', {
      body: form({ action: 'remove' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('<div class="hc-alert" data-variant="error" role="alert"');
    expect(body).toContain('Select at least one member to move.');
    expect(body).toContain(`data-hx-post="${URL_FOR('2')}"`);
    expect(body).toContain('Assigned\n      <span class="hc-transfer__count">(1)</span>');
  });

  it('non-htmx POST answers 303 with the PRG Location onto the new membership', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=2', {
      htmx: false,
      body: form({ available: ['3'], action: 'add' }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(URL_FOR('2,3'));
  });

  it('ignores unknown ids and sorts numerically', async () => {
    const response = await call(transfer, 'POST', '/roles/42/members?assigned=4', {
      body: form({ available: ['99', '1'], action: 'add' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`data-hx-post="${URL_FOR('1,4')}"`);
  });

  it('returns null for unknown routes', async () => {
    expect(await call(transfer, 'GET', '/roles/42/nope')).toBeNull();
  });
});
