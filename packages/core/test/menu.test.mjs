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

  describe('menuitemcheckbox / menuitemradio', () => {
    const CHECKABLE = `
      <button id="trigger" type="button" popovertarget="m2">Open</button>
      <div id="m2" class="hc-menu" popover role="menu" aria-labelledby="trigger">
        <button id="cmd-refresh" class="hc-menu__item" role="menuitem" type="button">Refresh</button>
        <hr class="hc-menu__separator">
        <div role="group" aria-labelledby="show-label">
          <span class="hc-menu__label" id="show-label">Show</span>
          <button id="cb-toolbar" class="hc-menu__item" role="menuitemcheckbox" type="button" aria-checked="true">Toolbar</button>
          <button id="cb-sidebar" class="hc-menu__item" role="menuitemcheckbox" type="button" aria-checked="false">Sidebar</button>
        </div>
        <hr class="hc-menu__separator">
        <div role="group" aria-labelledby="dens-label">
          <span class="hc-menu__label" id="dens-label">Density</span>
          <button id="r-comfortable" class="hc-menu__item" role="menuitemradio" type="button" aria-checked="true">Comfortable</button>
          <button id="r-compact" class="hc-menu__item" role="menuitemradio" type="button" aria-checked="false">Compact</button>
          <button id="r-dense" class="hc-menu__item" role="menuitemradio" type="button" aria-checked="false">Dense</button>
        </div>
      </div>
    `;

    function click(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    it('checkbox click toggles aria-checked and does NOT close the menu', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();
      const menu = document.getElementById('m2');
      const closed = vi.spyOn(menu, 'hidePopover');
      const sidebar = document.getElementById('cb-sidebar');
      const toolbar = document.getElementById('cb-toolbar');

      // false → true
      click(sidebar);
      expect(sidebar.getAttribute('aria-checked')).toBe('true');
      // true → false (independent of sidebar)
      click(toolbar);
      expect(toolbar.getAttribute('aria-checked')).toBe('false');
      expect(sidebar.getAttribute('aria-checked')).toBe('true');

      expect(closed).not.toHaveBeenCalled();
    });

    it('radio click selects this item and unselects every sibling in the same group', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();
      const comfortable = document.getElementById('r-comfortable');
      const compact = document.getElementById('r-compact');
      const dense = document.getElementById('r-dense');

      click(compact);
      expect(compact.getAttribute('aria-checked')).toBe('true');
      expect(comfortable.getAttribute('aria-checked')).toBe('false');
      expect(dense.getAttribute('aria-checked')).toBe('false');

      // Does not touch the unrelated checkbox group above.
      expect(document.getElementById('cb-toolbar').getAttribute('aria-checked')).toBe('true');
    });

    it('radio click does NOT close the menu', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();
      const menu = document.getElementById('m2');
      const closed = vi.spyOn(menu, 'hidePopover');
      click(document.getElementById('r-compact'));
      expect(closed).not.toHaveBeenCalled();
    });

    it('plain menuitem click still closes the menu', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();
      const menu = document.getElementById('m2');
      const closed = vi.spyOn(menu, 'hidePopover');
      click(document.getElementById('cmd-refresh'));
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('hc:menuselect detail carries the new checked state for checkbox / radio, undefined for menuitem', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();

      const events = [];
      document.body.addEventListener('hc:menuselect', (e) => events.push(e.detail));

      click(document.getElementById('cb-sidebar'));     // false → true
      click(document.getElementById('cb-toolbar'));     // true → false
      click(document.getElementById('r-compact'));      // → true
      click(document.getElementById('cmd-refresh'));    // plain — no change

      expect(events[0].checked).toBe(true);
      expect(events[1].checked).toBe(false);
      expect(events[2].checked).toBe(true);
      expect(events[3].checked).toBeUndefined();
    });

    it('arrow key navigation traverses checkbox / radio items in document order', () => {
      document.body.innerHTML = CHECKABLE;
      uninstall = installMenu();
      const menu = document.getElementById('m2');
      menu.setAttribute('data-open-stub', '');

      document.getElementById('cmd-refresh').focus();
      press(menu, 'ArrowDown');
      expect(document.activeElement.id).toBe('cb-toolbar');
      press(menu, 'ArrowDown');
      expect(document.activeElement.id).toBe('cb-sidebar');
      press(menu, 'ArrowDown');
      expect(document.activeElement.id).toBe('r-comfortable');
    });
  });

  describe('JS positioning fallback — collision flipping', () => {
    // Stub viewport + getBoundingClientRect to drive the fallback
    // through every flip combination. Mirrors the
    // `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`
    // CSS path used by browsers that support Anchor Positioning.
    function setupFallback({ vw, vh, trigger, menu }) {
      const origSupports = CSS.supports;
      CSS.supports = () => false;
      const origInnerW = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      const origInnerH = Object.getOwnPropertyDescriptor(window, 'innerHeight');
      Object.defineProperty(window, 'innerWidth', { value: vw, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: vh, configurable: true });
      const t = document.getElementById('trigger');
      const m = document.getElementById('m1');
      t.getBoundingClientRect = () => ({ ...trigger, right: trigger.left + trigger.width, bottom: trigger.top + trigger.height });
      m.getBoundingClientRect = () => ({ ...menu, right: menu.left + menu.width, bottom: menu.top + menu.height });
      return () => {
        CSS.supports = origSupports;
        if (origInnerW) Object.defineProperty(window, 'innerWidth', origInnerW);
        if (origInnerH) Object.defineProperty(window, 'innerHeight', origInnerH);
      };
    }

    function fireOpen(m) {
      const evt = new Event('beforetoggle');
      Object.defineProperty(evt, 'newState', { value: 'open' });
      m.dispatchEvent(evt);
    }

    it('places the menu directly under the trigger when there is room (no flip)', () => {
      document.body.innerHTML = SIMPLE;
      const restore = setupFallback({
        vw: 1024, vh: 768,
        trigger: { top: 50, left: 100, width: 80, height: 32 },
        menu:    { top: 0, left: 0, width: 160, height: 200 },
      });
      uninstall = installMenu();
      const m = document.getElementById('m1');
      fireOpen(m);
      expect(m.style.top).toBe('86px');   // trigger.bottom + gap
      expect(m.style.left).toBe('100px'); // trigger.left
      restore();
    });

    it('flips block when the menu would overflow the viewport bottom', () => {
      document.body.innerHTML = SIMPLE;
      const restore = setupFallback({
        vw: 1024, vh: 600,
        trigger: { top: 500, left: 100, width: 80, height: 32 },  // bottom: 532
        menu:    { top: 0, left: 0, width: 160, height: 200 },    // 532+200 > 600
      });
      uninstall = installMenu();
      const m = document.getElementById('m1');
      fireOpen(m);
      // 500 - 200 - 4 = 296
      expect(m.style.top).toBe('296px');
      expect(m.style.left).toBe('100px');
      restore();
    });

    it('flips inline when the menu would overflow the viewport inline-end', () => {
      document.body.innerHTML = SIMPLE;
      const restore = setupFallback({
        vw: 600, vh: 768,
        trigger: { top: 50, left: 500, width: 80, height: 32 },   // right: 580
        menu:    { top: 0, left: 0, width: 160, height: 200 },    // 500+160 > 600
      });
      uninstall = installMenu();
      const m = document.getElementById('m1');
      fireOpen(m);
      expect(m.style.top).toBe('86px');
      // trigger.right - menu.width = 580 - 160 = 420
      expect(m.style.left).toBe('420px');
      restore();
    });

    it('flips block AND inline when the menu would overflow both axes', () => {
      document.body.innerHTML = SIMPLE;
      const restore = setupFallback({
        vw: 600, vh: 600,
        trigger: { top: 500, left: 500, width: 80, height: 32 },
        menu:    { top: 0, left: 0, width: 160, height: 200 },
      });
      uninstall = installMenu();
      const m = document.getElementById('m1');
      fireOpen(m);
      expect(m.style.top).toBe('296px');
      expect(m.style.left).toBe('420px');
      restore();
    });
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
