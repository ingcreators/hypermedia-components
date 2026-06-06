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

  it('the active slot follows the caret when it moves into the value', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    const input = field();
    input.focus();
    type('1234', 4);
    expect(slots()[4].hasAttribute('data-active')).toBe(true); // next empty

    // Move the caret between slot 1 and 2 (e.g. ArrowLeft); the active slot
    // follows the selection, not just the end.
    input.setSelectionRange(1, 1);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    expect(slots()[1].hasAttribute('data-active')).toBe(true);
    expect(slots()[4].hasAttribute('data-active')).toBe(false);
  });

  it('clicking a filled slot places the caret in it', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    const input = field();
    type('1234');
    // Deterministic slot geometry for the x → index hit-test (jsdom rects are 0).
    slots().forEach((s, i) => {
      s.getBoundingClientRect = () => ({ left: i * 40, right: i * 40 + 40, top: 0, bottom: 40, width: 40, height: 40 });
    });
    host().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 60 })); // slot 1
    expect(input.selectionStart).toBe(1);
    expect(slots()[1].hasAttribute('data-active')).toBe(true);
  });

  it('clicking past the typed length clamps the caret to the end', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installInputOtp();
    const input = field();
    type('12');
    slots().forEach((s, i) => {
      s.getBoundingClientRect = () => ({ left: i * 40, right: i * 40 + 40, top: 0, bottom: 40, width: 40, height: 40 });
    });
    host().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 180 })); // slot 4
    expect(input.selectionStart).toBe(2); // clamped to the typed length
    expect(slots()[2].hasAttribute('data-active')).toBe(true);
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

describe('installInputOtp — group separators', () => {
  const withGroups = (groups, length = 6) =>
    FIXTURE.replace('data-length="6"', `data-length="${length}" data-groups="${groups}"`);
  const seps = () => [...document.querySelectorAll('.hc-inputotp__separator')];
  const visualOrder = () =>
    [...host().children].filter(
      (c) =>
        c.classList.contains('hc-inputotp__slot') ||
        c.classList.contains('hc-inputotp__separator'),
    );

  it('renders one aria-hidden separator after the third slot for "3-3"', () => {
    document.body.innerHTML = withGroups('3-3');
    uninstall = installInputOtp();
    expect(slots()).toHaveLength(6);
    expect(seps()).toHaveLength(1);
    expect(seps()[0].getAttribute('aria-hidden')).toBe('true');
    // order: slot slot slot SEP slot slot slot
    const order = visualOrder();
    expect(order[3].classList.contains('hc-inputotp__separator')).toBe(true);
  });

  it('renders two separators for "2-2-2"', () => {
    document.body.innerHTML = withGroups('2-2-2');
    uninstall = installInputOtp();
    expect(seps()).toHaveLength(2);
  });

  it('accepts whitespace / comma separated group specs', () => {
    document.body.innerHTML = withGroups('3 3');
    uninstall = installInputOtp();
    expect(seps()).toHaveLength(1);
  });

  it('ignores groups that do not sum to the slot count', () => {
    document.body.innerHTML = withGroups('3-2'); // sums to 5, not 6
    uninstall = installInputOtp();
    expect(seps()).toHaveLength(0);
    expect(slots()).toHaveLength(6);
  });

  it('still fills the slots correctly with separators present', () => {
    document.body.innerHTML = withGroups('3-3');
    uninstall = installInputOtp();
    type('1234');
    expect(slots().map((s) => s.textContent).join('')).toBe('1234');
  });
});
