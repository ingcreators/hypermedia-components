import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installFieldErrors } from '../src/js/field-errors.js';
import { installValidation } from '../src/js/validation.js';
import { setMessages, resetMessages } from '../src/js/i18n.js';

let uninstall = () => {};
let uninstallValidation = () => {};
let restoreMessages = () => {};

const FRAGMENT = `
  <div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors
       data-error-code="TQL-FIELD-4220">
    <p class="hc-alert__title">Unprocessable Entity</p>
    <ul class="hc-alert__errors">
      <li class="hc-alert__error" data-field="email" data-code="duplicate"
          data-message-key="members.email.duplicate">email: duplicate</li>
    </ul>
    <p class="hc-alert__body">hint</p>
  </div>
`;

function renderForm({ extraFields = '', errors = '' } = {}) {
  document.body.innerHTML = `
    <form id="form">
      <div id="errors">${errors}</div>
      <div class="hc-field" id="email-field">
        <label class="hc-field__label" for="email">Email</label>
        <input class="hc-input" id="email" name="email" type="email"
               aria-describedby="email-help">
        <p class="hc-field__message" id="email-help">We never share it.</p>
      </div>
      ${extraFields}
      <button type="submit">Save</button>
    </form>
  `;
}

// Simulate htmx swapping `html` into the container, then announcing it.
function swap(html, containerId = 'errors') {
  const container = document.getElementById(containerId);
  container.innerHTML = html;
  container.dispatchEvent(
    new CustomEvent('htmx:afterSwap', { bubbles: true, detail: {} }),
  );
  return container;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  uninstallValidation();
  uninstallValidation = () => {};
  restoreMessages();
  restoreMessages = () => {};
  resetMessages();
  document.body.innerHTML = '';
});

