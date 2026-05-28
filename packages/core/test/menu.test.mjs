import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installMenu } from '../src/js/menu.js';

let uninstall = () => {};

const SIMPLE = `
  <button id="trigger" type="button" popovertarget="m1">Open</button>
  <div id="m1" class="hc-menu" popover role="menu" aria-labelledby="trigger">
    <button id="item-a" class="hc-menu__item" role="menuitem" type="button">Apple</button>
    <button id="item-b" class="hc-menu__item" role="menuitem" type="button">Banana</button>
    <button id="item-c" class="hc-menu__item" role="menuitem" type="button" aria-disabled="true">Cherry</button>
    <button id="item-d" class="hc-menu__item" role="menuitem" type="button" data-variant="error">Drop</button>
  </div>
`;

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

// jsdom does not implement the popover algorithm or the `CSS`
// interface. Set up minimal shims once for the whole file.
if (!HTMLElement.prototype.hidePopover) {
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('open', '');
    this.dispatchEvent(new Event('toggle'));
  };
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    supports: () => false,
    escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`),
  };
}
// Recognise `:popover-open` in element.matches() — toggled per element
// via a `data-open-stub` attribute. Wrap once; subsequent beforeEach
// runs do not re-wrap (the wrapper itself ignores `:popover-open` and
// delegates everything else to the original).
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

describe('installMenu', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installMenu();
    const u2 = installMenu();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires ARIA attributes on the trigger', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const t = document.getElementById('trigger');
    expect(t.getAttribute('aria-haspopup')).toBe('menu');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.getAttribute('aria-controls')).toBe('m1');
  });

  it('updates aria-expanded on toggle', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const t = document.getElementById('trigger');
    const m = document.getElementById('m1');

    // Simulate open
    m.dispatchEvent(new Event('toggle'));
    Object.defineProperty(m, 'matches', { value: () => true, configurable: true });

    // Trigger a toggle event with newState. jsdom's Event doesn't
    // carry newState, so synthesize the read.
    const evtOpen = new Event('toggle');
    Object.defineProperty(evtOpen, 'newState', { value: 'open' });
    m.dispatchEvent(evtOpen);
    expect(t.getAttribute('aria-expanded')).toBe('true');

    const evtClose = new Event('toggle');
    Object.defineProperty(evtClose, 'newState', { value: 'closed' });
    m.dispatchEvent(evtClose);
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  it('injects a unique anchor-name on trigger + position-anchor on menu when CSS supports it', () => {
    document.body.innerHTML = SIMPLE;
    const origSupports = CSS.supports;
    CSS.supports = (prop) => prop === 'anchor-name' ? true : origSupports.call(CSS, prop);

    uninstall = installMenu();
    const t = document.getElementById('trigger');
    const m = document.getElementById('m1');
    expect(t.style.getPropertyValue('anchor-name')).toBe('--hc-menu-m1');
    expect(m.style.getPropertyValue('position-anchor')).toBe('--hc-menu-m1');

    CSS.supports = origSupports;
  });

  it('skips anchor-name injection and registers a fallback when CSS Anchor Positioning is unsupported', () => {
    document.body.innerHTML = SIMPLE;
    const origSupports = CSS.supports;
    CSS.supports = () => false;

    uninstall = installMenu();
    const t = document.getElementById('trigger');
    const m = document.getElementById('m1');
    expect(t.style.getPropertyValue('anchor-name')).toBe('');
    expect(m.style.getPropertyValue('position-anchor')).toBe('');

    // beforetoggle → open should apply position: fixed via the
    // fallback path.
    const evt = new Event('beforetoggle');
    Object.defineProperty(evt, 'newState', { value: 'open' });
    m.dispatchEvent(evt);
    expect(m.style.position).toBe('fixed');

    CSS.supports = origSupports;
  });

  it('ArrowDown / ArrowUp move focus within enabled menuitems and wrap', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const m = document.getElementById('m1');
    m.setAttribute('data-open-stub', '');

    document.getElementById('item-a').focus();
    press(m, 'ArrowDown');
    expect(document.activeElement.id).toBe('item-b');
    // Cherry is disabled → ArrowDown skips it and lands on Drop.
    press(m, 'ArrowDown');
    expect(document.activeElement.id).toBe('item-d');
    // From the last enabled item, ArrowDown wraps to first.
    press(m, 'ArrowDown');
    expect(document.activeElement.id).toBe('item-a');
    // ArrowUp wraps backwards.
    press(m, 'ArrowUp');
    expect(document.activeElement.id).toBe('item-d');
  });

  it('Home / End jump to first / last enabled items', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const m = document.getElementById('m1');
    m.setAttribute('data-open-stub', '');

    document.getElementById('item-b').focus();
    press(m, 'Home');
    expect(document.activeElement.id).toBe('item-a');
    press(m, 'End');
    expect(document.activeElement.id).toBe('item-d');
  });

  it('type-ahead jumps to the next enabled item starting with the pressed letter', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const m = document.getElementById('m1');
    m.setAttribute('data-open-stub', '');

    document.getElementById('item-a').focus();
    press(m, 'b');
    expect(document.activeElement.id).toBe('item-b');
    // Cherry is disabled → typing 'c' skips it and wraps; 'd' picks Drop.
    press(m, 'd');
    expect(document.activeElement.id).toBe('item-d');
  });

  it('clicking a menuitem dispatches hc:menuselect with item/menu/trigger and closes the popover', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const m = document.getElementById('m1');
    const item = document.getElementById('item-b');
    const closed = vi.spyOn(m, 'hidePopover');

    let received = null;
    document.body.addEventListener('hc:menuselect', (e) => { received = e; });

    item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(received).not.toBeNull();
    expect(received.detail.item).toBe(item);
    expect(received.detail.menu).toBe(m);
    expect(received.detail.trigger).toBe(document.getElementById('trigger'));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('clicking a disabled menuitem does not dispatch hc:menuselect', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installMenu();
    const m = document.getElementById('m1');
    const closed = vi.spyOn(m, 'hidePopover');
    const fired = vi.fn();
    document.body.addEventListener('hc:menuselect', fired);

    document.getElementById('item-c').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(fired).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('uninstall removes ARIA attributes, anchor inline-styles, and handlers', () => {
    document.body.innerHTML = SIMPLE;
    const origSupports = CSS.supports;
    CSS.supports = (prop) => prop === 'anchor-name' ? true : origSupports.call(CSS, prop);

    const u = installMenu();
    const t = document.getElementById('trigger');
    const m = document.getElementById('m1');
    u();

    expect(t.hasAttribute('aria-haspopup')).toBe(false);
    expect(t.hasAttribute('aria-expanded')).toBe(false);
    expect(t.hasAttribute('aria-controls')).toBe(false);
    expect(t.style.getPropertyValue('anchor-name')).toBe('');
    expect(m.style.getPropertyValue('position-anchor')).toBe('');

    // Click no longer dispatches.
    const fired = vi.fn();
    document.body.addEventListener('hc:menuselect', fired);
    document.getElementById('item-a').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(fired).not.toHaveBeenCalled();

    uninstall = () => {};
    CSS.supports = origSupports;
  });

  it('skips .hc-menu without a popover attribute', () => {
    document.body.innerHTML = `
      <button id="t2" popovertarget="m2">Open</button>
      <div id="m2" class="hc-menu" role="menu" data-testid="non-popover">
        <button class="hc-menu__item" role="menuitem">X</button>
      </div>
    `;
    uninstall = installMenu();
    expect(document.getElementById('t2').hasAttribute('aria-haspopup')).toBe(false);
  });

  it('picks up .hc-menu added after install (MutationObserver)', async () => {
    uninstall = installMenu();

    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('trigger').getAttribute('aria-haspopup')).toBe('menu');
  });
});
