import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/remote-dialog.mjs';
import { call, form } from './helpers.mjs';

describe('remote-dialog demo API', () => {
  it('returns a complete not-open dialog fragment on GET', async () => {
    const response = await call(mod, 'GET', '/items/123/edit');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('<dialog class="hc-dialog">');
    expect(body).not.toContain('<dialog class="hc-dialog" open');
    expect(body).not.toContain('<!doctype');
    // Header + title
    expect(body).toContain('hc-dialog__header');
    expect(body).toContain('<h2 class="hc-dialog__title">Edit item</h2>');
    // The edit form posts back through the docs base and closes on 2xx
    expect(body).toContain('id="remote-dialog-demo-edit-form"');
    expect(body).toContain(
      'data-hx-post="/hypermedia-components/api/recipes/remote-dialog/items/123"',
    );
    expect(body).toContain('data-hx-target="closest dialog"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('data-hc-close-dialog-on-success');
    // The field
    expect(body).toContain('name="name"');
    expect(body).toContain('value="Acme widgets"');
    // Native Cancel + Save via the form attribute (forms cannot nest)
    expect(body).toContain('<form method="dialog"><button class="hc-button">Cancel</button></form>');
    expect(body).toContain('form="remote-dialog-demo-edit-form"');
    // Pristine dialog carries no error state
    expect(body).not.toContain('data-invalid');
    expect(body).not.toContain('aria-invalid');
  });

  it('answers a plain GET (no-JS fallback) with an explanatory page', async () => {
    const response = await call(mod, 'GET', '/items/123/edit', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('data-hc-remote-dialog-root');
  });

  it('answers a valid POST with 200, empty body, and an escaped toast header', async () => {
    const response = await call(mod, 'POST', '/items/123', {
      body: form({ name: 'Acme ウィジェット' }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('saved');
    expect(trigger).toContain('"variant":"success"');
    // Non-ASCII item names must ride the header as \uXXXX escapes
    expect(trigger).toContain('\\u30a6');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('names the saved item in the toast', async () => {
    const response = await call(mod, 'POST', '/items/123', {
      body: form({ name: 'Anvil' }),
    });
    expect(response.headers.get('HX-Trigger')).toContain('\\"Anvil\\" saved');
  });

  it('answers a blank-name POST with 422 and the dialog in its error state', async () => {
    const response = await call(mod, 'POST', '/items/123', {
      body: form({ name: '   ' }),
    });
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Trigger')).toBeNull();
    const body = await response.text();
    // The whole dialog again (target is `closest dialog` + outerHTML)
    expect(body).toContain('<dialog class="hc-dialog">');
    expect(body).toContain('data-hc-close-dialog-on-success');
    // Field error state
    expect(body).toContain('data-invalid="true"');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('aria-describedby="remote-dialog-demo-name-error"');
    expect(body).toContain('Name is required.');
    expect(body).toContain('value=""');
  });

  it('answers a blank-name plain POST (no-JS fallback) with a 422 page', async () => {
    const response = await call(mod, 'POST', '/items/123', {
      htmx: false,
      body: form({ name: '' }),
    });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('<!doctype html>');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/items/999/edit')).toBeNull();
    expect(await call(mod, 'POST', '/items/999')).toBeNull();
    expect(await call(mod, 'DELETE', '/items/123')).toBeNull();
  });
});
