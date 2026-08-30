import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installNavmenu } from '../src/js/navmenu.js';

let uninstall = () => {};

// jsdom has no popover algorithm — shim show/hide with a newState toggle.
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('open', '');
    const ev = new Event('toggle');
    ev.newState = 'open';
    this.dispatchEvent(ev);
  };
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('open');
    const ev = new Event('toggle');
    ev.newState = 'closed';
    this.dispatchEvent(ev);
  };
}

const MARKUP = `
  <nav class="hc-navmenu" aria-label="Main">
    <ul class="hc-navmenu__list">
      <li class="hc-navmenu__item">
        <button class="hc-navmenu__trigger" type="button" data-hc-navmenu-trigger
                aria-controls="nm-a" data-testid="t-a">Products</button>
        <div class="hc-navmenu__panel" id="nm-a" data-testid="p-a">
          <a class="hc-navmenu__link" href="#one" data-testid="a-one">One</a>
          <a class="hc-navmenu__link" href="#two" data-testid="a-two">Two</a>
        </div>
      </li>
      <li class="hc-navmenu__item">
        <button class="hc-navmenu__trigger" type="button" data-hc-navmenu-trigger
                aria-controls="nm-b" data-testid="t-b">Company</button>
        <div class="hc-navmenu__panel" id="nm-b" data-testid="p-b">
          <a class="hc-navmenu__link" href="#about" data-testid="b-about">About</a>
        </div>
      </li>
    </ul>
  </nav>
`;

const id = (t) => document.querySelector(`[data-testid="${t}"]`);
const open = (panel) => panel.hasAttribute('open');
function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('installNavmenu', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = MARKUP;
    const u1 = installNavmenu();
    const u2 = installNavmenu();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires aria-haspopup / aria-expanded / aria-controls on triggers', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    expect(id('t-a').getAttribute('aria-haspopup')).toBe('true');
    expect(id('t-a').getAttribute('aria-expanded')).toBe('false');
    expect(id('t-a').getAttribute('aria-controls')).toBe('nm-a');
  });

  it('focusing a trigger opens its panel', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').focus();
    expect(open(id('p-a'))).toBe(true);
    expect(id('t-a').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens only one panel at a time', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').focus();
    expect(open(id('p-a'))).toBe(true);
    id('t-b').focus();
    expect(open(id('p-b'))).toBe(true);
    expect(open(id('p-a'))).toBe(false);
    expect(id('t-a').getAttribute('aria-expanded')).toBe('false');
  });

  it('rebinds when the trigger list is re-rendered inside the surviving nav', async () => {
    document.body.innerHTML = MARKUP;
    const list = document.querySelector('.hc-navmenu__list');
    const pristine = list.innerHTML;
    uninstall = installNavmenu();
    // The server re-renders the items (an active-section swap): the nav
    // survives, every trigger and panel is fresh and unwired.
    list.innerHTML = pristine;
    await new Promise((r) => setTimeout(r, 0));
    const t = id('t-a');
    expect(t.getAttribute('aria-haspopup')).toBe('true');
    expect(t.getAttribute('aria-controls')).toBe('nm-a');
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(open(id('p-a'))).toBe(true);
  });

  it('hover opens after a short delay', () => {
    vi.useFakeTimers();
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').dispatchEvent(new Event('mouseenter'));
    expect(open(id('p-a'))).toBe(false); // not yet — debounced
    vi.advanceTimersByTime(200);
    expect(open(id('p-a'))).toBe(true);
  });

  it('ArrowDown opens the panel and moves focus to the first link', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    press(id('t-a'), 'ArrowDown');
    expect(open(id('p-a'))).toBe(true);
    expect(document.activeElement).toBe(id('a-one'));
  });

  it('Escape closes the open panel and returns focus to the trigger', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').focus();
    expect(open(id('p-a'))).toBe(true);
    press(id('a-one'), 'Escape');
    expect(open(id('p-a'))).toBe(false);
    expect(document.activeElement).toBe(id('t-a'));
  });

  it('clicking a trigger toggles its panel', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').click();
    expect(open(id('p-a'))).toBe(true);
    id('t-a').click();
    expect(open(id('p-a'))).toBe(false);
  });

  it('does not intercept clicks on plain links inside a panel', () => {
    document.body.innerHTML = MARKUP;
    uninstall = installNavmenu();
    id('t-a').focus(); // open the panel
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    id('a-one').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('stops responding after uninstall', () => {
    document.body.innerHTML = MARKUP;
    const u = installNavmenu();
    u();
    uninstall = () => {};
    id('t-a').focus();
    expect(open(id('p-a'))).toBe(false);
  });
});
