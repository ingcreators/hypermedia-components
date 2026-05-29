// installMenu — behavior for the WAI-ARIA dropdown menu pattern.
//
// Activates every `.hc-menu` in the document that has a `popover`
// attribute and a `[popovertarget=<id>]` trigger somewhere else in
// the DOM. The behavior wires:
//
//   - ARIA on the trigger: `aria-haspopup="menu"`, `aria-expanded`
//     (kept in sync via the popover `toggle` event), `aria-controls`.
//   - CSS Anchor Positioning: an inline `anchor-name` on the trigger
//     and matching `position-anchor` on the menu, so the menu lands
//     directly under the trigger via `position-area` (see hc-menu.css).
//   - A JS positioning fallback for browsers without Anchor
//     Positioning. The HTML `popover` attribute itself only requires
//     Chromium 114 / Firefox 125 / Safari 17, so the menu remains
//     functional everywhere `popover` is supported.
//   - Roving focus inside the menu (Arrow keys, Home/End), first-
//     letter type-ahead, and disabled-item skipping per the WAI-ARIA
//     APG menu pattern.
//   - On menuitem click: dispatch a bubbling `hc:menuselect` event on
//     the menu, then close it via `hidePopover()`. Hosts can listen
//     for this event to react (htmx via `data-hx-trigger="hc:menuselect"`,
//     plain JS via addEventListener).
//
// installMenu(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller.

import {
  ITEM_ROLE_SELECTOR,
  itemsOf,
  isEnabled,
  handleMenuNavKeydown,
  selectMenuItem,
} from './menu-core.js';

const INSTALL_KEY = '__hcMenuUninstall';

function escapeAttr(s) {
  // CSS.escape is universally available in real browsers but not in
  // jsdom < 30. Fall back to a minimal escape that's sufficient for
  // ids that pass HTML's validity rules.
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return String(s).replace(/[^\w-]/g, (c) => `\\${c}`);
}

function triggerFor(menu) {
  if (!menu.id) return null;
  return menu.ownerDocument.querySelector(
    `[popovertarget="${escapeAttr(menu.id)}"]`,
  );
}

function supportsAnchorPositioning() {
  // Feature-detect once at install time; both `anchor-name` and
  // `position-anchor` ship together so checking one is sufficient.
  // jsdom does not implement `CSS.supports` — treat that as "no
  // support" so the JS positioning fallback path is exercised in
  // unit tests as well as in older real browsers.
  try {
    return typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('anchor-name', '--x');
  } catch {
    return false;
  }
}

function attach(menu, detachers) {
  if (detachers.has(menu)) return;
  if (!menu.hasAttribute('popover')) return; // Not a popover-driven menu.
  const trigger = triggerFor(menu);
  if (!trigger) return; // No popovertarget binding — skip silently.

  // ARIA wiring on the trigger.
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', menu.id);

  // CSS Anchor Positioning binding. Inline-styled so multiple menus
  // on the same page each get a unique anchor name without
  // pre-coordinated CSS.
  const anchorName = `--hc-menu-${menu.id}`;
  const usingAnchor = supportsAnchorPositioning();
  if (usingAnchor) {
    trigger.style.setProperty('anchor-name', anchorName);
    menu.style.setProperty('position-anchor', anchorName);
  }

  function positionViaFallback() {
    const t = trigger.getBoundingClientRect();
    // The popover is already in the top layer by the time
    // `beforetoggle → open` fires, so its rect is measurable.
    const m = menu.getBoundingClientRect();
    const view = menu.ownerDocument.defaultView;
    const vw = view?.innerWidth ?? 0;
    const vh = view?.innerHeight ?? 0;
    const gap = 4;

    // Primary placement: block-end span-inline-end (i.e. below the
    // trigger, aligned to its inline-start edge). Mirrors the CSS
    // `position-area: block-end span-inline-end` path so behaviour
    // is consistent across the two branches.
    let top = t.bottom + gap;
    let left = t.left;

    // flip-block: if the menu would overflow the viewport's bottom
    // edge and there is room above the trigger, flip it.
    if (top + m.height > vh && t.top - m.height - gap >= 0) {
      top = t.top - m.height - gap;
    }
    // flip-inline: if the menu would overflow the viewport's
    // inline-end edge, align it to the trigger's inline-end edge
    // instead.
    if (left + m.width > vw && t.right - m.width >= 0) {
      left = t.right - m.width;
    }

    Object.assign(menu.style, {
      position: 'fixed',
      insetBlockStart: `${top}px`,
      insetInlineStart: `${left}px`,
      margin: '0',
    });
  }

  function onToggle(event) {
    const open = event.newState === 'open';
    trigger.setAttribute('aria-expanded', String(open));
  }

  // APG: focus the first enabled item on open. Doing this via the
  // HTML `autofocus` attribute lets the browser run focus management
  // as part of the popover algorithm — no JS race against the
  // browser's own focus moves on toggle.
  let autofocused = null;
  const firstEnabled = itemsOf(menu).find(isEnabled);
  if (firstEnabled && !menu.querySelector('[autofocus]')) {
    firstEnabled.setAttribute('autofocus', '');
    autofocused = firstEnabled;
  }

  function onBeforeToggle(event) {
    if (usingAnchor) return;
    if (event.newState !== 'open') return;
    positionViaFallback();
  }

  function onKeydown(event) {
    if (!menu.matches(':popover-open')) return;
    handleMenuNavKeydown(menu, event);
  }

  function onClick(event) {
    const item = event.target.closest(ITEM_ROLE_SELECTOR);
    if (!item || !menu.contains(item) || !isEnabled(item)) return;

    const { role } = selectMenuItem(menu, item, { trigger });
    // shadcn / Radix convention: plain menuitems close the menu;
    // menuitemcheckbox / menuitemradio keep it open so users can
    // toggle multiple choices without reopening.
    if (role === 'menuitem') {
      menu.hidePopover();
    }
  }

  menu.addEventListener('toggle', onToggle);
  menu.addEventListener('beforetoggle', onBeforeToggle);
  menu.addEventListener('keydown', onKeydown);
  menu.addEventListener('click', onClick);

  detachers.set(menu, () => {
    menu.removeEventListener('toggle', onToggle);
    menu.removeEventListener('beforetoggle', onBeforeToggle);
    menu.removeEventListener('keydown', onKeydown);
    menu.removeEventListener('click', onClick);
    trigger.removeAttribute('aria-haspopup');
    trigger.removeAttribute('aria-expanded');
    trigger.removeAttribute('aria-controls');
    if (usingAnchor) {
      trigger.style.removeProperty('anchor-name');
      menu.style.removeProperty('position-anchor');
    }
    if (autofocused) autofocused.removeAttribute('autofocus');
  });
}

/**
 * Install the menu behavior on every `.hc-menu` root in the document
 * that has a `popover` attribute and a matching `[popovertarget]`
 * trigger. ARIA, anchor name, keyboard navigation, and the
 * `hc:menuselect` event are wired automatically.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installMenu(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-menu')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-menu')) attach(node, detachers);
          node.querySelectorAll?.('.hc-menu').forEach((el) =>
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
