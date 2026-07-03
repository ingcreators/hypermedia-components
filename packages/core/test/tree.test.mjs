import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installTree } from '../src/js/tree.js';

let uninstall = () => {};

const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));

function press(el, key, opts = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// A 3-level fixture: src (open) > components (closed) + app.js link;
// docs (closed); README leaf.
const FIXTURE = `
  <ul class="hc-tree" id="tree" aria-label="Files">
    <li class="hc-tree__item" id="src" aria-expanded="true">
      <span class="hc-tree__row"><span class="hc-tree__toggle" aria-hidden="true"></span>
        <span class="hc-tree__label">src</span></span>
      <ul class="hc-tree__group">
        <li class="hc-tree__item" id="components" aria-expanded="false">
          <span class="hc-tree__row"><span class="hc-tree__toggle" aria-hidden="true"></span>
            <span class="hc-tree__label">components</span></span>
          <ul class="hc-tree__group">
            <li class="hc-tree__item" id="button-js">
              <span class="hc-tree__row"><span class="hc-tree__label">button.js</span></span>
            </li>
          </ul>
        </li>
        <li class="hc-tree__item" id="app-js">
          <span class="hc-tree__row"><span class="hc-tree__label"><a href="/files/app.js" id="app-link">app.js</a></span></span>
        </li>
      </ul>
    </li>
    <li class="hc-tree__item" id="docs" aria-expanded="false">
      <span class="hc-tree__row"><span class="hc-tree__toggle" aria-hidden="true"></span>
        <span class="hc-tree__label">docs</span></span>
      <ul class="hc-tree__group">
        <li class="hc-tree__item" id="intro"><span class="hc-tree__row"><span class="hc-tree__label">intro.md</span></span></li>
      </ul>
    </li>
    <li class="hc-tree__item" id="readme">
      <span class="hc-tree__row"><span class="hc-tree__label">README.md</span></span>
    </li>
  </ul>`;

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('installTree', () => {
  it('is idempotent and applies the roles + roving tabindex', () => {
    uninstall = installTree();
    expect(installTree()).toBe(uninstall);
    expect($('tree').getAttribute('role')).toBe('tree');
    expect($('src').getAttribute('role')).toBe('treeitem');
    expect($('components').querySelector('.hc-tree__group').getAttribute('role')).toBe('group');
    expect($('src').tabIndex).toBe(0); // first visible = tab stop
    expect($('docs').tabIndex).toBe(-1);
  });

  it('↑/↓ traverse VISIBLE items only (collapsed subtrees skipped)', () => {
    uninstall = installTree();
    $('src').focus();
    press($('src'), 'ArrowDown');
    expect(document.activeElement.id).toBe('components');
    press($('components'), 'ArrowDown'); // button.js is hidden (collapsed)
    expect(document.activeElement.id).toBe('app-js');
    press($('app-js'), 'ArrowDown');
    expect(document.activeElement.id).toBe('docs');
    press($('docs'), 'ArrowDown'); // intro.md hidden
    expect(document.activeElement.id).toBe('readme');
    press($('readme'), 'ArrowUp');
    expect(document.activeElement.id).toBe('docs');
  });

  it('→ opens then descends; ← closes then ascends', () => {
    uninstall = installTree();
    $('components').focus();
    press($('components'), 'ArrowRight'); // open
    expect($('components').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement.id).toBe('components'); // focus stays
    press($('components'), 'ArrowRight'); // descend
    expect(document.activeElement.id).toBe('button-js');
    press($('button-js'), 'ArrowLeft'); // leaf → parent
    expect(document.activeElement.id).toBe('components');
    press($('components'), 'ArrowLeft'); // close
    expect($('components').getAttribute('aria-expanded')).toBe('false');
    press($('components'), 'ArrowLeft'); // closed branch → parent
    expect(document.activeElement.id).toBe('src');
  });

  it('Home/End jump to the first/last visible item', () => {
    uninstall = installTree();
    $('app-js').focus();
    press($('app-js'), 'End');
    expect(document.activeElement.id).toBe('readme');
    press($('readme'), 'Home');
    expect(document.activeElement.id).toBe('src');
  });

  it('Enter follows the label link when there is one, else toggles the branch', () => {
    uninstall = installTree();
    const onClick = vi.fn((e) => e.preventDefault());
    $('app-link').addEventListener('click', onClick);
    $('app-js').focus();
    press($('app-js'), 'Enter');
    expect(onClick).toHaveBeenCalledTimes(1);

    $('docs').focus();
    press($('docs'), 'Enter');
    expect($('docs').getAttribute('aria-expanded')).toBe('true');
  });

  it('type-ahead jumps to the next visible item starting with the character', () => {
    uninstall = installTree();
    $('src').focus();
    press($('src'), 'r');
    expect(document.activeElement.id).toBe('readme');
    press($('readme'), 'd');
    expect(document.activeElement.id).toBe('docs');
  });

  it('mirrors ←/→ in RTL', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, ...rest) => {
      const cs = original.call(window, el, ...rest);
      return new Proxy(cs, { get: (t, p) => (p === 'direction' ? 'rtl' : t[p]) });
    });
    uninstall = installTree();
    $('components').focus();
    press($('components'), 'ArrowLeft'); // mirrored → = open
    expect($('components').getAttribute('aria-expanded')).toBe('true');
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('dir');
  });

  it('dispatches hc:treeexpand on expansion and marks empty lazy groups busy until children arrive', async () => {
    document.body.innerHTML = `
      <ul class="hc-tree" id="tree">
        <li class="hc-tree__item" id="lazy" aria-expanded="false"
            data-hx-get="/nodes/1/children"
            data-hx-target="find .hc-tree__group"
            data-hx-swap="innerHTML"
            data-hx-trigger="hc:treeexpand once">
          <span class="hc-tree__row"><span class="hc-tree__toggle" aria-hidden="true"></span>
            <span class="hc-tree__label">Reports</span></span>
          <ul class="hc-tree__group" id="lazy-group"></ul>
        </li>
      </ul>`;
    uninstall = installTree();
    const onExpand = vi.fn();
    document.body.addEventListener('hc:treeexpand', (e) => onExpand(e.detail));

    click($('lazy').querySelector('.hc-tree__toggle'));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand.mock.calls[0][0].item).toBe($('lazy'));
    expect($('lazy-group').getAttribute('aria-busy')).toBe('true');

    // The htmx swap arrives:
    $('lazy-group').innerHTML = '<li class="hc-tree__item" id="child"><span class="hc-tree__row"><span class="hc-tree__label">Q1</span></span></li>';
    await tick();
    expect($('lazy-group').hasAttribute('aria-busy')).toBe(false);
    expect($('child').getAttribute('role')).toBe('treeitem'); // roles re-applied
  });

  it('picks up a tree swapped in after install and keeps swapped-in items navigable', async () => {
    document.body.innerHTML = '';
    uninstall = installTree();
    document.body.innerHTML = FIXTURE;
    await tick();
    expect($('tree').getAttribute('role')).toBe('tree');
    expect($('src').tabIndex).toBe(0);
  });

  it('uninstall removes the listeners', () => {
    const u = installTree();
    u();
    $('src').focus();
    press($('src'), 'ArrowDown');
    expect(document.activeElement.id).toBe('src'); // no move
  });
});
