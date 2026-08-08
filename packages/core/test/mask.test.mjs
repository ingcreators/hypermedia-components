import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMask } from '../src/js/mask.js';

let uninstall = () => {};

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

function type(el, value, caret = value.length) {
  el.focus();
  el.value = value;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

// jsdom dispatches `beforeinput` but has no editing engine, so emulate
// the browser default (single-character deletion + input event) when the
// behavior does not preventDefault. When it does, the behavior performs
// its own edit and dispatches input itself.
function pressDelete(el, caret, inputType) {
  el.focus();
  el.setSelectionRange(caret, caret);
  const proceeded = el.dispatchEvent(
    new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType }),
  );
  if (!proceeded) return;
  const s = el.selectionStart;
  if (inputType === 'deleteContentBackward' && s > 0) {
    el.setRangeText('', s - 1, s, 'start');
  } else if (inputType === 'deleteContentForward' && s < el.value.length) {
    el.setRangeText('', s, s + 1, 'start');
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

describe('installMask', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="f">
        <input id="postal" name="postal" data-hc-mask="postal-jp">
        <input id="code" name="code" data-hc-mask="AA-##">
      </form>
    `;
  });

  const postal = () => document.getElementById('postal');
  const code = () => document.getElementById('code');

  it('renders the postal-jp preset with a lazy literal', () => {
    uninstall = installMask();
    type(postal(), '123');
    expect(postal().value).toBe('123');
    type(postal(), '1234');
    expect(postal().value).toBe('123-4');
    type(postal(), '1234567');
    expect(postal().value).toBe('123-4567');
  });

  it('normalizes fullwidth digits into slots', () => {
    uninstall = installMask();
    type(postal(), '１２３４５６７');
    expect(postal().value).toBe('123-4567');
  });

  it('drops characters that fit no slot and caps at the mask length', () => {
    uninstall = installMask();
    type(postal(), '12a34567 89');
    expect(postal().value).toBe('123-4567');
  });

  it('keeps the caret after the same raw characters on mid-edit', () => {
    uninstall = installMask();
    // "123-4567" with "9" typed after "12" → "1293-4567" caret after the 9.
    type(postal(), '1293-4567', 3);
    expect(postal().value).toBe('129-3456');
    expect(postal().selectionStart).toBe(3);
  });

  it('upcases A slots and mixes literals', () => {
    uninstall = installMask();
    type(code(), 'ab12');
    expect(code().value).toBe('AB-12');
  });

  it('backspace against a literal run consumes the run plus one raw char', () => {
    uninstall = installMask();
    type(postal(), '1234567');
    expect(postal().value).toBe('123-4567');
    pressDelete(postal(), 4, 'deleteContentBackward');
    expect(postal().value).toBe('124-567');
    expect(postal().selectionStart).toBe(2);
  });

  it('delete-forward against a literal run consumes the run plus one raw char', () => {
    uninstall = installMask();
    type(postal(), '1234567');
    pressDelete(postal(), 3, 'deleteContentForward');
    expect(postal().value).toBe('123-567');
    expect(postal().selectionStart).toBe(3);
  });

  it('backspace on a raw character deletes normally and re-renders', () => {
    uninstall = installMask();
    const el = code();
    type(el, 'ab1');
    expect(el.value).toBe('AB-1');
    // Caret after the digit — the char before it is raw, so the default
    // deletion runs and the lazy literal disappears with its digit.
    pressDelete(el, 4, 'deleteContentBackward');
    expect(el.value).toBe('AB');
  });

  it('submits the displayed form by default and raw with data-hc-mask-submit', () => {
    uninstall = installMask();
    type(postal(), '1234567');
    const withLiterals = new FormData();
    withLiterals.append('postal', postal().value);
    const event = new Event('formdata', { bubbles: true });
    event.formData = withLiterals;
    document.getElementById('f').dispatchEvent(event);
    expect(withLiterals.get('postal')).toBe('123-4567');

    postal().setAttribute('data-hc-mask-submit', 'raw');
    const raw = new FormData();
    raw.append('postal', postal().value);
    const event2 = new Event('formdata', { bubbles: true });
    event2.formData = raw;
    document.getElementById('f').dispatchEvent(event2);
    expect(raw.get('postal')).toBe('1234567');
  });

  it('ignores composition-phase input events', () => {
    uninstall = installMask();
    postal().focus();
    postal().value = '１２３';
    postal().dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true }),
    );
    expect(postal().value).toBe('１２３');
    postal().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(postal().value).toBe('123');
  });

  it('is idempotent and uninstalls cleanly', () => {
    uninstall = installMask();
    expect(installMask()).toBe(uninstall);
    uninstall();
    type(postal(), '1234567');
    expect(postal().value).toBe('1234567');
  });
});
