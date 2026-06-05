// submenu.js — WAI-ARIA APG submenu support shared by installMenu /
// installContextMenu.
//
// A submenu is a `menuitem` (the "parent") that owns a nested `.hc-menu`
// popover. Author it by nesting the submenu inside the root menu's DOM and
// pointing the parent item at it with `data-hc-submenu="<submenu-id>"`:
//
//   <div class="hc-menu" id="root" popover role="menu">
//     <button class="hc-menu__item" role="menuitem" type="button">Cut</button>
//     <button class="hc-menu__item" role="menuitem" type="button"
//             data-hc-submenu="more">More tools</button>
//     <div class="hc-menu" id="more" popover role="menu" aria-label="More tools">
//       <button class="hc-menu__item" role="menuitem" type="button">Inspect</button>
//       <button class="hc-menu__item" role="menuitem" type="button">Save as…</button>
//     </div>
//     <button class="hc-menu__item" role="menuitem" type="button">Paste</button>
//   </div>
//
// The submenu being a DOM descendant of the root popover is what keeps the
// root open when the submenu shows (the HTML popover "nested" rule). Because
// the submenu is itself a `.hc-menu`, menu-core's per-menu scoping keeps
// roving focus and type-ahead inside whichever menu currently holds focus.
//
// Behaviour:
//   - The parent item gets aria-haspopup="menu", aria-expanded, aria-controls.
//   - Open: hover the parent, click it, or press → / Enter / Space. Keyboard
//     and click open focus the submenu's first item; hover does not steal
//     focus. Hovering a sibling item closes an open submenu.
//   - Close: ← or Escape returns focus to the parent item; selecting a leaf
//     anywhere closes the whole tree (hiding the root cascades to the nested
//     popovers). RTL mirrors the open / close arrows.
//   - Placement: CSS Anchor Positioning (`.hc-menu[data-submenu]`) where
//     supported, else the JS inline-end fallback in anchor-fallback.js.
//
// Internal module — not exported from the package entry.

import {
  ITEM_ROLE_SELECTOR,
  isEnabled,
  focusFirst,
  handleMenuNavKeydown,
} from './menu-core.js';
import { supportsAnchorPositioning, trackFloating } from './anchor-fallback.js';

const SUBMENU_ATTR = 'data-hc-submenu';
let submenuIdSeq = 0;

function submenuOf(item) {
  const id = item.getAttribute?.(SUBMENU_ATTR);
  return id ? item.ownerDocument.getElementById(id) : null;
}

export function isSubmenuParent(item) {
  return item != null && submenuOf(item) != null;
}

function isOpen(submenu) {
  try {
    return submenu.matches(':popover-open');
  } catch {
    return false;
  }
}

function openSubmenu(item, { focus = false } = {}) {
  const submenu = item.__hcSubmenu;
  if (!submenu || typeof submenu.showPopover !== 'function') return;
  // showPopover remembers the currently-focused element (the parent item) as
  // the focus-return target, so Escape restores focus to it.
  if (!isOpen(submenu)) submenu.showPopover();
  if (focus) focusFirst(submenu);
}

function closeSubmenu(submenu, { focusParent = false } = {}) {
  if (!submenu) return;
  if (isOpen(submenu) && typeof submenu.hidePopover === 'function') {
    submenu.hidePopover();
  }
  if (focusParent && submenu.__hcSubmenuParent) submenu.__hcSubmenuParent.focus();
}

// Open submenus whose parent item lives directly in `menu`.
function openChildSubmenus(menu) {
  const out = [];
  for (const item of menu.querySelectorAll(`[${SUBMENU_ATTR}]`)) {
    if (item.closest('.hc-menu') !== menu) continue;
    const sub = item.__hcSubmenu;
    if (sub && isOpen(sub)) out.push(sub);
  }
  return out;
}

