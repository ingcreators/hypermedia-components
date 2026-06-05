import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMulticombobox } from '../src/js/multicombobox.js';

let uninstall = () => {};

const SIMPLE = `
  <div class="hc-multicombobox" data-name="langs">
    <div class="hc-multicombobox__control hc-input">
      <span class="hc-multicombobox__tags"></span>
      <input id="mc-input" type="text" role="combobox"
             aria-controls="mc-list" aria-label="Languages">
    </div>
    <ul id="mc-list" class="hc-multicombobox__listbox" role="listbox">
      <li id="mc-js" class="hc-multicombobox__option" role="option" data-value="js">JavaScript</li>
      <li id="mc-ts" class="hc-multicombobox__option" role="option" data-value="ts">TypeScript</li>
      <li id="mc-py" class="hc-multicombobox__option" role="option" data-value="py" aria-selected="true">Python</li>
      <li id="mc-go" class="hc-multicombobox__option" role="option" data-value="go">Go</li>
      <li id="mc-rs" class="hc-multicombobox__option" role="option" data-value="rs"
          aria-disabled="true">Rust</li>
    </ul>
  </div>
`;

// jsdom shims (matching the menu / tooltip / combobox suites).
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

describe('installMulticombobox', () => {
  it('is idempotent', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installMulticombobox();
    const u2 = installMulticombobox();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('seeds initial tags + hidden inputs from author-supplied aria-selected', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const root = document.querySelector('.hc-multicombobox');
    const tags = root.querySelectorAll('.hc-multicombobox__tag');
    expect(tags).toHaveLength(1);
    expect(tags[0].dataset.value).toBe('py');
    // Hidden form input created because data-name is set.
    const hidden = root.querySelectorAll('input[type="hidden"][name="langs"]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0].value).toBe('py');
  });

  it('selecting an option adds a tag, sets aria-selected, keeps listbox open', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    const list = document.getElementById('mc-list');
    input.dispatchEvent(new Event('focus'));

    document.getElementById('mc-js').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(document.getElementById('mc-js').getAttribute('aria-selected')).toBe('true');
    expect(list.matches(':popover-open')).toBe(true);
    const tagValues = Array.from(
      document.querySelectorAll('.hc-multicombobox__tag'),
    ).map((t) => t.dataset.value);
    expect(tagValues).toEqual(['py', 'js']);
  });

  it('selecting an already-selected option deselects it (toggle)', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    input.dispatchEvent(new Event('focus'));

    document.getElementById('mc-py').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(document.getElementById('mc-py').getAttribute('aria-selected')).toBeNull();
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(0);
  });

  it('clicking the tag remove button removes the tag', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const remove = document.querySelector(
      '.hc-multicombobox__tag[data-value="py"] .hc-multicombobox__tag-remove',
    );
    remove.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(document.getElementById('mc-py').getAttribute('aria-selected')).toBeNull();
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(0);
    // Hidden form input also cleared.
    expect(document.querySelectorAll('input[type="hidden"][name="langs"]'))
      .toHaveLength(0);
  });

  it('Backspace in an empty input removes the last tag', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');

    input.dispatchEvent(new Event('focus'));
    // Add JS and Go on top of the seeded Python tag.
    document.getElementById('mc-js').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    document.getElementById('mc-go').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(3);

    input.value = '';
    press(input, 'Backspace');
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(2);
    const last = document.querySelector('.hc-multicombobox__tag:last-child');
    expect(last.dataset.value).toBe('js');
  });

  it('Backspace does NOT remove a tag while the input has text', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    input.dispatchEvent(new Event('focus'));
    input.value = 'java';
    press(input, 'Backspace');
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(1);
  });

  it('disabled options cannot be toggled by click or Enter', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    input.dispatchEvent(new Event('focus'));
    document.getElementById('mc-rs').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(document.getElementById('mc-rs').getAttribute('aria-selected')).toBeNull();
  });

  it('typing filters options by substring (case-insensitive)', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    input.dispatchEvent(new Event('focus'));
    input.value = 'script';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('mc-js').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('mc-ts').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('mc-py').hasAttribute('hidden')).toBe(true);
  });

  it('hc:multicomboboxchange fires with added / removed / values detail', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    const events = [];
    document.body.addEventListener('hc:multicomboboxchange', (e) => events.push(e.detail));

    input.dispatchEvent(new Event('focus'));
    document.getElementById('mc-js').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    document.querySelector(
      '.hc-multicombobox__tag[data-value="py"] .hc-multicombobox__tag-remove',
    ).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(events).toHaveLength(2);
    expect(events[0].added).toEqual(['js']);
    expect(events[0].removed).toEqual([]);
    expect(events[0].values).toEqual(['py', 'js']);
    expect(events[1].added).toEqual([]);
    expect(events[1].removed).toEqual(['py']);
    expect(events[1].values).toEqual(['js']);
  });

  it('Escape closes the listbox; selections remain intact', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    const input = document.getElementById('mc-input');
    const list = document.getElementById('mc-list');
    input.dispatchEvent(new Event('focus'));
    document.getElementById('mc-js').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    press(input, 'Escape');
    expect(list.matches(':popover-open')).toBe(false);
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(2);
  });

  it('uninstall detaches handlers, clears tags + hidden inputs + ARIA', () => {
    document.body.innerHTML = SIMPLE;
    const u = installMulticombobox();
    const input = document.getElementById('mc-input');
    u();
    expect(input.hasAttribute('aria-haspopup')).toBe(false);
    expect(input.hasAttribute('aria-autocomplete')).toBe(false);
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(0);
    expect(document.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    uninstall = () => {};
  });

  it('without data-name no hidden inputs are rendered', () => {
    document.body.innerHTML = SIMPLE.replace('data-name="langs"', '');
    uninstall = installMulticombobox();
    expect(document.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    // Tags still render normally.
    expect(document.querySelectorAll('.hc-multicombobox__tag')).toHaveLength(1);
  });

  it('picks up .hc-multicombobox added after install (MutationObserver)', async () => {
    uninstall = installMulticombobox();
    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    document.body.appendChild(wrap.firstElementChild);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('mc-input').getAttribute('aria-haspopup')).toBe('listbox');
  });
});

