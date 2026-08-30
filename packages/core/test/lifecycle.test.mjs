import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasRemovals, pruneDetachers } from '../src/js/lifecycle.js';
import { installMenu } from '../src/js/menu.js';
import { installDatagrid } from '../src/js/datagrid.js';
import { installMenubar } from '../src/js/menubar.js';
import { installContextMenu } from '../src/js/context-menu.js';
import { installSpy } from '../src/js/spy.js';
import { installCarousel } from '../src/js/carousel.js';
import { installSplitter } from '../src/js/splitter.js';

// jsdom has no popover algorithm or CSS global — the same shim cluster
// the menu tests use. `:popover-open` matches via an `open` attribute.
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
const ORIG_MATCHES = Element.prototype.matches;
Element.prototype.matches = function (sel) {
  if (sel === ':popover-open') return this.hasAttribute('open');
  return ORIG_MATCHES.call(this, sel);
};

const tick = () => new Promise((r) => setTimeout(r, 0));

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('lifecycle helpers', () => {
  it('pruneDetachers detaches only disconnected instances', () => {
    const stay = document.createElement('div');
    document.body.appendChild(stay);
    const gone = document.createElement('div');
    const calls = [];
    const detachers = new Map([
      [stay, () => calls.push('stay')],
      [gone, () => calls.push('gone')],
    ]);
    pruneDetachers(detachers);
    expect(calls).toEqual(['gone']);
    expect([...detachers.keys()]).toEqual([stay]);
  });

  it('hasRemovals reports removal batches', () => {
    expect(hasRemovals([{ removedNodes: [] }])).toBe(false);
    expect(hasRemovals([{ removedNodes: [] }, { removedNodes: [1] }])).toBe(true);
  });
});

