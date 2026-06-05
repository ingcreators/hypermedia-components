import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installPopover } from '../src/js/popover.js';

let uninstall = () => {};

const ANCHORED = `
  <button id="trigger" type="button" popovertarget="pop">Filter</button>
  <div id="pop" class="hc-popover" popover data-side="bottom" data-align="start">
    <p>Choose filters.</p>
  </div>
`;

const PLAIN = `
  <button id="t2" type="button" popovertarget="pop2">Open</button>
  <div id="pop2" class="hc-popover" popover>
    <p>Centred popover.</p>
  </div>
`;

// jsdom shims (no popover algorithm / CSS interface).
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('open', '');
  };
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('open');
  };
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { supports: () => false, escape: (s) => String(s) };
}

const $ = (id) => document.getElementById(id);

function fireToggle(el, state, type = 'beforetoggle') {
  const e = new Event(type);
  Object.defineProperty(e, 'newState', { value: state });
  el.dispatchEvent(e);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installPopover', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = ANCHORED;
    const u1 = installPopover();
    const u2 = installPopover();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires aria-expanded / aria-controls on the trigger for an anchored popover', () => {
    document.body.innerHTML = ANCHORED;
    uninstall = installPopover();
    const t = $('trigger');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.getAttribute('aria-controls')).toBe('pop');
  });

  it('leaves a plain popover (no data-side) untouched', () => {
    document.body.innerHTML = PLAIN;
    uninstall = installPopover();
    expect($('t2').hasAttribute('aria-expanded')).toBe(false);
    expect($('t2').hasAttribute('aria-controls')).toBe(false);
  });

  it('syncs aria-expanded on toggle', () => {
    document.body.innerHTML = ANCHORED;
    uninstall = installPopover();
    const t = $('trigger');
    fireToggle($('pop'), 'open', 'toggle');
    expect(t.getAttribute('aria-expanded')).toBe('true');
    fireToggle($('pop'), 'closed', 'toggle');
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  it('positions via the JS fallback on open when Anchor Positioning is unsupported', () => {
    document.body.innerHTML = ANCHORED;
    uninstall = installPopover();
    const pop = $('pop');
    fireToggle(pop, 'open');
    expect(pop.style.position).toBe('fixed');
  });

  it('injects anchor-name + position-anchor when CSS supports it', () => {
    document.body.innerHTML = ANCHORED;
    const orig = CSS.supports;
    CSS.supports = (prop) => (prop === 'anchor-name' ? true : orig.call(CSS, prop));
    uninstall = installPopover();
    expect($('trigger').style.getPropertyValue('anchor-name')).toBe('--hc-popover-pop');
    expect($('pop').style.getPropertyValue('position-anchor')).toBe('--hc-popover-pop');
    CSS.supports = orig;
  });

  it('uninstall removes ARIA + inline styles and stops positioning', () => {
    document.body.innerHTML = ANCHORED;
    const u = installPopover();
    const t = $('trigger');
    const pop = $('pop');
    u();
    expect(t.hasAttribute('aria-expanded')).toBe(false);
    expect(t.hasAttribute('aria-controls')).toBe(false);
    fireToggle(pop, 'open');
    expect(pop.style.position).toBe(''); // no longer positioned
    uninstall = () => {};
  });

  it('picks up an anchored popover added after install (MutationObserver)', async () => {
    uninstall = installPopover();
    const wrap = document.createElement('div');
    wrap.innerHTML = ANCHORED;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    await new Promise((r) => setTimeout(r, 0));
    expect($('trigger').getAttribute('aria-controls')).toBe('pop');
  });
});
