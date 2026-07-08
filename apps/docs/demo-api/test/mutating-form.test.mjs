import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/mutating-form.mjs';
import { call, form } from './helpers.mjs';

const LANDING = '/hypermedia-components/api/recipes/mutating-form/members/42';

function post(fields, opts = {}) {
  return call(mod, 'POST', '/members', { body: form(fields), ...opts });
}

describe('mutating-form demo API', () => {
  it('answers an htmx success with 204 + HX-Redirect to the landing page', async () => {
    const response = await post({ email: 'new@example.com', display_name: 'New' });
    expect(response.status).toBe(204);
    expect(response.headers.get('HX-Redirect')).toBe(
      `${LANDING}?email=new%40example.com`,
    );
    expect(response.body).toBeNull();
  });

  it('answers a no-JS success with 303 + Location (post/redirect/get)', async () => {
    const response = await post(
      { email: 'new@example.com', display_name: 'New' },
      { htmx: false },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      `${LANDING}?email=new%40example.com`,
    );
  });

  it('answers a blank email with 422 + the field-errors fragment', async () => {
    const response = await post({ email: '', display_name: 'X' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('Please fix the errors below.');
    expect(body).toContain('data-field="email"');
    expect(body).toContain('data-code="required"');
    expect(body).not.toContain('<!doctype');
  });

  it('answers a duplicate email with 422 + the duplicate item and message key', async () => {
    const response = await post({ email: 'TAKEN@example.com', display_name: 'X' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-code="duplicate"');
    expect(body).toContain('data-message-key="members.email.duplicate"');
  });

  it('reports a no-JS failure as a 422 full page with the fragment inline', async () => {
    const response = await post({ email: '' }, { htmx: false });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('data-hc-field-errors');
  });

  it('serves the landing page, echoing the redirected email escaped', async () => {
    const response = await call(
      mod,
      'GET',
      `/members/42?email=${encodeURIComponent('<i>x</i>@example.com')}`,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('Member created');
    expect(body).toContain('&lt;i&gt;x&lt;/i&gt;@example.com');
    expect(body).not.toContain('<i>x</i>');
    expect(body).toContain('/hypermedia-components/recipes/mutating-form/');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'POST', '/members/42/delete', { body: form({}) })).toBeNull();
  });
});
