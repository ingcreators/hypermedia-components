import { describe, expect, it } from 'vitest';
import * as multiStepForm from '../recipes/multi-step-form.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/multi-step-form';

describe('multi-step-form demo API', () => {
  it('GET /signup/1 renders the step-1 wizard fragment', async () => {
    const response = await call(multiStepForm, 'GET', '/signup/1');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<section id="multi-step-form-demo-wizard">');
    expect(body).toContain('aria-current="step"');
    expect(body).toContain(`data-hx-post="${API}/signup/1"`);
    expect(body).toContain('data-hx-target="#multi-step-form-demo-wizard"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('<div id="multi-step-form-demo-wizard-errors"></div>');
    expect(body).toContain('name="email"');
    // Step 1 has no Back button and no completed steps.
    expect(body).not.toContain('value="back"');
    expect(body).not.toContain('data-state="complete"');
    expect(body).not.toContain('<!doctype');
  });

  it('GET /signup/2 without HX-Request wraps the fragment in a full page', async () => {
    const response = await call(multiStepForm, 'GET', '/signup/2?email=ada%40example.com', {
      htmx: false,
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<section id="multi-step-form-demo-wizard">');
    expect(body).toContain('value="ada@example.com"'); // hidden draft from the deep link
  });

  it('valid next renders the following step carrying the draft as hidden inputs', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/1', {
      body: form({ email: 'ada@example.com', nav: 'next' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    // Step 2 form, stepper shows step 1 completed.
    expect(body).toContain(`data-hx-post="${API}/signup/2"`);
    expect(body).toContain('data-state="complete"');
    expect(body).toContain('aria-hidden="true">✓</span>');
    expect(body).toContain('hc-sr-only">(completed)');
    // The accumulated draft rides as a hidden input.
    expect(body).toContain('<input type="hidden" name="email" value="ada@example.com">');
    expect(body).toContain('name="display_name"');
  });

  it('back never validates and keeps in-flight values in the draft', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/2', {
      // display_name is required on step 2, but back must not care.
      body: form({ email: 'ada@example.com', display_name: 'Ada', nav: 'back' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    // Back to step 1, email pre-filled as a real input…
    expect(body).toContain(`data-hx-post="${API}/signup/1"`);
    expect(body).toContain('name="email" value="ada@example.com"');
    // …and the in-flight step-2 value preserved as a hidden input.
    expect(body).toContain('<input type="hidden" name="display_name" value="Ada">');
  });

  it('back with a blank required field still succeeds', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/2', {
      body: form({ email: 'ada@example.com', display_name: '', nav: 'back' }),
    });
    expect(response.status).toBe(200);
  });

  it('invalid next answers 422 steered into the error container, step not re-rendered', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/1', {
      body: form({ email: '', nav: 'next' }),
    });
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe('#multi-step-form-demo-wizard-errors');
    expect(response.headers.get('HX-Reswap')).toBe('innerHTML');
    const body = await response.text();
    // The canonical field-errors fragment ONLY.
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('data-field="email"');
    expect(body).toContain('data-code="required"');
    expect(body).not.toContain('<section');
    expect(body).not.toContain('<form');
  });

  it('escapes user-derived draft values in hidden inputs', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/1', {
      body: form({ email: '"<b>x</b>"@example.com', nav: 'next' }),
    });
    const body = await response.text();
    expect(body).toContain('&quot;&lt;b&gt;x&lt;/b&gt;&quot;@example.com');
    expect(body).not.toContain('<b>x</b>');
  });

  it('final valid next redirects: 204 + HX-Redirect for htmx', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/3', {
      body: form({ email: 'ada@example.com', display_name: 'Ada', nav: 'next' }),
    });
    expect(response.status).toBe(204);
    const location = response.headers.get('HX-Redirect');
    expect(location).toContain(`${API}/welcome?`);
    expect(location).toContain('email=ada%40example.com');
    expect(location).toContain('display_name=Ada');
  });

  it('final valid next redirects: 303 + Location without HX-Request', async () => {
    const response = await call(multiStepForm, 'POST', '/signup/3', {
      htmx: false,
      body: form({ email: 'ada@example.com', display_name: 'Ada', nav: 'next' }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toContain(`${API}/welcome?email=ada%40example.com`);
  });

  it('GET /welcome echoes the draft, escaped', async () => {
    const response = await call(
      multiStepForm,
      'GET',
      '/welcome?email=ada%40example.com&display_name=%3Cscript%3E',
      { htmx: false },
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Account created');
    expect(body).toContain('ada@example.com');
    expect(body).toContain('&lt;script&gt;');
    expect(body).not.toContain('<script>');
    expect(body).toContain('/hypermedia-components/recipes/multi-step-form/');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(multiStepForm, 'GET', '/signup/4')).toBeNull();
    expect(await call(multiStepForm, 'GET', '/nope')).toBeNull();
  });
});