describe('installMulticombobox — creatable', () => {
  const creatable = () =>
    SIMPLE.replace('class="hc-multicombobox"', 'class="hc-multicombobox" data-allow-create');

  function type(value) {
    const input = document.getElementById('mc-input');
    input.dispatchEvent(new Event('focus'));
    input.value = value;
    input.dispatchEvent(new Event('input'));
    return input;
  }
  function clickEl(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  it('shows an Add option for a new value', () => {
    document.body.innerHTML = creatable();
    uninstall = installMulticombobox();
    type('Kotlin');
    const create = document.querySelector('.hc-multicombobox__create');
    expect(create).not.toBeNull();
    expect(create.dataset.value).toBe('Kotlin');
    expect(create.getAttribute('role')).toBe('option');
  });

  it('selecting Add creates a tag labelled with the raw value + fires change', () => {
    document.body.innerHTML = creatable();
    uninstall = installMulticombobox();
    const details = [];
    document
      .querySelector('.hc-multicombobox')
      .addEventListener('hc:multicomboboxchange', (e) => details.push(e.detail));
    type('Kotlin');
    clickEl(document.querySelector('.hc-multicombobox__create'));

    const tags = [...document.querySelectorAll('.hc-multicombobox__tag')];
    const kotlin = tags.find((t) => t.dataset.value === 'Kotlin');
    expect(kotlin).toBeTruthy();
    expect(kotlin.textContent).toContain('Kotlin');
    expect(kotlin.textContent).not.toContain('Add'); // label is the value, not "Add …"
    expect(details.at(-1).added).toContain('Kotlin');
    // the synthetic option is gone after creating
    expect(document.querySelector('.hc-multicombobox__create')).toBeNull();
  });

  it('does not create without data-allow-create', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMulticombobox();
    type('Kotlin');
    expect(document.querySelector('.hc-multicombobox__create')).toBeNull();
  });
});