describe('installFieldErrors', () => {
  it('is idempotent and returns an uninstaller', () => {
    renderForm();
    uninstall = installFieldErrors();
    expect(installFieldErrors()).toBe(uninstall);
  });

  it('distributes a swapped-in fragment to the matching field', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(FRAGMENT);

    const input = document.getElementById('email');
    const field = document.getElementById('email-field');
    const error = field.querySelector('.hc-field__error');

    expect(error).not.toBeNull();
    expect(error.textContent).toBe('email: duplicate');
    expect(error.hasAttribute('data-hc-server-error')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('email-help');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(field.getAttribute('data-invalid')).toBe('true');

    const item = document.querySelector('.hc-alert__error');
    expect(item.getAttribute('data-distributed')).toBe('true');
    expect(document.querySelector('.hc-alert').getAttribute('data-distributed')).toBe('all');
  });

  it('focuses the first invalid control (and data-focus="none" opts out)', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(FRAGMENT);
    expect(document.activeElement).toBe(document.getElementById('email'));

    document.getElementById('email').blur();
    swap(FRAGMENT.replace('data-hc-field-errors', 'data-hc-field-errors data-focus="none"'));
    expect(document.activeElement).not.toBe(document.getElementById('email'));
  });

  it('resolves data-message-key through the i18n catalog, with li text as fallback', () => {
    renderForm();
    uninstall = installFieldErrors();

    // No catalog entry → the li's own text renders.
    swap(FRAGMENT);
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('email: duplicate');

    // Catalog entry wins, with {field}/{code} interpolation available.
    restoreMessages = setMessages({
      'members.email.duplicate': '{field} is already registered ({code})',
    });
    swap(FRAGMENT);
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('email is already registered (duplicate)');
  });

  it('falls back to fieldErrors.unknown for an empty item', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="email"></li>
        </ul>
      </div>
    `);
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('Invalid value');
  });

  it('renders several errors for one field one per line', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="email">Too short</li>
          <li class="hc-alert__error" data-field="email">Already taken</li>
        </ul>
      </div>
    `);
    const error = document.getElementById('email-field').querySelector('.hc-field__error');
    expect(error.textContent).toBe('Too shortAlready taken');
    expect(error.querySelectorAll('br')).toHaveLength(1);
  });

  it('leaves unknown field names visible in the summary and stamps "partial"', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="email">dup</li>
          <li class="hc-alert__error" data-field="nope">global-ish error</li>
        </ul>
      </div>
    `);
    const items = document.querySelectorAll('.hc-alert__error');
    expect(items[0].getAttribute('data-distributed')).toBe('true');
    expect(items[1].hasAttribute('data-distributed')).toBe(false);
    expect(document.querySelector('.hc-alert').getAttribute('data-distributed')).toBe('partial');
  });

  it('resolves radio groups via form.elements to the shared field', () => {
    renderForm({
      extraFields: `
        <fieldset class="hc-field" id="plan-field">
          <legend class="hc-field__label">Plan</legend>
          <label><input type="radio" name="plan" value="a"> A</label>
          <label><input type="radio" name="plan" value="b"> B</label>
        </fieldset>
      `,
    });
    uninstall = installFieldErrors();
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="plan">Pick a plan</li>
        </ul>
      </div>
    `);
    const field = document.getElementById('plan-field');
    expect(field.querySelector('.hc-field__error').textContent).toBe('Pick a plan');
    expect(field.getAttribute('data-invalid')).toBe('true');
    const first = field.querySelector('input[type="radio"]');
    expect(first.getAttribute('aria-invalid')).toBe('true');
  });

  it('creates (and later removes) an error element after a bare control', () => {
    renderForm({ extraFields: '<input name="nickname" id="nickname">' });
    uninstall = installFieldErrors();
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="nickname">Taken</li>
        </ul>
      </div>
    `);
    const input = document.getElementById('nickname');
    const error = input.nextElementSibling;
    expect(error.matches('.hc-field__error[data-hc-server-error-owned]')).toBe(true);
    expect(error.textContent).toBe('Taken');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);

    // Editing the control removes the created element and its wiring.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.nextElementSibling?.matches?.('.hc-field__error') ?? false).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('clears a field\'s server error on first input', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(FRAGMENT);

    const input = document.getElementById('email');
    input.value = 'other@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById('email-field').hasAttribute('data-invalid')).toBe(false);
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('');
    // The help id survives in aria-describedby.
    expect(input.getAttribute('aria-describedby')).toContain('email-help');
  });

  it('clears all server errors on submit and on reset', () => {
    renderForm();
    uninstall = installFieldErrors();

    for (const type of ['submit', 'reset']) {
      swap(FRAGMENT);
      expect(document.getElementById('email').getAttribute('aria-invalid')).toBe('true');
      const event = new Event(type, { bubbles: true, cancelable: true });
      event.preventDefault(); // jsdom would try to "navigate" on submit
      document.getElementById('form').dispatchEvent(event);
      expect(document.getElementById('email').hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('re-distributing a new fragment replaces stale errors', () => {
    renderForm();
    uninstall = installFieldErrors();
    swap(FRAGMENT);
    swap(`
      <div class="hc-alert" data-variant="error" data-hc-field-errors>
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="email">Now a different problem</li>
        </ul>
      </div>
    `);
    const error = document.getElementById('email-field').querySelector('.hc-field__error');
    expect(error.textContent).toBe('Now a different problem');
    expect(document.querySelectorAll('#email-field .hc-field__error')).toHaveLength(1);
  });

  it('targets a form by selector for fragments rendered outside it (OOB)', () => {
    renderForm();
    const outside = document.createElement('div');
    outside.id = 'outside';
    document.body.appendChild(outside);
    uninstall = installFieldErrors();

    outside.innerHTML = `
      <div class="hc-alert" data-variant="error" data-hc-field-errors="#form">
        <ul class="hc-alert__errors">
          <li class="hc-alert__error" data-field="email">dup</li>
        </ul>
      </div>
    `;
    outside.dispatchEvent(new CustomEvent('htmx:oobAfterSwap', { bubbles: true }));

    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('dup');
  });

  it('is a no-op (summary stays intact) when no form is found', () => {
    document.body.innerHTML = '<div id="errors"></div>';
    uninstall = installFieldErrors();
    swap(FRAGMENT);
    const alert = document.querySelector('.hc-alert');
    expect(alert.getAttribute('data-distributed')).toBe('none');
    expect(document.querySelector('.hc-alert__error').hasAttribute('data-distributed')).toBe(false);
  });

  it('distributes a fragment present at install time (full-page render)', () => {
    renderForm({ errors: FRAGMENT });
    uninstall = installFieldErrors();
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('email: duplicate');
  });

  it('picks up fragments inserted without an htmx event (MutationObserver)', async () => {
    renderForm();
    uninstall = installFieldErrors();
    document.getElementById('errors').innerHTML = FRAGMENT;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      document.getElementById('email-field').querySelector('.hc-field__error').textContent,
    ).toBe('email: duplicate');
  });

  it('does nothing after uninstall', () => {
    renderForm();
    uninstall = installFieldErrors();
    uninstall();
    uninstall = () => {};
    swap(FRAGMENT);
    expect(document.getElementById('email').hasAttribute('aria-invalid')).toBe(false);
  });

  describe('interplay with installValidation', () => {
    it('blur on a natively-valid but server-invalid control keeps the server error', () => {
      renderForm();
      uninstallValidation = installValidation();
      uninstall = installFieldErrors();
      swap(FRAGMENT);

      const input = document.getElementById('email');
      input.value = ''; // empty, not required → natively valid
      input.dispatchEvent(new Event('blur', { bubbles: false }));

      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(
        document.getElementById('email-field').querySelector('.hc-field__error').textContent,
      ).toBe('email: duplicate');
    });

    it('a native constraint error supersedes the server error', () => {
      renderForm();
      uninstallValidation = installValidation();
      uninstall = installFieldErrors();
      swap(FRAGMENT);

      const input = document.getElementById('email');
      input.value = 'not-an-email';
      // jsdom fires no `invalid` event on its own — simulate the browser:
      // checkValidity() dispatches `invalid` for an invalid control.
      input.dispatchEvent(new Event('input', { bubbles: true })); // clears server error
      input.checkValidity();

      const error = document.getElementById('email-field').querySelector('.hc-field__error');
      expect(input.dataset.hcServerInvalid).toBeUndefined();
      expect(error.textContent).toBe(input.validationMessage);
    });
  });
});
