// installMenubar — the desktop application menu bar pattern (File / Edit / …).
//
//   <div class="hc-menubar" role="menubar" aria-label="Main">
//     <button class="hc-menubar__item" role="menuitem" type="button"
//             popovertarget="m-file">File</button>
//     <div class="hc-menu" id="m-file" popover role="menu" aria-label="File">…</div>
//     <button class="hc-menubar__item" role="menuitem" type="button"
//             popovertarget="m-edit">Edit</button>
//     <div class="hc-menu" id="m-edit" popover role="menu" aria-label="Edit">…</div>
//   </div>
//
// A composition over the existing primitives: the dropdowns are ordinary
// `.hc-menu` popovers (installMenu wires their ARIA, in-menu keyboard, and
// submenus via the B1 machinery). This behavior adds the menubar layer:
//
//   - Roving tabindex across the top items — the bar is one Tab stop; ←/→
//     (mirrored in RTL) and Home/End move between top items. RTL-aware.
//   - ↓ / ↑ open the focused item's menu (focusing the first / last item);
//     Enter / Space / click open it natively via popovertarget.
//   - While a menu is open, ←/→ at the menu's top level move to the adjacent
//     menubar menu and open it (a submenu parent still opens its submenu on
//     →, deferring to the submenu machinery). Escape closes via the native
//     popover and returns focus to the top item.
//
// installMenubar(root = document) returns an idempotent uninstaller. Pairs
// with installMenu (both run in the default auto-init bundle).

import { ITEM_ROLE_SELECTOR, isEnabled, focusFirst, focusLast } from './menu-core.js';
import { isSubmenuParent } from './submenu.js';

const INSTALL_KEY = '__hcMenubarUninstall';
const MENUBAR = '.hc-menubar[role="menubar"]';

function isRtl(el) {
  const view = el.ownerDocument.defaultView;
  return view ? view.getComputedStyle(el).direction === 'rtl' : false;
}

// Top-level menu buttons of THIS menubar (not items inside a dropdown).
function topItems(menubar) {
  return Array.from(menubar.querySelectorAll('[role="menuitem"]')).filter(
    (it) => it.closest('.hc-menu') == null && it.closest('[role="menubar"]') === menubar,
  );
}

function menuFor(item) {
  const id = item.getAttribute('popovertarget') || item.getAttribute('aria-controls');
  return id ? item.ownerDocument.getElementById(id) : null;
}

function setRoving(menubar, preferred) {
  const tops = topItems(menubar);
  const enabled = tops.filter(isEnabled);
  let stop = preferred && enabled.includes(preferred) ? preferred : null;
  if (!stop) {
    stop = enabled.find((el) => el.getAttribute('tabindex') === '0') ?? enabled[0] ?? null;
  }
  for (const el of tops) el.setAttribute('tabindex', el === stop ? '0' : '-1');
}

function moveTop(menubar, current, delta) {
  const enabled = topItems(menubar).filter(isEnabled);
  const i = enabled.indexOf(current);
  if (i === -1) return;
  const next = enabled[(i + delta + enabled.length) % enabled.length];
  next.focus();
  setRoving(menubar, next);
}

function focusEdgeTop(menubar, edge) {
  const enabled = topItems(menubar).filter(isEnabled);
  if (!enabled.length) return;
  const target = edge === 'first' ? enabled[0] : enabled[enabled.length - 1];
  target.focus();
  setRoving(menubar, target);
}

function openMenuOf(item, where) {
  const menu = menuFor(item);
  if (!menu || typeof menu.showPopover !== 'function') return;
  try {
    menu.showPopover();
  } catch {
    /* already open / not connected */
  }
  if (where === 'last') focusLast(menu);
  else focusFirst(menu);
}

function attach(menubar, detachers) {
  if (detachers.has(menubar)) return;
  const cleanups = [];
  setRoving(menubar, null);

  // Bar level: roving + open. Only fires for the top items (dropdown items
  // bubble here too but are filtered out).
  function onBarKey(e) {
    const item = e.target.closest?.('[role="menuitem"]');
    if (!item || !topItems(menubar).includes(item)) return;
    const rtl = isRtl(menubar);
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    switch (e.key) {
      case nextKey:
        e.preventDefault();
        moveTop(menubar, item, +1);
        break;
      case prevKey:
        e.preventDefault();
        moveTop(menubar, item, -1);
        break;
      case 'Home':
        e.preventDefault();
        focusEdgeTop(menubar, 'first');
        break;
      case 'End':
        e.preventDefault();
        focusEdgeTop(menubar, 'last');
        break;
      case 'ArrowDown':
        e.preventDefault();
        openMenuOf(item, 'first');
        break;
      case 'ArrowUp':
        e.preventDefault();
        openMenuOf(item, 'last');
        break;
      default:
        break;
    }
  }

  function onBarFocusin(e) {
    const item = e.target.closest?.('[role="menuitem"]');
    if (item && topItems(menubar).includes(item)) setRoving(menubar, item);
  }

  menubar.addEventListener('keydown', onBarKey);
  menubar.addEventListener('focusin', onBarFocusin);
  cleanups.push(() => {
    menubar.removeEventListener('keydown', onBarKey);
    menubar.removeEventListener('focusin', onBarFocusin);
  });

  // Open-menu level: ←/→ at a top menu's root switch to the adjacent menu.
  function switchFrom(currentTopItem, delta) {
    const tops = topItems(menubar).filter(isEnabled);
    const i = tops.indexOf(currentTopItem);
    if (i === -1) return;
    const nextItem = tops[(i + delta + tops.length) % tops.length];
    const currentMenu = menuFor(currentTopItem);
    if (currentMenu && typeof currentMenu.hidePopover === 'function') {
      try {
        currentMenu.hidePopover();
      } catch {
        /* already closed */
      }
    }
    setRoving(menubar, nextItem);
    openMenuOf(nextItem, 'first');
  }

  for (const item of topItems(menubar)) {
    const menu = menuFor(item);
    if (!menu) continue;
    const onMenuKey = (e) => {
      const focusItem = e.target.closest?.(ITEM_ROLE_SELECTOR);
      const owning = (focusItem ?? e.target).closest?.('.hc-menu');
      if (owning !== menu) return; // inside a submenu — leave it to submenu.js
      const rtl = isRtl(menu);
      const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === nextKey) {
        if (focusItem && isSubmenuParent(focusItem)) return; // → opens the submenu
        e.preventDefault();
        switchFrom(item, +1);
      } else if (e.key === prevKey) {
        e.preventDefault();
        switchFrom(item, -1);
      }
    };
    menu.addEventListener('keydown', onMenuKey);
    cleanups.push(() => menu.removeEventListener('keydown', onMenuKey));
  }

  detachers.set(menubar, () => {
    for (const c of cleanups) c();
  });
}

/**
 * Install the menubar behavior on every `.hc-menubar[role="menubar"]` in the
 * document. Adds roving-tabindex navigation across the top items and
 * cross-menu ←/→ switching while a menu is open. Pairs with installMenu,
 * which owns the dropdown internals.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installMenubar(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll(MENUBAR)) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(MENUBAR)) attach(node, detachers);
          node.querySelectorAll?.(MENUBAR).forEach((el) => attach(el, detachers));
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
