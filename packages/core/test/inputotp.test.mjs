import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installInputOtp } from '../src/js/inputotp.js';

let uninstall = () => {};

const FIXTURE = `
  <div class="hc-inputotp" data-length="6">
    <input class="hc-inputotp__input" type="text" name="otp" aria-label="One-time code">
  </div>
`;

function host() {
  return document.querySelector('.hc-inputotp');
}
function field() {
  return document.querySelector('.hc-inputotp__input');
}
function slots() {
  return [...document.querySelectorAll('.hc-inputotp__slot')];
}
function type(value, caret) {
  const input = field();
  input.value = value;
  if (caret != null) {
    try { input.setSelectionRange(caret, caret); } catch { /* ignore */ }
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installInputOtp', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installInputOtp();
    const u2 = installInputOtp();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('renders data-length slots and sets maxlength', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    expect(slots()).toHaveLength(6);
    expect(field().getAttribute('maxlength')).toBe('6');
  });

  it('honours a custom data-length', () => {
    document.body.innerHTML = FIXTURE.replace('data-length="6"', 'data-length="4"');
    uninstall = installInputOtp();
    expect(slots()).toHaveLength(4);
    expect(field().getAttribute('maxlength')).toBe('4');
  });

  it('defaults inputmode / autocomplete for OTP autofill', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    expect(field().getAttribute('inputmode')).toBe('numeric');
    expect(field().getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('mirrors typed characters into the slots', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    type('12');
    expect(slots().map((s) => s.textContent)).toEqual(['1', '2', '', '', '', '']);
    expect(slots()[2].hasAttribute('data-empty')).toBe(true);
    expect(slots()[0].hasAttribute('data-empty')).toBe(false);
  });

  it('strips characters that do not match the pattern (numeric by default)', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    type('1a2b3');
    expect(field().value).toBe('123');
    expect(slots().map((s) => s.textContent)).toEqual(['1', '2', '3', '', '', '']);
  });

  it('respects a custom data-pattern (alphanumeric)', () => {
    document.body.innerHTML = FIXTURE.replace('data-length="6"', 'data-length="6" data-pattern="[0-9a-z]"');
    uninstall = installInputOtp();
    type('a1-b2');
    expect(field().value).toBe('a1b2');
  });

  it('marks the active (caret) slot only while focused', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    const input = field();
    input.focus();
    type('12', 2);
    expect(slots()[2].hasAttribute('data-active')).toBe(true); // next empty
    expect(slots()[2].hasAttribute('data-empty')).toBe(true);
    input.blur();
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(slots().some((s) => s.hasAttribute('data-active'))).toBe(false);
  });

  it('dispatches hc:otpchange on every edit and hc:otpcomplete when full', () => {
    document.body.innerHTML = FIXTURE.replace('data-length="6"', 'data-length="4"');
    uninstall = installInputOtp();
    const change = vi.fn();
    const complete = vi.fn();
    host().addEventListener('hc:otpchange', (e) => change(e.detail.value));
    host().addEventListener('hc:otpcomplete', (e) => complete(e.detail.value));

    type('12');
    expect(change).toHaveBeenLastCalledWith('12');
    expect(complete).not.toHaveBeenCalled();

    type('1234');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenLastCalledWith('1234');
  });

  it('seeds slots from a pre-filled value on install', () => {
    document.body.innerHTML = `
      <div class="hc-inputotp" data-length="6">
        <input class="hc-inputotp__input" type="text" value="42x" aria-label="Code">
      </div>`;
    uninstall = installInputOtp();
    expect(field().value).toBe('42'); // 'x' stripped
    expect(slots().map((s) => s.textContent)).toEqual(['4', '2', '', '', '', '']);
  });

  it('uninstall removes slots and stops mirroring', () => {
    document.body.innerHTML = FIXTURE;
    const u = installInputOtp();
    u();
    expect(slots()).toHaveLength(0);
    const change = vi.fn();
    host().addEventListener('hc:otpchange', change);
    type('12');
    expect(change).not.toHaveBeenCalled();
  });

  it('picks up an inputotp added to the DOM after install (MutationObserver)', async () => {
    uninstall = installInputOtp();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect(slots()).toHaveLength(6);
  });
});
