// Unit coverage for the shared field-error plumbing. installValidation()
// (native constraint validation) and installFieldErrors() (server-sent
// errors) both surface messages through this module — its contract is
// what keeps the two error sources byte-identical instead of drifting.
import { beforeEach, describe, it, expect } from 'vitest';
import {
  fieldOf,
  ensureDescribedBy,
  pruneDescribedBy,
  getOrCreateError,
} from '../src/js/field-error-core.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mountField() {
  document.body.innerHTML = `
    <div class="hc-field">
      <label class="hc-field__label" for="email">Email</label>
      <input class="hc-input" id="email" type="email">
    </div>`;
  return {
    field: document.querySelector('.hc-field'),
    control: document.querySelector('#email'),
  };
}

describe('fieldOf', () => {
  it('resolves the closest .hc-field wrapper', () => {
    const { field, control } = mountField();
    expect(fieldOf(control)).toBe(field);
  });

  it('returns null for a bare control and for null-ish input', () => {
    document.body.innerHTML = '<input id="bare">';
    expect(fieldOf(document.querySelector('#bare'))).toBeNull();
    expect(fieldOf(null)).toBeNull();
    expect(fieldOf(undefined)).toBeNull();
  });
});

describe('ensureDescribedBy', () => {
  it('creates the attribute with the id', () => {
    const { control } = mountField();
    ensureDescribedBy(control, 'err-1');
    expect(control.getAttribute('aria-describedby')).toBe('err-1');
  });

  it('appends to existing tokens without disturbing them', () => {
    const { control } = mountField();
    control.setAttribute('aria-describedby', 'hint-1');
    ensureDescribedBy(control, 'err-1');
    expect(control.getAttribute('aria-describedby')).toBe('hint-1 err-1');
  });

  it('is idempotent — the token is never duplicated', () => {
    const { control } = mountField();
    ensureDescribedBy(control, 'err-1');
    ensureDescribedBy(control, 'err-1');
    expect(control.getAttribute('aria-describedby')).toBe('err-1');
  });
});

describe('pruneDescribedBy', () => {
  it('removes only its own token', () => {
    const { control } = mountField();
    control.setAttribute('aria-describedby', 'hint-1 err-1 hint-2');
    pruneDescribedBy(control, 'err-1');
    expect(control.getAttribute('aria-describedby')).toBe('hint-1 hint-2');
  });

  it('drops the attribute entirely when no tokens remain', () => {
    const { control } = mountField();
    control.setAttribute('aria-describedby', 'err-1');
    pruneDescribedBy(control, 'err-1');
    expect(control.hasAttribute('aria-describedby')).toBe(false);
  });

  it('is a no-op when the token is absent', () => {
    const { control } = mountField();
    control.setAttribute('aria-describedby', 'hint-1');
    pruneDescribedBy(control, 'err-1');
    expect(control.getAttribute('aria-describedby')).toBe('hint-1');
  });
});

describe('getOrCreateError', () => {
  it('creates a .hc-field__error with aria-live and a stable id, wired to the control', () => {
    const { field, control } = mountField();
    const error = getOrCreateError(field, control);
    expect(error.className).toBe('hc-field__error');
    expect(error.getAttribute('aria-live')).toBe('polite');
    expect(error.id).toMatch(/^hc-field-error-\d+$/);
    expect(field.lastElementChild).toBe(error);
    expect(control.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('reuses an existing error element instead of stacking new ones', () => {
    const { field, control } = mountField();
    const first = getOrCreateError(field, control);
    first.textContent = 'Required';
    const second = getOrCreateError(field, control);
    expect(second).toBe(first);
    expect(field.querySelectorAll('.hc-field__error')).toHaveLength(1);
    // describedby stays a single token even across repeat calls.
    expect(control.getAttribute('aria-describedby')).toBe(first.id);
  });

  it('adopts a server-rendered error slot and keeps its id when present', () => {
    const { field, control } = mountField();
    const slot = document.createElement('p');
    slot.className = 'hc-field__error';
    slot.id = 'server-error';
    field.appendChild(slot);
    const error = getOrCreateError(field, control);
    expect(error).toBe(slot);
    expect(error.id).toBe('server-error');
    expect(control.getAttribute('aria-describedby')).toBe('server-error');
  });

  it('assigns unique ids across fields', () => {
    document.body.innerHTML = `
      <div class="hc-field" id="f1"><input id="c1"></div>
      <div class="hc-field" id="f2"><input id="c2"></div>`;
    const e1 = getOrCreateError(document.querySelector('#f1'), document.querySelector('#c1'));
    const e2 = getOrCreateError(document.querySelector('#f2'), document.querySelector('#c2'));
    expect(e1.id).not.toBe(e2.id);
  });
});
