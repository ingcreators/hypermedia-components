// installThemeToggle — light/dark switching for [data-hc-theme-toggle].
//
//   <button type="button" data-hc-theme-toggle data-persist="hc-theme">
//     <span class="hc-icon" aria-hidden="true">◐</span>
//   </button>
//
// Semantics:
//   - The effective theme is `data-theme` on <html> when present, else the
//     OS preference (`prefers-color-scheme`). Clicking a toggle flips it
//     and writes `data-theme="light|dark"` explicitly.
//   - `data-persist="<key>"` (optional) mirrors the choice into
//     localStorage and restores it at install. For a flash-free restore
//     on full page loads, ALSO inline the documented snippet in <head> —
//     this behavior runs too late to beat first paint.
//   - Toggles reflect state via `aria-pressed` ("true" = dark) and get a
//     default `aria-label` from the i18n catalog (`themeToggle.label`)
//     unless the author provided one. Swapped-in toggles are re-reflected
//     on `htmx:afterSwap`.
//   - Each change dispatches a bubbling `hc:themechange` event
//     (`detail: { theme }`) from the toggle.
//
// The behavior never fetches anything; install is idempotent and returns
// an uninstaller.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcThemeToggleUninstall';

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function prefersDark() {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Install light/dark theme toggling on the given root.
 *
 * @param {Document} [root]
 *   The document whose `[data-hc-theme-toggle]` controls should be wired.
 * @returns {() => void} an idempotent uninstaller.
 */
export function installThemeToggle(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const docEl = root.documentElement;

  const currentTheme = () =>
    docEl.getAttribute('data-theme') ?? (prefersDark() ? 'dark' : 'light');

  // Text that contributes to the accessible name — aria-hidden glyphs
  // (the usual ◐ / 🌙 icon) don't count.
  function hasVisibleLabel(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) return true;
      if (node.nodeType === 1 && !node.hasAttribute('aria-hidden') && node.textContent.trim()) {
        return true;
      }
    }
    return false;
  }

  function reflectAll() {
    const theme = currentTheme();
    for (const toggle of root.querySelectorAll('[data-hc-theme-toggle]')) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      if (!toggle.hasAttribute('aria-label') && !hasVisibleLabel(toggle)) {
        toggle.setAttribute('aria-label', t('themeToggle.label'));
      }
    }
  }

  function setTheme(theme, persistKey) {
    docEl.setAttribute('data-theme', theme);
    if (persistKey) writeStored(persistKey, theme);
    reflectAll();
  }

  function onClick(event) {
    const toggle = event.target?.closest?.('[data-hc-theme-toggle]');
    if (!toggle) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next, toggle.getAttribute('data-persist'));
    toggle.dispatchEvent(
      new CustomEvent('hc:themechange', { bubbles: true, detail: { theme: next } }),
    );
  }

  function onAfterSwap() {
    reflectAll();
  }

  // Restore a persisted choice (the inline head snippet is the
  // flash-free path; this covers installs without it). The first
  // persisted toggle's key wins.
  const persisted = root.querySelector('[data-hc-theme-toggle][data-persist]');
  if (persisted) {
    const stored = readStored(persisted.getAttribute('data-persist'));
    if (stored === 'light' || stored === 'dark') docEl.setAttribute('data-theme', stored);
  }
  reflectAll();

  root.addEventListener('click', onClick);
  root.addEventListener('htmx:afterSwap', onAfterSwap);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('click', onClick);
    root.removeEventListener('htmx:afterSwap', onAfterSwap);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
