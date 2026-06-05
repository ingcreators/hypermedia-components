import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installTabs } from '../src/js/tabs.js';

let uninstall = () => {};

const SIMPLE = `
  <div class="hc-tabs" data-testid="tabs">
    <div class="hc-tabs__list" role="tablist" aria-label="Settings">
      <button type="button" class="hc-tabs__tab" role="tab"
              id="tab-a" aria-controls="panel-a" aria-selected="true"  tabindex="0">A</button>
      <button type="button" class="hc-tabs__tab" role="tab"
              id="tab-b" aria-controls="panel-b" aria-selected="false" tabindex="-1">B</button>
      <button type="button" class="hc-tabs__tab" role="tab"
              id="tab-c" aria-controls="panel-c" aria-selected="false" tabindex="-1"
              aria-disabled="true">C</button>
    </div>
    <div class="hc-tabs__panel" role="tabpanel" id="panel-a" aria-labelledby="tab-a" tabindex="0">A</div>
    <div class="hc-tabs__panel" role="tabpanel" id="panel-b" aria-labelledby="tab-b" tabindex="0" hidden>B</div>
    <div class="hc-tabs__panel" role="tabpanel" id="panel-c" aria-labelledby="tab-c" tabindex="0" hidden>C</div>
  </div>
`;