describe('removal pruning (observers run the detachers)', () => {
  it('menu: removing the menu cleans the surviving trigger wiring', async () => {
    document.body.innerHTML = `
      <button id="trigger" type="button" popovertarget="m1">Open</button>
      <div id="m1" class="hc-menu" popover role="menu">
        <button class="hc-menu__item" role="menuitem" type="button">A</button>
      </div>`;
    uninstall = installMenu();
    const trigger = document.getElementById('trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    document.getElementById('m1').remove();
    await tick();
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
  });

  it('datagrid: removing the grid removes its shared overflow tooltip', async () => {
    document.body.innerHTML = `
      <div class="hc-datagrid" id="grid">
        <div class="hc-datagrid__scroll">
          <table class="hc-datagrid__table">
            <thead class="hc-datagrid__head"><tr>
              <th class="hc-datagrid__headcell" scope="col">A</th>
            </tr></thead>
            <tbody class="hc-datagrid__body">
              <tr class="hc-datagrid__row"><td class="hc-datagrid__cell">a1</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    uninstall = installDatagrid();
    expect(document.querySelector('.hc-datagrid__tooltip')).toBeTruthy();
    document.getElementById('grid').remove();
    await tick();
    expect(document.querySelector('.hc-datagrid__tooltip')).toBeNull();
  });
});

describe('stale rebinding after content swaps into a surviving root', () => {
  it('menubar: a replaced dropdown regains the cross-menu arrow switch', async () => {
    document.body.innerHTML = `
      <div class="hc-menubar" role="menubar" aria-label="Main">
        <button class="hc-menubar__item" role="menuitem" type="button" popovertarget="mb-file">File</button>
        <button class="hc-menubar__item" role="menuitem" type="button" popovertarget="mb-edit">Edit</button>
        <div class="hc-menu" id="mb-file" popover role="menu" aria-label="File">
          <button class="hc-menu__item" role="menuitem" type="button" id="f1">New</button>
        </div>
        <div class="hc-menu" id="mb-edit" popover role="menu" aria-label="Edit">
          <button class="hc-menu__item" role="menuitem" type="button" id="e1">Undo</button>
        </div>
      </div>`;
    uninstall = installMenubar();
    // The server re-renders the File dropdown out of band.
    const old = document.getElementById('mb-file');
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    await tick();
    fresh.setAttribute('open', '');
    const item = fresh.querySelector('.hc-menu__item');
    item.focus();
    item.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(document.getElementById('mb-edit').hasAttribute('open')).toBe(true);
  });

  it('context menu: a replaced menu reopens on right-click', async () => {
    document.body.innerHTML = `
      <div data-hc-context-menu="cm" id="region">target</div>
      <div class="hc-menu" id="cm" popover role="menu">
        <button class="hc-menu__item" role="menuitem" type="button">Copy</button>
      </div>`;
    uninstall = installContextMenu();
    const old = document.getElementById('cm');
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    await tick();
    document.getElementById('region').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
    );
    expect(fresh.hasAttribute('open')).toBe(true);
  });

  it('spy: a replaced section is re-observed by a fresh IntersectionObserver', async () => {
    class FakeIO {
      static instances = [];
      constructor(cb) {
        this.cb = cb;
        this.observed = new Set();
        this.disconnected = false;
        FakeIO.instances.push(this);
      }
      observe(el) {
        this.observed.add(el);
      }
      unobserve(el) {
        this.observed.delete(el);
      }
      disconnect() {
        this.disconnected = true;
        this.observed.clear();
      }
    }
    globalThis.IntersectionObserver = FakeIO;
    document.body.innerHTML = `
      <nav class="hc-toc" data-hc-spy aria-label="On this page">
        <a class="hc-toc__link" href="#s1">One</a>
      </nav>
      <section id="s1">1</section>`;
    uninstall = installSpy();
    expect(FakeIO.instances).toHaveLength(1);
    const old = document.getElementById('s1');
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    await tick();
    const last = FakeIO.instances[FakeIO.instances.length - 1];
    expect(FakeIO.instances.length).toBeGreaterThan(1);
    expect(FakeIO.instances[0].disconnected).toBe(true);
    expect(last.observed.has(fresh)).toBe(true);
    delete globalThis.IntersectionObserver;
  });

  it('carousel: a re-rendered slide set re-stamps ARIA and regenerates dots', async () => {
    document.body.innerHTML = `
      <div class="hc-carousel">
        <div class="hc-carousel__viewport">
          <div class="hc-carousel__slide">1</div>
          <div class="hc-carousel__slide">2</div>
        </div>
        <div data-hc-carousel-dots></div>
      </div>`;
    uninstall = installCarousel();
    const dots = document.querySelector('[data-hc-carousel-dots]');
    expect(dots.querySelectorAll('[data-hc-carousel-dot]')).toHaveLength(2);
    const viewport = document.querySelector('.hc-carousel__viewport');
    viewport.innerHTML = `
      <div class="hc-carousel__slide">a</div>
      <div class="hc-carousel__slide">b</div>
      <div class="hc-carousel__slide">c</div>`;
    await tick();
    const slides = viewport.querySelectorAll('.hc-carousel__slide');
    expect(slides[2].getAttribute('aria-label')).toBe('3 of 3');
    expect(dots.querySelectorAll('[data-hc-carousel-dot]')).toHaveLength(3);
  });

  it('splitter: a replaced handle is re-wired and keyboard-resizable', async () => {
    document.body.innerHTML = `
      <div class="hc-splitter">
        <div class="hc-splitter__panel">left</div>
        <div class="hc-splitter__handle"></div>
        <div class="hc-splitter__panel">right</div>
      </div>`;
    uninstall = installSplitter();
    const old = document.querySelector('.hc-splitter__handle');
    expect(old.getAttribute('role')).toBe('separator');
    const fresh = document.createElement('div');
    fresh.className = 'hc-splitter__handle';
    old.replaceWith(fresh);
    await tick();
    expect(fresh.getAttribute('role')).toBe('separator');
    const before = fresh.getAttribute('aria-valuenow');
    fresh.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(fresh.getAttribute('aria-valuenow')).not.toBe(before);
  });
});
