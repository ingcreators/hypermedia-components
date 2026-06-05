import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installMenu } from '../src/js/menu.js';

let uninstall = () => {};

// A root dropdown menu with one submenu ("More") nested inside it.
const TREE = `
  <button id="trigger" type="button" popovertarget="root">Open</button>
  <div id="root" class="hc-menu" popover role="menu" aria-labelledby="trigger">
    <button id="cut" class="hc-menu__item" role="menuitem" type="button">Cut</button>
    <button id="more" class="hc-menu__item" role="menuitem" type="button"
            data-hc-submenu="more-sub">More tools</button>
    <div id="more-sub" class="hc-menu" role="menu" aria-label="More tools">
      <button id="inspect" class="hc-menu__item" role="menuitem" type="button">Inspect</button>
      <button id="saveas" class="hc-menu__item" role="menuitem" type="button">Save as…</button>
    </div>
    <button id="paste" class="hc-menu__item" role="menuitem" type="button">Paste</button>
  </div>
`;

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}
function hover(el) {
  el.dispatchEvent(new Event('pointerover', { bubbles: true }));
}
const $ = (id) => document.getElementById(id);

// jsdom has no popover algorithm. Shim show/hidePopover so that they keep the
// `:popover-open` state (matched via a data-open-stub attribute) AND fire the
// toggle events the behavior listens to, so isOpen() and aria-expanded sync.
function fireToggle(el, state) {
  for (const type of ['beforetoggle', 'toggle']) {
    const e = new Event(type);
    Object.defineProperty(e, 'newState', { value: state });
    el.dispatchEvent(e);
  }
}
HTMLElement.prototype.showPopover = function showPopover() {
  this.setAttribute('data-open-stub', '');
  fireToggle(this, 'open');
};
HTMLElement.prototype.hidePopover = function hidePopover() {
  this.removeAttribute('data-open-stub');
  fireToggle(this, 'closed');
};
const ORIG_MATCHES = Element.prototype.matches;
Element.prototype.matches = function matches(sel) {
  if (sel === ':popover-open') return this.hasAttribute('data-open-stub');
  return ORIG_MATCHES.call(this, sel);
};
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { supports: () => false, escape: (s) => String(s) };
}

function openRoot() {
  $('root').showPopover();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('submenu (installMenu)', () => {
  it('wires aria-haspopup / aria-expanded / aria-controls on the parent item', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    const more = $('more');
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-controls')).toBe('more-sub');
    // The submenu element is marked for the inline-end placement rule.
    expect($('more-sub').hasAttribute('data-submenu')).toBe(true);
    expect($('more-sub').getAttribute('popover')).toBe('auto');
  });

  it('roving focus in the root skips items inside the submenu', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    $('cut').focus();
    press($('root'), 'ArrowDown'); // → More
    expect(document.activeElement.id).toBe('more');
    press($('root'), 'ArrowDown'); // → Paste (NOT into the submenu)
    expect(document.activeElement.id).toBe('paste');
  });

  it('ArrowRight opens the submenu and focuses its first item', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    $('more').focus();
    press($('more'), 'ArrowRight');
    expect($('more').getAttribute('aria-expanded')).toBe('true');
    expect($('more-sub').matches(':popover-open')).toBe(true);
    expect(document.activeElement.id).toBe('inspect');
  });

  it('ArrowLeft closes the submenu and returns focus to the parent', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    $('more').focus();
    press($('more'), 'ArrowRight');
    expect(document.activeElement.id).toBe('inspect');

    press(document.activeElement, 'ArrowLeft');
    expect($('more-sub').matches(':popover-open')).toBe(false);
    expect($('more').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement.id).toBe('more');
  });

  it('clicking the parent toggles the submenu open then closed', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    click($('more'));
    expect($('more-sub').matches(':popover-open')).toBe(true);
    expect(document.activeElement.id).toBe('inspect'); // click opens + focuses first
    click($('more'));
    expect($('more-sub').matches(':popover-open')).toBe(false);
    expect(document.activeElement.id).toBe('more'); // focus returns to the parent
  });

  it('hovering the parent opens the submenu without stealing focus', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    $('cut').focus();
    hover($('more'));
    expect($('more-sub').matches(':popover-open')).toBe(true);
    expect(document.activeElement.id).toBe('cut'); // hover does not move focus
  });

  it('hovering a sibling closes an open submenu', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    hover($('more'));
    expect($('more-sub').matches(':popover-open')).toBe(true);
    hover($('paste'));
    expect($('more-sub').matches(':popover-open')).toBe(false);
  });

  it('selecting a leaf in the submenu closes the whole tree (root hides)', () => {
    document.body.innerHTML = TREE;
    uninstall = installMenu();
    openRoot();
    const rootHide = vi.spyOn($('root'), 'hidePopover');
    const events = [];
    document.body.addEventListener('hc:menuselect', (e) => events.push(e.detail));

    click($('more')); // open submenu
    click($('inspect')); // select leaf

    expect(events).toHaveLength(1);
    expect(events[0].item).toBe($('inspect'));
    expect(events[0].menu).toBe($('more-sub')); // owning menu is the submenu
    expect(rootHide).toHaveBeenCalled();
  });

  it('uninstall removes the submenu ARIA and stops toggling', () => {
    document.body.innerHTML = TREE;
    const u = installMenu();
    openRoot();
    u();
    const more = $('more');
    expect(more.hasAttribute('aria-haspopup')).toBe(false);
    expect(more.hasAttribute('aria-controls')).toBe(false);
    expect($('more-sub').hasAttribute('data-submenu')).toBe(false);
    // Click no longer toggles the submenu.
    click(more);
    expect($('more-sub').matches(':popover-open')).toBe(false);
    uninstall = () => {};
  });
});
