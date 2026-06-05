import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installValidation } from '../src/js/validation.js';

let uninstall = () => {};

const FIELD = `
  <form>
    <div class="hc-field">
      <label class="hc-field__label" for="email">Email</label>
      <input class="hc-input" id="email" type="email" required
             aria-describedby="email-help">
      <p class="hc-field__message" id="email-help">We never share it.</p>
    </div>
  </form>
`;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function blur(el) {
  el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
}
function input(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('installValidation', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIELD;
    const u1 = installValidation();
    const u2 = installValidation();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('renders the native message + ARIA when a required field is left empty', () => {
    document.body.innerHTML = FIELD;
    uninstall = installValidation();
    const inputEl = document.getElementById('email');
    const field = inputEl.closest('.hc-field');

    blur(inputEl); // empty + required → invalid

    expect(field.getAttribute('data-invalid')).toBe('true');
    expect(inputEl.getAttribute('aria-invalid')).toBe('true');
    const error = field.querySelector('.hc-field__error');
    expect(error).not.toBeNull();
    expect(error.textContent.length).toBeGreaterThan(0);
    expect(error.getAttribute('aria-live')).toBe('polite');
  });

  it('points the control aria-describedby at the error, preserving existing ids', () => {
    document.body.innerHTML = FIELD;
    uninstall = installValidation();
    const inputEl = document.getElementById('email');
    blur(inputEl);
    const error = inputEl.closest('.hc-field').querySelector('.hc-field__error');
    const ids = inputEl.getAttribute('aria-describedby').split(/\s+/);
    expect(ids).toContain('email-help'); // existing help kept
    expect(ids).toContain(error.id); // error appended
  });

  it('clears the error live once the control becomes valid', () => {
    document.body.innerHTML = FIELD;
    uninstall = installValidation();
    const inputEl = document.getElementById('email');
    const field = inputEl.closest('.hc-field');

    blur(inputEl);
    expect(field.getAttribute('data-invalid')).toBe('true');

    inputEl.value = 'a@b.com';
    input(inputEl); // now valid → live clear

    expect(field.hasAttribute('data-invalid')).toBe(false);
    expect(inputEl.hasAttribute('aria-invalid')).toBe(false);
    expect(field.querySelector('.hc-field__error').textContent).toBe('');
  });

  it('does not validate before the first interaction (input is ignored until validated once)', () => {
    document.body.innerHTML = FIELD;
    uninstall = installValidation();
    const inputEl = document.getElementById('email');
    const field = inputEl.closest('.hc-field');

    inputEl.value = 'not-an-email';
    input(inputEl); // never blurred → should stay quiet

    expect(field.hasAttribute('data-invalid')).toBe(false);
  });

  it('suppresses the native bubble on the invalid event', () => {
    document.body.innerHTML = FIELD;
    uninstall = installValidation();
    const inputEl = document.getElementById('email');
    const evt = new Event('invalid', { cancelable: true, bubbles: false });
    inputEl.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('reuses an author-provided .hc-field__error element', () => {
    document.body.innerHTML = `
      <div class="hc-field">
        <label class="hc-field__label" for="n">Name</label>
        <input class="hc-input" id="n" required>
        <p class="hc-field__error" id="n-err"></p>
      </div>`;
    uninstall = installValidation();
    const inputEl = document.getElementById('n');
    blur(inputEl);
    const errors = inputEl.closest('.hc-field').querySelectorAll('.hc-field__error');
    expect(errors.length).toBe(1); // did not create a second one
    expect(errors[0].id).toBe('n-err');
    expect(inputEl.getAttribute('aria-describedby')).toContain('n-err');
  });

  it('ignores controls outside an .hc-field', () => {
    document.body.innerHTML = `<input class="hc-input" id="loose" required>`;
    uninstall = installValidation();
    const inputEl = document.getElementById('loose');
    blur(inputEl);
    expect(inputEl.hasAttribute('aria-invalid')).toBe(false);
  });
});
