import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installThemeToggle } from '../src/js/theme-toggle.js';
import { setMessages, resetMessages } from '../src/js/i18n.js';

let uninstall = () => {};
let restoreMessages = () => {};

function renderToggle(attrs = '') {
  document.body.innerHTML = `<button type="button" data-hc-theme-toggle ${attrs}></button>`;
  return document.querySelector('[data-hc-theme-toggle]');
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  restoreMessages();
  restoreMessages = () => {};
  resetMessages();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('installThemeToggle', () => {
  it('is idempotent and returns an uninstaller', () => {
    renderToggle();
    uninstall = installThemeToggle();
    expect(installThemeToggle()).toBe(uninstall);
  });

  it('toggles data-theme on <html> (no matchMedia in jsdom → light default)', () => {
    const toggle = renderToggle();
    uninstall = installThemeToggle();

    toggle.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    toggle.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('respects an explicit data-theme already on <html>', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const toggle = renderToggle();
    uninstall = installThemeToggle();

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists with data-persist and restores at install', () => {
    const toggle = renderToggle('data-persist="hc-theme"');
    uninstall = installThemeToggle();
    toggle.click();
    expect(localStorage.getItem('hc-theme')).toBe('dark');

    // Fresh install (new page load) restores the stored theme.
    uninstall();
    document.documentElement.removeAttribute('data-theme');
    uninstall = installThemeToggle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reflects aria-pressed on every toggle and dispatches hc:themechange', () => {
    document.body.innerHTML = `
      <button type="button" data-hc-theme-toggle id="a"></button>
      <button type="button" data-hc-theme-toggle id="b"></button>
    `;
    uninstall = installThemeToggle();
    const events = [];
    document.addEventListener('hc:themechange', (e) => events.push(e.detail.theme));

    document.getElementById('a').click();
    expect(document.getElementById('a').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('b').getAttribute('aria-pressed')).toBe('true');
    expect(events).toEqual(['dark']);
  });

  it('gives an icon-only toggle a default aria-label from the catalog; authored labels win', () => {
    restoreMessages = setMessages({ 'themeToggle.label': 'テーマ切替' });
    document.body.innerHTML = `
      <button type="button" data-hc-theme-toggle id="bare"></button>
      <button type="button" data-hc-theme-toggle id="labeled" aria-label="Dunkelmodus"></button>
    `;
    uninstall = installThemeToggle();

    expect(document.getElementById('bare').getAttribute('aria-label')).toBe('テーマ切替');
    expect(document.getElementById('labeled').getAttribute('aria-label')).toBe('Dunkelmodus');
  });

  it('does nothing after uninstall', () => {
    const toggle = renderToggle();
    uninstall = installThemeToggle();
    uninstall();
    uninstall = () => {};
    toggle.click();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