const VERTICAL = `
  <div class="hc-tabs" data-orientation="vertical" data-testid="vtabs">
    <div class="hc-tabs__list" role="tablist" aria-label="Settings">
      <button type="button" class="hc-tabs__tab" role="tab"
              id="vtab-a" aria-controls="vpanel-a" aria-selected="true"  tabindex="0">A</button>
      <button type="button" class="hc-tabs__tab" role="tab"
              id="vtab-b" aria-controls="vpanel-b" aria-selected="false" tabindex="-1">B</button>
      <button type="button" class="hc-tabs__tab" role="tab"
              id="vtab-c" aria-controls="vpanel-c" aria-selected="false" tabindex="-1">C</button>
    </div>
    <div class="hc-tabs__panel" role="tabpanel" id="vpanel-a" aria-labelledby="vtab-a" tabindex="0">A</div>
    <div class="hc-tabs__panel" role="tabpanel" id="vpanel-b" aria-labelledby="vtab-b" tabindex="0" hidden>B</div>
    <div class="hc-tabs__panel" role="tabpanel" id="vpanel-c" aria-labelledby="vtab-c" tabindex="0" hidden>C</div>
  </div>
`;

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function press(el, key) {
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

describe('installTabs', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installTabs();
    const u2 = installTabs();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('clicking a tab updates aria-selected, tabindex, and panel visibility', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');
    const pa = document.getElementById('panel-a');
    const pb = document.getElementById('panel-b');

    click(b);

    expect(a.getAttribute('aria-selected')).toBe('false');
    expect(a.getAttribute('tabindex')).toBe('-1');
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(b.getAttribute('tabindex')).toBe('0');
    // Inactive panels switch to hidden="until-found" so Ctrl+F can
    // search them; active panel has no hidden attribute at all.
    expect(pa.hasAttribute('hidden')).toBe(true);
    expect(pa.getAttribute('hidden')).toBe('until-found');
    expect(pb.hasAttribute('hidden')).toBe(false);
  });

  it('dispatches hc:tabactivated on the newly active panel', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const pb = document.getElementById('panel-b');
    let received = null;
    pb.addEventListener('hc:tabactivated', (e) => { received = e; });

    click(document.getElementById('tab-b'));
    expect(received).not.toBeNull();
    expect(received.bubbles).toBe(true);
  });

  it('manual activation (default) — arrow keys move focus only', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');

    a.focus();
    press(a, 'ArrowRight');
    expect(document.activeElement).toBe(b);
    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(b.getAttribute('aria-selected')).toBe('false');
  });

  it('automatic activation activates on focus', () => {
    document.body.innerHTML = SIMPLE.replace(
      'class="hc-tabs"',
      'class="hc-tabs" data-activation="automatic"',
    );
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');

    a.focus();
    press(a, 'ArrowRight');
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(a.getAttribute('aria-selected')).toBe('false');
  });

  it('Enter and Space activate the focused tab in manual mode', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');

    b.focus();
    press(b, 'Enter');
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(a.getAttribute('aria-selected')).toBe('false');

    // Space — APG calls this out explicitly.
    a.focus();
    press(a, ' ');
    expect(a.getAttribute('aria-selected')).toBe('true');
  });

  it('Home / End jump to the first / last enabled tab', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');

    b.focus();
    press(b, 'Home');
    expect(document.activeElement).toBe(a);

    press(a, 'End');
    // Tab C is disabled, so End lands on B (last enabled).
    expect(document.activeElement).toBe(b);
  });

  it('arrow keys skip disabled tabs and wrap', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');

    b.focus();
    press(b, 'ArrowRight');
    // C is disabled — wrap to A.
    expect(document.activeElement).toBe(a);

    a.focus();
    press(a, 'ArrowLeft');
    // C is disabled — wrap back to B.
    expect(document.activeElement).toBe(b);
  });

  it('horizontal: the cross-axis (up/down) arrows are ignored', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const a = document.getElementById('tab-a');
    a.focus();
    press(a, 'ArrowDown');
    expect(document.activeElement).toBe(a); // unchanged
    press(a, 'ArrowUp');
    expect(document.activeElement).toBe(a);
  });

  it('vertical: reflects data-orientation onto the tablist aria-orientation', () => {
    document.body.innerHTML = VERTICAL;
    uninstall = installTabs();
    const list = document.querySelector('[data-testid="vtabs"] [role="tablist"]');
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('vertical: Down / Up move focus along the column', () => {
    document.body.innerHTML = VERTICAL;
    uninstall = installTabs();

    const a = document.getElementById('vtab-a');
    const b = document.getElementById('vtab-b');

    a.focus();
    press(a, 'ArrowDown');
    expect(document.activeElement).toBe(b);

    press(b, 'ArrowUp');
    expect(document.activeElement).toBe(a);
  });

  it('vertical: the cross-axis (left/right) arrows are ignored', () => {
    document.body.innerHTML = VERTICAL;
    uninstall = installTabs();

    const a = document.getElementById('vtab-a');
    a.focus();
    press(a, 'ArrowRight');
    expect(document.activeElement).toBe(a); // unchanged
    press(a, 'ArrowLeft');
    expect(document.activeElement).toBe(a);
  });

  it('vertical: Home / End and activation still work', () => {
    document.body.innerHTML = VERTICAL;
    uninstall = installTabs();

    const a = document.getElementById('vtab-a');
    const c = document.getElementById('vtab-c');

    a.focus();
    press(a, 'End');
    expect(document.activeElement).toBe(c);

    press(c, 'Enter');
    expect(c.getAttribute('aria-selected')).toBe('true');
    expect(a.getAttribute('aria-selected')).toBe('false');
  });

  it('clicking a disabled tab does not activate it', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const c = document.getElementById('tab-c');
    click(c);
    expect(c.getAttribute('aria-selected')).toBe('false');
  });

  it('beforematch on a hidden panel activates the owning tab', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTabs();

    const b = document.getElementById('tab-b');
    const pb = document.getElementById('panel-b');
    pb.dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect(b.getAttribute('aria-selected')).toBe('true');
  });

  it('skips .hc-tabs without a [role="tablist"] (URL-routed variant)', () => {
    document.body.innerHTML = `
      <div class="hc-tabs">
        <nav class="hc-tabs__list" aria-label="Settings">
          <a class="hc-tabs__tab" href="?tab=a" aria-current="page" data-testid="link-a">A</a>
          <a class="hc-tabs__tab" href="?tab=b" data-testid="link-b">B</a>
        </nav>
      </div>
    `;
    uninstall = installTabs();

    const a = document.querySelector('[data-testid="link-a"]');
    let prevented = false;
    a.addEventListener('click', (e) => { prevented = e.defaultPrevented; });
    click(a);
    // Browser navigation should be untouched — no preventDefault, no
    // aria-current rewrite.
    expect(prevented).toBe(false);
    expect(a.getAttribute('aria-current')).toBe('page');
  });

  it('uninstall detaches handlers', () => {
    document.body.innerHTML = SIMPLE;
    const u = installTabs();
    u();

    const b = document.getElementById('tab-b');
    click(b);
    expect(b.getAttribute('aria-selected')).toBe('false');
    uninstall = () => {};
  });

  it('picks up .hc-tabs added after install (MutationObserver)', async () => {
    uninstall = installTabs();

    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    document.body.appendChild(wrap.firstElementChild);

    // MutationObserver fires async — wait one microtask tick.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    const a = document.getElementById('tab-a');
    const b = document.getElementById('tab-b');
    click(b);
    expect(a.getAttribute('aria-selected')).toBe('false');
    expect(b.getAttribute('aria-selected')).toBe('true');
  });
});