function wireParent(item, cleanups) {
  const submenu = submenuOf(item);
  if (!submenu) return;
  if (!submenu.id) submenu.id = `hc-submenu-${(submenuIdSeq += 1)}`;
  if (!submenu.hasAttribute('popover')) submenu.setAttribute('popover', 'auto');
  if (!submenu.getAttribute('role')) submenu.setAttribute('role', 'menu');
  submenu.setAttribute('data-submenu', '');

  item.setAttribute('aria-haspopup', 'menu');
  item.setAttribute('aria-expanded', 'false');
  item.setAttribute('aria-controls', submenu.id);
  item.__hcSubmenu = submenu;
  submenu.__hcSubmenuParent = item;

  const usingAnchor = supportsAnchorPositioning();
  const anchorName = `--hc-submenu-${submenu.id}`;
  if (usingAnchor) {
    item.style.setProperty('anchor-name', anchorName);
    submenu.style.setProperty('position-anchor', anchorName);
  }
  let fallbackCleanup = null;

  function onToggle(event) {
    item.setAttribute('aria-expanded', String(event.newState === 'open'));
  }
  function onBeforeToggle(event) {
    if (usingAnchor) return;
    if (event.newState === 'open') {
      fallbackCleanup = trackFloating(submenu, item, { side: 'inline-end', gap: 2 });
    } else {
      fallbackCleanup?.();
      fallbackCleanup = null;
    }
  }
  submenu.addEventListener('toggle', onToggle);
  submenu.addEventListener('beforetoggle', onBeforeToggle);

  cleanups.push(() => {
    submenu.removeEventListener('toggle', onToggle);
    submenu.removeEventListener('beforetoggle', onBeforeToggle);
    fallbackCleanup?.();
    item.removeAttribute('aria-haspopup');
    item.removeAttribute('aria-expanded');
    item.removeAttribute('aria-controls');
    submenu.removeAttribute('data-submenu');
    if (usingAnchor) {
      item.style.removeProperty('anchor-name');
      submenu.style.removeProperty('position-anchor');
    }
    delete item.__hcSubmenu;
    delete submenu.__hcSubmenuParent;
  });
}

/**
 * Wire every submenu under `rootMenu` (at any nesting level). Returns an
 * idempotent cleanup. A no-op when the menu has no submenus.
 *
 * @param {HTMLElement} rootMenu
 * @returns {() => void}
 */
export function wireSubmenus(rootMenu) {
  const cleanups = [];
  for (const item of rootMenu.querySelectorAll(`[${SUBMENU_ATTR}]`)) {
    wireParent(item, cleanups);
  }
  if (cleanups.length === 0) return () => {};

  function onPointerOver(event) {
    const item = event.target.closest?.(ITEM_ROLE_SELECTOR);
    if (!item || !rootMenu.contains(item)) return;
    const owning = item.closest('.hc-menu');
    if (!owning) return;
    // Moving onto a sibling closes any submenu open from this menu.
    for (const sub of openChildSubmenus(owning)) {
      if (sub.__hcSubmenuParent !== item) closeSubmenu(sub);
    }
    if (isSubmenuParent(item) && isEnabled(item)) openSubmenu(item); // hover: no focus steal
  }

  function onClick(event) {
    const item = event.target.closest?.(ITEM_ROLE_SELECTOR);
    if (!item || !rootMenu.contains(item) || !isSubmenuParent(item) || !isEnabled(item)) return;
    // A submenu parent toggles its submenu instead of selecting / closing.
    event.preventDefault();
    const submenu = item.__hcSubmenu;
    if (isOpen(submenu)) closeSubmenu(submenu, { focusParent: true });
    else openSubmenu(item, { focus: true });
  }

  rootMenu.addEventListener('pointerover', onPointerOver);
  rootMenu.addEventListener('click', onClick);

  let done = false;
  return () => {
    if (done) return;
    done = true;
    rootMenu.removeEventListener('pointerover', onPointerOver);
    rootMenu.removeEventListener('click', onClick);
    for (const c of cleanups) c();
  };
}

/**
 * Handle a keydown for a whole menu tree: open a submenu from its parent
 * (→ / RTL ←), close the current submenu (← / RTL →) returning focus to its
 * parent, Tab to close the whole tree, otherwise delegate to the per-menu
 * navigation (Arrow / Home / End / type-ahead) scoped to the menu holding
 * focus. The caller gates on the root being open.
 *
 * @param {HTMLElement} rootMenu
 * @param {KeyboardEvent} event
 */
export function handleMenuTreeKeydown(rootMenu, event) {
  const item = event.target.closest?.(ITEM_ROLE_SELECTOR) ?? null;
  const owning = (item ?? event.target).closest?.('.hc-menu') ?? rootMenu;
  const rtl = owning.ownerDocument.defaultView
    ? owning.ownerDocument.defaultView.getComputedStyle(owning).direction === 'rtl'
    : false;
  const openKey = rtl ? 'ArrowLeft' : 'ArrowRight';
  const closeKey = rtl ? 'ArrowRight' : 'ArrowLeft';

  if (item && isSubmenuParent(item) && isEnabled(item) && event.key === openKey) {
    event.preventDefault();
    openSubmenu(item, { focus: true });
    return;
  }
  if (event.key === closeKey && owning !== rootMenu && owning.__hcSubmenuParent) {
    event.preventDefault();
    closeSubmenu(owning, { focusParent: true });
    return;
  }
  if (event.key === 'Tab') {
    // APG: Tab closes the entire menu (not just the current submenu).
    event.preventDefault();
    rootMenu.hidePopover?.();
    return;
  }
  handleMenuNavKeydown(owning, event);
}
