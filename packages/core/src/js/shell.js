// installShell — mobile-navigation behavior for hc-shell.
//
// The shell LAYOUT is pure CSS. Below the 60rem breakpoint the sidebar
// becomes an off-canvas overlay, and an overlay needs the few things CSS
// cannot do accessibly — which is all this behavior does:
//
//   - toggle [data-sidebar="open"] on the shell from the hamburger
//     ([data-hc-shell-toggle] in the header), keeping aria-expanded and
//     aria-controls in sync;
//   - on open, move focus into the sidebar and trap Tab within it;
//   - close on Escape, on a click outside the sidebar (the scrim), and on
//     activating a link inside the sidebar; restore focus to the toggle;
//   - force-close when the viewport grows back to desktop, so the shell
//     never gets stuck in the open-overlay state.
//
// It never touches the network and never lays anything out. Layout,
// breakpoint, transitions, and the scrim are all in hc-shell.css.
//
// installShell(root = document) returns an uninstaller. Repeated calls on
// the same root return the same uninstaller (idempotent).

import { t } from './i18n.js';

const INSTALL_KEY = '__hcShellUninstall';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let idSeq = 0;

function attach(shell, detachers) {
  if (detachers.has(shell)) return;

  const toggle = shell.querySelector('[data-hc-shell-toggle]');
  const sidebar = shell.querySelector('.hc-shell__sidebar');
  if (!toggle || !sidebar) return; // not enough markup to wire

  if (!sidebar.id) {
    idSeq += 1;
    sidebar.id = `hc-shell-sidebar-${idSeq}`;
  }
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.setAttribute('aria-expanded', 'false');
  if (!toggle.hasAttribute('aria-label') && !toggle.textContent.trim()) {
    toggle.setAttribute('aria-label', t('shell.toggleNav'));
  }
  // Let the sidebar receive programmatic focus as a fallback target.
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  let lastFocused = null;
  const isOpen = () => shell.getAttribute('data-sidebar') === 'open';
  const focusables = () => [...sidebar.querySelectorAll(FOCUSABLE)];

  function onKeydown(event) {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      sidebar.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !sidebar.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onDocPointer(event) {
    if (!isOpen()) return;
    if (sidebar.contains(event.target) || toggle.contains(event.target)) return;
    close();
  }

  function onSidebarClick(event) {
    // Activating a link on mobile should dismiss the overlay.
    if (event.target.closest('a[href], [data-hc-shell-close]')) close();
  }

  function open() {
    if (isOpen()) return;
    lastFocused = document.activeElement;
    shell.setAttribute('data-sidebar', 'open');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('click', onDocPointer, true);
    const items = focusables();
    (items[0] ?? sidebar).focus();
  }

  function close() {
    if (!isOpen()) return;
    shell.removeAttribute('data-sidebar');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onDocPointer, true);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  function onToggle(event) {
    event.preventDefault();
    if (isOpen()) close();
    else open();
  }

  toggle.addEventListener('click', onToggle);
  sidebar.addEventListener('click', onSidebarClick);

  // Force-close on the way back to desktop so the overlay never sticks.
  // matchMedia may be unavailable (jsdom) — guard it.
  let mql = null;
  let onMql = null;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mql = window.matchMedia('(min-width: 60rem)');
    onMql = (event) => {
      if (event.matches) close();
    };
    mql.addEventListener?.('change', onMql);
  }

  detachers.set(shell, () => {
    close();
    toggle.removeEventListener('click', onToggle);
    sidebar.removeEventListener('click', onSidebarClick);
    if (mql && onMql) mql.removeEventListener?.('change', onMql);
  });
}

/**
 * Install the application-shell behavior on every `.hc-shell` in the
 * document. Wires the mobile navigation overlay (toggle, focus trap,
 * Escape, scrim click-outside) for shells that include a
 * `[data-hc-shell-toggle]` button and a `.hc-shell__sidebar`. The desktop
 * layout needs no JavaScript.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installShell(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll('.hc-shell')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-shell')) attach(node, detachers);
          node.querySelectorAll?.('.hc-shell').forEach((el) =>
            attach(el, detachers),
          );
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    if (observer) observer.disconnect();
    for (const detach of detachers.values()) detach();
    detachers.clear();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
