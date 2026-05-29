import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCombobox } from '../src/js/combobox.js';

let uninstall = () => {};

const SIMPLE = `
  <div class="hc-combobox">
    <input id="cb-input" type="text" role="combobox"
           aria-controls="cb-list" aria-label="Country">
    <ul id="cb-list" class="hc-combobox__listbox" role="listbox">
      <li id="opt-jp" class="hc-combobox__option" role="option" data-value="jp">Japan</li>
      <li id="opt-us" class="hc-combobox__option" role="option" data-value="us">United States</li>
      <li id="opt-gb" class="hc-combobox__option" role="option" data-value="gb">United Kingdom</li>
      <li id="opt-fr" class="hc-combobox__option" role="option" data-value="fr">France</li>
      <li id="opt-de" class="hc-combobox__option" role="option" data-value="de"
          aria-disabled="true">Germany</li>
    </ul>
  </div>
`;

// jsdom shims for popover + CSS — match the menu/tooltip test shape.
if (!HTMLElement.prototype.hidePopover) {
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('data-open-stub');
    this.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('data-open-stub', '');
    this.dispatchEvent(new Event('toggle'));
  };
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    supports: () => false,
    escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`),
  };
}
const ORIG_MATCHES = Element.prototype.matches;
Element.prototype.matches = function (sel) {
  if (sel === ':popover-open') return this.hasAttribute('data-open-stub');
  return ORIG_MATCHES.call(this, sel);
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('installCombobox', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installCombobox();
    const u2 = installCombobox();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires ARIA attributes on the input', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('focusing the input opens the listbox and sets aria-expanded', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    const list = document.getElementById('cb-list');
    input.dispatchEvent(new Event('focus'));
    expect(list.matches(':popover-open')).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('typing filters options by substring (case-insensitive)', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    input.dispatchEvent(new Event('focus'));

    input.value = 'uni';
    input.dispatchEvent(new Event('input'));

    expect(document.getElementById('opt-us').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('opt-gb').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('opt-jp').hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('opt-fr').hasAttribute('hidden')).toBe(true);
  });

  it('arrow keys move data-active and aria-activedescendant, skipping disabled options', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    input.dispatchEvent(new Event('focus'));

    // After open, the first visible option is active.
    expect(document.getElementById('opt-jp').getAttribute('data-active')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('opt-jp');

    press(input, 'ArrowDown');
    expect(document.getElementById('opt-us').getAttribute('data-active')).toBe('true');

    press(input, 'ArrowDown');
    expect(document.getElementById('opt-gb').getAttribute('data-active')).toBe('true');

    press(input, 'ArrowDown');
    expect(document.getElementById('opt-fr').getAttribute('data-active')).toBe('true');

    // Germany is aria-disabled → ArrowDown clamps at France.
    press(input, 'ArrowDown');
    expect(document.getElementById('opt-fr').getAttribute('data-active')).toBe('true');

    press(input, 'ArrowUp');
    expect(document.getElementById('opt-gb').getAttribute('data-active')).toBe('true');
  });

  it('Home / End jump to first / last visible enabled options', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    input.dispatchEvent(new Event('focus'));
    press(input, 'ArrowDown'); // move off the first

    press(input, 'Home');
    expect(document.getElementById('opt-jp').getAttribute('data-active')).toBe('true');

    press(input, 'End');
    // France is the last enabled option (Germany is disabled).
    expect(document.getElementById('opt-fr').getAttribute('data-active')).toBe('true');
  });

  it('Enter selects the active option, fires hc:comboboxselect, closes the listbox', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    const list = document.getElementById('cb-list');

    const events = [];
    document.body.addEventListener('hc:comboboxselect', (e) => events.push(e.detail));

    input.dispatchEvent(new Event('focus'));
    press(input, 'ArrowDown'); // active = us
    press(input, 'Enter');

    expect(events).toHaveLength(1);
    expect(events[0].value).toBe('us');
    expect(events[0].label).toBe('United States');
    expect(input.value).toBe('United States');
    expect(list.matches(':popover-open')).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking an option selects it and dispatches hc:comboboxselect', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    const opt = document.getElementById('opt-fr');
    input.dispatchEvent(new Event('focus'));

    const fired = vi.fn();
    document.body.addEventListener('hc:comboboxselect', fired);
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(fired).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('France');
  });

  it('Escape closes the listbox without changing the input value', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    const list = document.getElementById('cb-list');
    input.value = 'pre-existing';
    input.dispatchEvent(new Event('focus'));
    press(input, 'ArrowDown');
    press(input, 'Escape');

    expect(list.matches(':popover-open')).toBe(false);
    expect(input.value).toBe('pre-existing');
  });

  it('an empty filter inserts a .hc-combobox__empty placeholder', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installCombobox();
    const input = document.getElementById('cb-input');
    const list = document.getElementById('cb-list');
    input.dispatchEvent(new Event('focus'));
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));

    const empty = list.querySelector('.hc-combobox__empty');
    expect(empty).not.toBeNull();
    expect(empty.getAttribute('role')).toBe('presentation');
  });

  it('uninstall detaches handlers and cleans up ARIA + inline styles', () => {
    document.body.innerHTML = SIMPLE;
    const u = installCombobox();
    const input = document.getElementById('cb-input');

    u();

    expect(input.hasAttribute('aria-haspopup')).toBe(false);
    expect(input.hasAttribute('aria-autocomplete')).toBe(false);
    expect(input.hasAttribute('aria-expanded')).toBe(false);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    uninstall = () => {};
  });

  it('picks up .hc-combobox added after install (MutationObserver)', async () => {
    uninstall = installCombobox();
    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    document.body.appendChild(wrap.firstElementChild);

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('cb-input').getAttribute('aria-haspopup')).toBe('listbox');
  });
});
