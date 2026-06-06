import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMenubar } from '../src/js/menubar.js';

let uninstall = () => {};

// jsdom has no popover algorithm — minimal shims (mirrors menu.test.mjs).
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('open', '');
    this.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('toggle'));
  };
}

const MARKUP = `
  <div class="hc-menubar" role="menubar" aria-label="Main">
    <button class="hc-menubar__item" role="menuitem" type="button" popovertarget="mb-file" data-testid="t-file">File</button>
    <button class="hc-menubar__item" role="menuitem" type="button" popovertarget="mb-edit" data-testid="t-edit">Edit</button>
    <button class="hc-menubar__item" role="menuitem" type="button" popovertarget="mb-view" data-testid="t-view">View</button>
    <div class="hc-menu" id="mb-file" popover role="menu" aria-label="File">
      <button class="hc-menu__item" role="menuitem" type="button" data-testid="f1">New</button>
      <button class="hc-menu__item" role="menuitem" type="button" data-testid="f2">Open</button>
    </div>
    <div class="hc-menu" id="mb-edit" popover role="menu" aria-label="Edit">
      <button class="hc-menu__item" role="menuitem" type="button" data-testid="e1">Undo</button>
    </div>
    <div class="hc-menu" id="mb-view" popover role="menu" aria-label="View">
      <button class="hc-menu__item" role="menuitem" type="button" data-testid="v1">Zoom</button>
    </div>
  </div>
`;

const id = (t) => document.querySelector(`[data-testid="${t}"]`);
const menu = (mid) => document.getElementById(mid);
function press(el, key) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installMenubar', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = MARKUP;
    const u1 = installMenubar();
    const u2 = installMenubar();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('makes the bar a single tab stop (first item tabindex 0, rest -1)', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();
    expect(id('t-file').getAttribute('tabindex')).toBe('0');
    expect(id('t-edit').getAttribute('tabindex')).toBe('-1');
    expect(id('t-view').getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight / ArrowLeft rove across top items and wrap', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();

    press(id('t-file'), 'ArrowRight');
    expect(document.activeElement).toBe(id('t-edit'));
    expect(id('t-edit').getAttribute('tabindex')).toBe('0');
    expect(id('t-file').getAttribute('tabindex')).toBe('-1');

    press(id('t-file'), 'ArrowLeft'); // wraps to last
    expect(document.activeElement).toBe(id('t-view'));
  });

  it('Home / End jump to the first / last top item', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();
    press(id('t-edit'), 'End');
    expect(document.activeElement).toBe(id('t-view'));
    press(id('t-view'), 'Home');
    expect(document.activeElement).toBe(id('t-file'));
  });

  it('ArrowDown opens the focused menu and moves focus to its first item', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();
    press(id('t-file'), 'ArrowDown');
    expect(menu('mb-file').hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(id('f1'));
  });

  it('ArrowRight at a menu top level switches to the adjacent menu', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();

    press(id('t-file'), 'ArrowDown'); // open File, focus f1
    expect(menu('mb-file').hasAttribute('open')).toBe(true);

    press(id('f1'), 'ArrowRight'); // switch to Edit
    expect(menu('mb-file').hasAttribute('open')).toBe(false);
    expect(menu('mb-edit').hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(id('e1'));
  });

  it('ArrowLeft at a menu top level switches to the previous menu (wraps)', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installMenubar();

    press(id('t-file'), 'ArrowDown'); // open File
    press(id('f1'), 'ArrowLeft'); // wrap to View
    expect(menu('mb-file').hasAttribute('open')).toBe(false);
    expect(menu('mb-view').hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(id('v1'));
  });

  it('stops roving after uninstall', () => {
    document.body.innerHTML = MARKUP;
    const u = installMenubar();
    u();
    uninstall = () => {};
    press(id('t-file'), 'ArrowRight');
    // No roving: focus did not move to the next item.
    expect(document.activeElement).not.toBe(id('t-edit'));
  });
});
