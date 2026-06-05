// menu-core — shared WAI-ARIA menu interaction primitives.
//
// Used by both `installMenu` (dropdown, popovertarget-triggered) and
// `installContextMenu` (right-click / keyboard-triggered). Keeping the
// item queries, roving-focus movement, type-ahead, keyboard handling,
// and the checkbox / radio selection logic here means the two surfaces
// behave identically and the `hc:menuselect` contract stays in one
// place.
//
// None of this is exported from the package entry — it is an internal
// module shared between behaviors.

// Items can live directly under .hc-menu *or* nested inside a
// `<div role="group">` (used to scope `menuitemradio` siblings per the
// WAI-ARIA spec, and to hang a `<span class="hc-menu__label">` off of).
// Walk arbitrarily deep so keyboard navigation traverses every
// reachable item in document order.
export const ITEM_ROLE_SELECTOR =
  '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

export function itemsOf(menu) {
  // Scope to items that belong to THIS menu — not ones inside a nested
  // submenu (`.hc-menu` descendant). Each menu in a submenu tree manages its
  // own roving focus / type-ahead independently.
  return Array.from(menu.querySelectorAll(ITEM_ROLE_SELECTOR)).filter(
    (item) => item.closest('.hc-menu') === menu,
  );
}

export function isEnabled(item) {
  return !(
    item.hasAttribute('disabled') ||
    item.getAttribute('aria-disabled') === 'true'
  );
}

export function radioGroupOf(item) {
  // Nearest [role="group"] ancestor, stopping at the menu container.
  // Falls back to the menu itself so a flat list of menuitemradio
  // siblings still behaves as one group.
  return item.closest('[role="group"]') ?? item.closest('.hc-menu');
}

function focusByIndex(menu, idx) {
  const enabled = itemsOf(menu).filter(isEnabled);
  if (enabled.length === 0) return;
  const n = enabled.length;
  enabled[((idx % n) + n) % n].focus();
}

export function focusFirst(menu) {
  focusByIndex(menu, 0);
}

export function focusLast(menu) {
  const n = itemsOf(menu).filter(isEnabled).length;
  if (n > 0) focusByIndex(menu, n - 1);
}

export function focusByOffset(menu, current, delta) {
  const enabled = itemsOf(menu).filter(isEnabled);
  if (enabled.length === 0) return;
  const i = enabled.indexOf(current);
  // If focus is elsewhere (e.g. the menu container), treat as
  // "before first item" so ArrowDown goes to index 0.
  const base = i === -1 ? (delta > 0 ? -1 : 0) : i;
  focusByIndex(menu, base + delta);
}

export function typeaheadStep(menu, current, ch) {
  const enabled = itemsOf(menu).filter(isEnabled);
  if (enabled.length === 0) return;
  const i = enabled.indexOf(current);
  const lower = ch.toLowerCase();
  for (let off = 1; off <= enabled.length; off++) {
    const idx = (i + off + enabled.length) % enabled.length;
    if (enabled[idx].textContent.trim().toLowerCase().startsWith(lower)) {
      enabled[idx].focus();
      return;
    }
  }
}

/**
 * Handle the APG menu navigation keys against an open menu: Arrow
 * Up / Down, Home / End, Tab (closes), and first-letter type-ahead.
 * Returns true if the key was handled. The caller is responsible for
 * gating on the menu being open.
 */
export function handleMenuNavKeydown(menu, event) {
  const current = menu.ownerDocument.activeElement;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusByOffset(menu, current, +1);
      return true;
    case 'ArrowUp':
      event.preventDefault();
      focusByOffset(menu, current, -1);
      return true;
    case 'Home':
      event.preventDefault();
      focusFirst(menu);
      return true;
    case 'End':
      event.preventDefault();
      focusLast(menu);
      return true;
    case 'Tab':
      // Tab closes the menu (APG). Native popover would not intercept;
      // explicitly close so focus moves outside.
      event.preventDefault();
      menu.hidePopover();
      return true;
    default:
      if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey) {
        typeaheadStep(menu, current, event.key);
        return true;
      }
      return false;
  }
}

/**
 * Apply selection semantics to a clicked / activated menu item and
 * dispatch the bubbling `hc:menuselect` event. For `menuitemcheckbox`
 * the `aria-checked` flag toggles; for `menuitemradio` this item is
 * checked and every sibling in its group is cleared; plain `menuitem`
 * carries no checked state. `extraDetail` is merged into the event
 * detail (e.g. `{ trigger }` for the dropdown, `{ contextTarget }` for
 * the context menu).
 *
 * @returns {{ role: string | null, checked: boolean | undefined }}
 */
export function selectMenuItem(menu, item, extraDetail = {}) {
  const role = item.getAttribute('role');
  let checked;
  if (role === 'menuitemcheckbox') {
    // Items with no current value default to unchecked, so the first
    // click reads as "becoming checked".
    checked = item.getAttribute('aria-checked') !== 'true';
    item.setAttribute('aria-checked', String(checked));
  } else if (role === 'menuitemradio') {
    checked = true;
    const group = radioGroupOf(item);
    if (group) {
      // Stay within this menu — never clear radios in a nested submenu that
      // happens to be a DOM descendant of the same group / menu.
      const ownerMenu = item.closest('.hc-menu');
      for (const sib of group.querySelectorAll('[role="menuitemradio"]')) {
        if (sib.closest('.hc-menu') !== ownerMenu) continue;
        sib.setAttribute('aria-checked', sib === item ? 'true' : 'false');
      }
    } else {
      item.setAttribute('aria-checked', 'true');
    }
  }

  menu.dispatchEvent(
    new CustomEvent('hc:menuselect', {
      bubbles: true,
      detail: { item, menu, checked, ...extraDetail },
    }),
  );
  return { role, checked };
}
