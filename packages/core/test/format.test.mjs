import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installFormat, installNormalize } from '../src/js/format.js';

let uninstall = () => {};

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

function focusIn(el) {
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

function focusOut(el) {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

function change(el) {
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// jsdom implements FormData but not the `formdata` event, so build the
// entry list by hand and dispatch the event the way a browser would while
// constructing `new FormData(form)`. Real-browser firing is pinned by
// test-browser/format.spec.mjs across all three engines.
function fireFormData(form) {
  const formData = new FormData();
  for (const el of form.elements) {
    if (el.name && !el.disabled && el.value !== undefined && el.type !== 'submit') {
      formData.append(el.name, el.value);
    }
  }
  const event = new Event('formdata', { bubbles: true });
  event.formData = formData;
  form.dispatchEvent(event);
  return formData;
}

describe('installFormat', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="f" lang="en">
        <input id="amount" name="amount" type="text" data-hc-format="number">
        <button type="submit">Save</button>
      </form>
    `;
  });

  const amount = () => document.getElementById('amount');

  it('groups on blur, including fullwidth (NFKC) input', () => {
    uninstall = installFormat();
    amount().value = '１２３４５６７';
    focusOut(amount());
    expect(amount().value).toBe('1,234,567');
  });

  it('shows the raw value on focus and regroups on blur', () => {
    uninstall = installFormat();
    amount().value = '1,234,567';
    focusIn(amount());
    expect(amount().value).toBe('1234567');
    focusOut(amount());
    expect(amount().value).toBe('1,234,567');
  });

  it('honors data-locale for grouping and decimal characters', () => {
    uninstall = installFormat();
    amount().setAttribute('data-locale', 'de-DE');
    amount().value = '1234567,5';
    focusOut(amount());
    expect(amount().value).toBe('1.234.567,5');
    focusIn(amount());
    expect(amount().value).toBe('1234567,5');
  });

  it('pads to data-decimals without ever rounding', () => {
    uninstall = installFormat();
    amount().setAttribute('data-decimals', '2');
    amount().value = '1234.5';
    focusOut(amount());
    expect(amount().value).toBe('1,234.50');
    amount().value = '1234.567';
    focusOut(amount());
    expect(amount().value).toBe('1,234.567');
  });

  it('rewrites the wire value to the raw canonical form', () => {
    uninstall = installFormat();
    amount().value = '1,234,567';
    const data = fireFormData(document.getElementById('f'));
    expect(data.get('amount')).toBe('1234567');
    expect(amount().value).toBe('1,234,567');
  });

  it('leaves unparseable values untouched everywhere', () => {
    uninstall = installFormat();
    amount().value = '12-34';
    focusOut(amount());
    expect(amount().value).toBe('12-34');
    const data = fireFormData(document.getElementById('f'));
    expect(data.get('amount')).toBe('12-34');
  });

  it('leaves duplicated names alone on the wire', () => {
    uninstall = installFormat();
    const twin = amount().cloneNode();
    twin.id = 'amount2';
    document.getElementById('f').append(twin);
    amount().value = '1,000';
    twin.value = '2,000';
    const data = fireFormData(document.getElementById('f'));
    expect(data.getAll('amount')).toEqual(['1,000', '2,000']);
  });

  it('ignores inputs without data-hc-format', () => {
    uninstall = installFormat();
    amount().removeAttribute('data-hc-format');
    amount().value = '1234567';
    focusOut(amount());
    expect(amount().value).toBe('1234567');
  });

  it('is idempotent and uninstalls cleanly', () => {
    uninstall = installFormat();
    expect(installFormat()).toBe(uninstall);
    uninstall();
    amount().value = '1234567';
    focusOut(amount());
    expect(amount().value).toBe('1234567');
  });
});

describe('installNormalize', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="f">
        <input id="sku" name="sku" data-hc-normalize="ascii">
        <input id="furigana" name="furigana" data-hc-normalize="kana">
      </form>
    `;
  });

  const sku = () => document.getElementById('sku');
  const furigana = () => document.getElementById('furigana');

  it('maps fullwidth ASCII and ideographic space on change', () => {
    uninstall = installNormalize();
    sku().value = 'ＡＢＣ　１２３';
    change(sku());
    expect(sku().value).toBe('ABC 123');
  });

  it('rewrites before bubble-phase listeners read the value', () => {
    uninstall = installNormalize();
    let seen = null;
    document.body.addEventListener(
      'change',
      (event) => {
        seen = event.target.value;
      },
      { once: true },
    );
    sku().value = 'ｘ１';
    change(sku());
    expect(seen).toBe('x1');
  });

  it('maps hiragana and halfwidth kana to fullwidth katakana', () => {
    uninstall = installNormalize();
    furigana().value = 'やまだ ﾀﾛｳ';
    change(furigana());
    expect(furigana().value).toBe('ヤマダ タロウ');
  });

  it('normalizes the wire value even without a change event', () => {
    uninstall = installNormalize();
    sku().value = 'Ｚ９';
    const data = fireFormData(document.getElementById('f'));
    expect(data.get('sku')).toBe('Z9');
  });

  it('is idempotent and uninstalls cleanly', () => {
    uninstall = installNormalize();
    expect(installNormalize()).toBe(uninstall);
    uninstall();
    sku().value = 'Ａ';
    change(sku());
    expect(sku().value).toBe('Ａ');
  });
});
