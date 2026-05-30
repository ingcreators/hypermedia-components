import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installShell } from '../src/js/shell.js';

let uninstall = () => {};

const FIXTURE = `
  <div class="hc-shell" id="shell">
    <header class="hc-shell__header">
      <button class="hc-shell__toggle" data-hc-shell-toggle id="toggle" type="button">Menu</button>
      <span>App</span>
    </header>
    <nav class="hc-shell__sidebar" id="nav" aria-label="Primary">
      <a href="#home" id="link-home">Home</a>
      <a href="#settings" id="link-settings">Settings</a>
    </nav>
    <main class="hc-shell__main">
      <button id="main-btn" type="button">In main</button>
    </main>
  </div>
`;

function press(el, key, opts = {}) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    }),
  );
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installShell', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installShell();
    const u2 = installShell();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires ARIA on the toggle and makes the sidebar focusable', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    expect($('toggle').getAttribute('aria-controls')).toBe('nav');
    expect($('toggle').getAttribute('aria-expanded')).toBe('false');
    expect($('nav').getAttribute('tabindex')).toBe('-1');
  });

  it('generates a sidebar id when one is missing', () => {
    document.body.innerHTML = FIXTURE.replace(' id="nav"', '');
    uninstall = installShell();
    const id = document.querySelector('.hc-shell__sidebar').id;
    expect(id).toMatch(/^hc-shell-sidebar-\d+$/);
    expect($('toggle').getAttribute('aria-controls')).toBe(id);
  });

  it('opens on toggle — sets data-sidebar, aria-expanded, and moves focus into the sidebar', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    click($('toggle'));
    expect($('shell').getAttribute('data-sidebar')).toBe('open');
    expect($('toggle').getAttribute('aria-expanded')).toBe('true');
    expect($('nav').contains(document.activeElement)).toBe(true);
  });

  it('Escape closes and restores focus to the toggle', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    $('toggle').focus();
    click($('toggle'));
    expect($('shell').getAttribute('data-sidebar')).toBe('open');

    press(document, 'Escape');
    expect($('shell').hasAttribute('data-sidebar')).toBe(false);
    expect($('toggle').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe($('toggle'));
  });

  it('toggling twice closes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    click($('toggle'));
    click($('toggle'));
    expect($('shell').hasAttribute('data-sidebar')).toBe(false);
  });

  it('a click outside the sidebar (the scrim) closes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    click($('toggle'));
    click($('main-btn'));
    expect($('shell').hasAttribute('data-sidebar')).toBe(false);
  });

  it('activating a link inside the sidebar closes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installShell();
    click($('toggle'));
    click($('link-home'));
    expect($('shell').hasAttribute('data-sidebar')).toBe(false);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installShell();
    u();
    click($('toggle'));
    expect($('shell').hasAttribute('data-sidebar')).toBe(false);
  });

  it('picks up a shell added to the DOM after install (MutationObserver)', async () => {
    uninstall = installShell();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    click($('toggle'));
    expect($('shell').getAttribute('data-sidebar')).toBe('open');
  });
});
