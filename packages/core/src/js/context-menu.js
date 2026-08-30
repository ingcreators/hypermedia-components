// installContextMenu — behavior for a right-click / keyboard context menu.
//
// Reuses the `.hc-menu` surface (same CSS, items, separators, labels,
// menuitemcheckbox / menuitemradio) and the shared menu-core
// interaction logic, but opens at the pointer instead of anchored to a
// trigger button. Wiring:
//
//   <div data-hc-context-menu="file-ctx"> …right-clickable region… </div>
//
//   <div class="hc-menu" id="file-ctx" popover role="menu"
//        aria-label="File actions">
//     <button class="hc-menu__item" role="menuitem" type="button">Open</button>
//     …
//   </div>
//
// The region's `data-hc-context-menu` value is the id of the `.hc-menu`
// popover to open. On `contextmenu` (right-click, long-press, or the
// keyboard Menu key) the native menu is suppressed and the popover is
// shown at the pointer, clamped to stay inside the viewport. Shift+F10
// is handled separately via `keydown` because — unlike the Menu key —
// it does NOT fire a `contextmenu` event; it opens the menu at the
// focused element. (In Firefox, Shift+right-click bypasses the
// `contextmenu` event entirely and shows the native menu; that is a
// browser behaviour we cannot intercept.)
//
// Once open, navigation (Arrow / Home / End / type-ahead / Tab) and
// selection (menuitemcheckbox / menuitemradio toggling, the bubbling
// `hc:menuselect` event) come from menu-core, identical to the
// dropdown menu. The event detail carries `contextTarget` — the
// element that was right-clicked. Escape and outside-click dismiss are
// the native `popover` behaviour, which also restores focus.
//
// installContextMenu(root = document) returns an idempotent uninstaller.

import {
  ITEM_ROLE_SELECTOR,
  isEnabled,
  focusFirst,
  selectMenuItem,
} from './menu-core.js';
import { wireSubmenus, handleMenuTreeKeydown, isSubmenuParent } from './submenu.js';

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcContextMenuUninstall';

function menuFor(region) {
  const id = region.getAttribute('data-hc-context-menu');
  if (!id) return null;
  return region.ownerDocument.getElementById(id);
}

function clampToViewport(menu, x, y) {
  const view = menu.ownerDocument.defaultView;
  const vw = view?.innerWidth ?? 0;
  const vh = view?.innerHeight ?? 0;
  const r = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  // Flip back on-screen when the menu would overflow the right /
  // bottom edge — the standard "context menu opens up-left near the
  // corner" behaviour.
  if (vw && left + r.width > vw) left = Math.max(0, vw - r.width);
  if (vh && top + r.height > vh) top = Math.max(0, vh - r.height);
  menu.style.setProperty('inset-block-start', `${top}px`);
  menu.style.setProperty('inset-inline-start', `${left}px`);
}

function openAt(menu, x, y) {
  // A stale attachment can fire in the window between a swap replacing
  // the menu and the install observer rebinding — showPopover() on a
  // disconnected node throws InvalidStateError.
  if (typeof menu.showPopover !== 'function' || !menu.isConnected) return;
  // Pin at the pointer. `position-area: none` neutralises the dropdown
  // anchor rule in hc-menu.css so our fixed coords win even when CSS
  // Anchor Positioning is supported.
  menu.style.setProperty('position', 'fixed');
  menu.style.setProperty('margin', '0');
  menu.style.setProperty('position-area', 'none');
  menu.style.setProperty('inset-block-start', `${y}px`);
  menu.style.setProperty('inset-inline-start', `${x}px`);
  // showPopover throws if already open — reposition in place instead.
  if (!menu.matches(':popover-open')) menu.showPopover();
  // The popover is in the top layer now, so its size is measurable.
  clampToViewport(menu, x, y);
  focusFirst(menu);
}

function attach(region, detachers) {
  if (detachers.has(region)) return;
  const menu = menuFor(region);
  if (!menu) return; // no target menu in the DOM — skip silently
  if (!menu.hasAttribute('popover')) menu.setAttribute('popover', 'auto');

  let contextTarget = null;

  function onContextmenu(event) {
    event.preventDefault();
    contextTarget = event.target;
    openAt(menu, event.clientX, event.clientY);
  }

  function onRegionKeydown(event) {
    // Shift+F10 does not fire `contextmenu`, so open it here. The Menu
    // key is intentionally NOT handled here — it already fires
    // `contextmenu` (handled above), and double-handling would reopen.
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      contextTarget = event.target;
      const anchor = event.target.getBoundingClientRect
        ? event.target.getBoundingClientRect()
        : region.getBoundingClientRect();
      openAt(menu, anchor.left, anchor.bottom);
    }
  }

  function onMenuKeydown(event) {
    if (!menu.matches(':popover-open')) return;
    handleMenuTreeKeydown(menu, event);
  }

  function onMenuClick(event) {
    const item = event.target.closest(ITEM_ROLE_SELECTOR);
    if (!item || !menu.contains(item) || !isEnabled(item)) return;
    if (isSubmenuParent(item)) return; // submenu toggle handled by wireSubmenus
    const owning = item.closest('.hc-menu') || menu;
    const { role } = selectMenuItem(owning, item, { contextTarget });
    // Plain menuitems close the menu; checkbox / radio keep it open.
    if (role === 'menuitem') menu.hidePopover();
  }

  const submenuCleanup = wireSubmenus(menu);

  region.addEventListener('contextmenu', onContextmenu);
  region.addEventListener('keydown', onRegionKeydown);
  menu.addEventListener('keydown', onMenuKeydown);
  menu.addEventListener('click', onMenuClick);

  const detach = () => {
    region.removeEventListener('contextmenu', onContextmenu);
    region.removeEventListener('keydown', onRegionKeydown);
    menu.removeEventListener('keydown', onMenuKeydown);
    menu.removeEventListener('click', onMenuClick);
    submenuCleanup();
  };
  // Stale when the wired menu was swapped away or the region now points
  // at a different menu — the install observer rebinds then.
  detach.stale = () => !menu.isConnected || menuFor(region) !== menu;
  detachers.set(region, detach);
}

/**
 * Install the context-menu behavior on every `[data-hc-context-menu]`
 * region in the document. The returned uninstaller is idempotent and a
 * no-op when the behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installContextMenu(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('[data-hc-context-menu]')) {
    attach(el, detachers);
  }

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      const affected = new Set();
      let menuArrived = false;
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('[data-hc-context-menu]')) affected.add(node);
          node.querySelectorAll?.('[data-hc-context-menu]').forEach((el) =>
            affected.add(el),
          );
          if (node.matches?.('.hc-menu') || node.querySelector?.('.hc-menu')) {
            menuArrived = true;
          }
        }
      }
      // The menu is id-referenced and can live anywhere, so an arriving
      // menu can complete a region attach() skipped for lack of one, or
      // stale an attachment whose menu was replaced. Re-consider every
      // region when menus arrive.
      if (menuArrived) {
        for (const el of root.querySelectorAll?.('[data-hc-context-menu]') ?? []) {
          affected.add(el);
        }
      }
      for (const region of affected) {
        const detach = detachers.get(region);
        if (detach) {
          if (!detach.stale()) continue;
          detach();
          detachers.delete(region);
        }
        attach(region, detachers);
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
