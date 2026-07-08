import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/inline-edit.mjs';
import { call, form } from './helpers.mjs';

const PREFIX = '/hypermedia-components/api/recipes/inline-edit';

describe('inline-edit demo API', () => {
  it('serves the display fragment with the default value', async () => {
    const response = await call(mod, 'GET', '/items/42/name');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<span id="inline-edit-demo-name">');
    expect(body).toContain('Acme widgets');
    expect(body).toContain(
      `data-hx-get="${PREFIX}/items/42/name/edit?v=Acme%20widgets"`,
    );
    expect(body).toContain('data-hx-target="closest span"');
    expect(body).toContain('data-hx-swap="outerHTML"');
  });

  it('threads a custom ?v= through the display fragment, escaped', async () => {
    const response = await call(
      mod,
      'GET',
      `/items/42/name?v=${encodeURIComponent('<b>&Co')}`,
    );
    const body = await response.text();
    expect(body).toContain('&lt;b&gt;&amp;Co');
    expect(body).not.toContain('<b>&Co');
    expect(body).toContain(`?v=${encodeURIComponent('<b>&Co')}`);
  });

  it('serves the edit fragment echoing ?v= into the input, Cancel and hidden field', async () => {
    const response = await call(
      mod,
      'GET',
      `/items/42/name/edit?v=${encodeURIComponent('Widget Co')}`,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<form');
    expect(body).toContain('id="inline-edit-demo-name"');
    expect(body).toContain(`data-hx-put="${PREFIX}/items/42/name"`);
    expect(body).toContain('data-hx-target="this"');
    expect(body).toContain('name="name"');
    expect(body).toContain('value="Widget Co"');
    expect(body).toContain('<input type="hidden" name="v" value="Widget Co">');
    expect(body).toContain(`data-hx-get="${PREFIX}/items/42/name?v=Widget%20Co"`);
  });

  it('answers a valid PUT with the display fragment carrying the new value', async () => {
    const response = await call(mod, 'PUT', '/items/42/name', {
      body: form({ name: '  New name  ', v: 'Acme widgets' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<span id="inline-edit-demo-name">');
    expect(body).toContain('New name');
    expect(body).toContain(
      `data-hx-get="${PREFIX}/items/42/name/edit?v=New%20name"`,
    );
    expect(body).not.toContain('Acme widgets');
  });

  it('answers a blank PUT with 422 + the invalid edit fragment, Cancel restoring the original value', async () => {
    const response = await call(mod, 'PUT', '/items/42/name', {
      body: form({ name: '   ', v: 'Acme widgets' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('<div class="hc-field" data-invalid="true">');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('aria-describedby="inline-edit-demo-name-error"');
    expect(body).toContain('Name is required.');
    // Cancel (and the hidden v) still point at the ORIGINAL value.
    expect(body).toContain(`data-hx-get="${PREFIX}/items/42/name?v=Acme%20widgets"`);
    expect(body).toContain('<input type="hidden" name="v" value="Acme widgets">');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/items/42/other')).toBeNull();
  });
});
