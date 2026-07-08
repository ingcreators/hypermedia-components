import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/undo-delete.mjs';
import { GRACE_MS } from '../recipes/undo-delete.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/undo-delete';

describe('undo-delete demo API', () => {
  it('returns the three rows with plain (unconfirmed) delete buttons', async () => {
    const response = await call(mod, 'GET', '/items');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    for (const [id, name] of [[1, 'Anvil'], [2, 'Sprocket'], [3, 'Widget']]) {
      expect(body).toContain(`<tr id="undo-delete-demo-item-${id}">`);
      expect(body).toContain(`<td>${name}</td>`);
      expect(body).toContain(`data-hx-delete="${API}/items/${id}"`);
    }
    expect(body).toContain('data-hx-target="closest tr"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('data-hx-disabled-elt="this"');
    // Undo and confirm must never stack (contract §Choosing undo vs confirm)
    expect(body).not.toContain('data-hc-confirm');
    expect(body).not.toContain('<!doctype');
  });

  it('answers a plain GET (no-JS fallback) with a full page', async () => {
    const response = await call(mod, 'GET', '/items', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<td>Anvil</td>');
  });

  it('answers DELETE with the tombstone and the undo toast', async () => {
    const before = Date.now();
    const response = await call(mod, 'DELETE', '/items/1');
    const after = Date.now();
    expect(response.status).toBe(200);
    const body = await response.text();

    // Tombstone: hidden, same id, carries the restore wiring with a
    // deletedAt timestamp minted now.
    expect(body).toContain('<tr id="undo-delete-demo-item-1" hidden');
    const restoreUrl = body.match(/data-hx-post="([^"]+)"/)?.[1];
    expect(restoreUrl).toBeDefined();
    expect(restoreUrl).toContain(`${API}/items/1/restore?deletedAt=`);
    const deletedAt = Number(new URL(restoreUrl, 'http://demo.test').searchParams.get('deletedAt'));
    expect(deletedAt).toBeGreaterThanOrEqual(before);
    expect(deletedAt).toBeLessThanOrEqual(after);
    expect(body).toContain(
      'data-hx-trigger="undo-delete-demo-item-1:restore from:body"',
    );
    expect(body).toContain('data-hx-swap="outerHTML"');

    // Toast: update-in-place id, Undo action whose event matches the
    // tombstone's trigger (the pairing key, in exactly two places).
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
    const toast = JSON.parse(trigger)['hc:toast'];
    expect(toast.id).toBe('undo-delete-demo-item-1');
    expect(toast.message).toBe('"Anvil" deleted');
    expect(toast.variant).toBe('info');
    expect(toast.duration).toBe(10000);
    expect(toast.action).toEqual({
      label: 'Undo',
      event: 'undo-delete-demo-item-1:restore',
    });
  });

  it('answers DELETE on an unknown id with 404', async () => {
    const response = await call(mod, 'DELETE', '/items/99');
    expect(response.status).toBe(404);
  });

  it('restores within the grace period: the row + a success toast', async () => {
    const response = await call(
      mod,
      'POST',
      `/items/2/restore?deletedAt=${Date.now()}`,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<tr id="undo-delete-demo-item-2"><td>Sprocket</td>');
    expect(body).toContain(`data-hx-delete="${API}/items/2"`);
    expect(body).not.toContain('hidden');
    const toast = JSON.parse(response.headers.get('HX-Trigger'))['hc:toast'];
    expect(toast).toEqual({
      id: 'undo-delete-demo-item-2',
      message: '"Sprocket" restored',
      variant: 'success',
      duration: 3000,
    });
  });

  it('is idempotent: restoring a never-deleted row returns the row', async () => {
    const response = await call(
      mod,
      'POST',
      `/items/3/restore?deletedAt=${Date.now() - 1000}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<td>Widget</td>');
  });

  it('answers an expired restore with 200, the tombstone again, and an error toast', async () => {
    const deletedAt = Date.now() - (GRACE_MS + 1000);
    const response = await call(
      mod,
      'POST',
      `/items/1/restore?deletedAt=${deletedAt}`,
    );
    // 200-with-truth: never a non-2xx (it would not swap)
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<tr id="undo-delete-demo-item-1" hidden');
    // The same deletedAt is threaded through again — the slot stays a tombstone
    expect(body).toContain(`restore?deletedAt=${deletedAt}"`);

    const trigger = response.headers.get('HX-Trigger');
    // The em dash must arrive \u2014-escaped: headers are latin-1
    expect(trigger).toContain('\\u2014');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
    const toast = JSON.parse(trigger)['hc:toast'];
    expect(toast.id).toBe('undo-delete-demo-item-1');
    expect(toast.message).toBe('Too late — "Anvil" was permanently deleted');
    expect(toast.variant).toBe('error');
  });

  it('treats a missing or invalid deletedAt as expired', async () => {
    for (const query of ['', '?deletedAt=bogus'] ) {
      const response = await call(mod, 'POST', `/items/1/restore${query}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('hidden');
      expect(response.headers.get('HX-Trigger')).toContain('Too late');
    }
  });

  it('answers restore on an unknown id with 404', async () => {
    const response = await call(mod, 'POST', '/items/99/restore?deletedAt=0');
    expect(response.status).toBe(404);
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'POST', '/items')).toBeNull();
    expect(call(mod, 'GET', '/items/1')).toBeNull();
    expect(call(mod, 'DELETE', '/items/1/restore')).toBeNull();
  });
});
