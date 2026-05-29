import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installContextMenu } from '../src/js/context-menu.js';

let uninstall = () => {};

const FIXTURE = `
  <div id="region" data-hc-context-menu="ctx">Right-click me</div>
  <div id="ctx" class="hc-menu" popover role="menu" aria-label="Actions">
    <button id="c-open"     class="hc-menu__item" role="menuitem" type="button">Open</button>
    <button id="c-rename"   class="hc-menu__item" role="menuitem" type="button">Rename</button>
    <button id="c-bookmark" class="hc-menu__item" role="menuitemcheckbox" aria-checked="false" type="button">Bookmark</button>
    <button id="c-del"      class="hc-menu__item" role="menuitem" type="button" aria-disabled="true">Delete</button>
  </div>
`;

// jsdom in this version implements neither the popover algorithm nor
// the `CSS` interface. Minimal, self-consistent shims: show/hide toggle
// a `data-open-stub` marker that `:popover-open` reads back.
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('data-open-stub', '');
    this.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('data-open-stub');
    this.dispatchEvent(new Event('toggle'));
  };
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { supports: () => false, escape: (s) => String(s) };
}
const ORIG_MATCHES = Element.prototype.matches;
Element.prototype.matches = function (sel) {
  if (sel === ':popover-open') return this.hasAttribute('data-open-stub');
  return ORIG_MATCHES.call(this, sel);
};

function rightClick(el, x = 50, y = 60) {
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
  el.dispatchEvent(e);
  return e;
}

function press(el, key, opts = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installContextMenu', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installContextMenu();
    const u2 = installContextMenu();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('contextmenu opens the menu and suppresses the native menu', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    const e = rightClick(document.getElementById('region'));
    expect(e.defaultPrevented).toBe(true);
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(true);
  });

  it('positions the menu at the pointer with fixed coordinates', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    rightClick(document.getElementById('region'), 120, 90);
    const s = document.getElementById('ctx').style;
    expect(s.getPropertyValue('position')).toBe('fixed');
    expect(s.getPropertyValue('inset-inline-start')).toBe('120px');
    expect(s.getPropertyValue('inset-block-start')).toBe('90px');
  });

  it('focuses the first enabled item on open', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    rightClick(document.getElementById('region'));
    expect(document.activeElement.id).toBe('c-open');
  });

  it('Shift+F10 opens the menu; plain F10 does not', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    const region = document.getElementById('region');

    press(region, 'F10'); // no shift → ignored
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(false);

    const e = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true });
    region.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(true);
  });

  it('arrow keys navigate the open menu, skipping disabled items', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    rightClick(document.getElementById('region'));

    press(document.activeElement, 'ArrowDown'); // c-open → c-rename
    expect(document.activeElement.id).toBe('c-rename');
    press(document.activeElement, 'End'); // last enabled = c-bookmark (c-del disabled)
    expect(document.activeElement.id).toBe('c-bookmark');
  });

  it('clicking a menuitem dispatches hc:menuselect with the context target and closes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    const region = document.getElementById('region');
    const menu = document.getElementById('ctx');
    const detail = vi.fn();
    menu.addEventListener('hc:menuselect', (e) => detail(e.detail));

    rightClick(region);
    click(document.getElementById('c-open'));

    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls[0][0].item.id).toBe('c-open');
    expect(detail.mock.calls[0][0].contextTarget).toBe(region);
    expect(menu.matches(':popover-open')).toBe(false); // plain menuitem closes
  });

  it('menuitemcheckbox toggles aria-checked and keeps the menu open', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installContextMenu();
    rightClick(document.getElementById('region'));
    click(document.getElementById('c-bookmark'));
    expect(document.getElementById('c-bookmark').getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(true);
  });

  it('a region pointing at a missing menu id is a silent no-op', () => {
    document.body.innerHTML = `<div id="r2" data-hc-context-menu="nope">x</div>`;
    uninstall = installContextMenu();
    const e = rightClick(document.getElementById('r2'));
    // No menu to open → the native context menu is left alone.
    expect(e.defaultPrevented).toBe(false);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installContextMenu();
    u();
    const e = rightClick(document.getElementById('region'));
    expect(e.defaultPrevented).toBe(false);
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(false);
  });

  it('picks up a region added to the DOM after install (MutationObserver)', async () => {
    uninstall = installContextMenu();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    const e = rightClick(document.getElementById('region'));
    expect(e.defaultPrevented).toBe(true);
    expect(document.getElementById('ctx').matches(':popover-open')).toBe(true);
  });
});
