import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/field-errors.mjs';
import { call, form } from './helpers.mjs';

function post(fields, opts = {}) {
  return call(mod, 'POST', '/members', { body: form(fields), ...opts });
}

describe('field-errors demo API', () => {
  it('returns 200 + empty body + hc:toast trigger on success (htmx)', async () => {
    const response = await post({ email: 'new@example.com', display_name: 'New' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('Member saved');
    expect(trigger).toContain('success');
  });

  it('answers a blank email with 422 + a required error item', async () => {
    const response = await post({ email: '   ', display_name: 'X' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('role="alert"');
    expect(body).toContain('class="hc-alert__title"');
    expect(body).toContain('data-field="email"');
    expect(body).toContain('data-code="required"');
    expect(body).not.toContain('data-message-key');
  });

  it('answers taken@example.com with 422 + a duplicate item (case-insensitive, with message key)', async () => {
    const response = await post({ email: 'Taken@Example.COM', display_name: 'X' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-field="email"');
    expect(body).toContain('data-code="duplicate"');
    expect(body).toContain('data-message-key="members.email.duplicate"');
  });

  it('reports a no-JS success as a full page, escaping the echoed input', async () => {
    const response = await post(
      { email: 'a@example.com', display_name: '<b>Bee</b>' },
      { htmx: false },
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('a@example.com');
    expect(body).toContain('&lt;b&gt;Bee&lt;/b&gt;');
    expect(body).not.toContain('<b>Bee</b>');
  });

  it('reports a no-JS failure as a 422 full page with the fragment inline', async () => {
    const response = await post({ email: '', display_name: '' }, { htmx: false });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('data-code="required"');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/members')).toBeNull();
  });
});
