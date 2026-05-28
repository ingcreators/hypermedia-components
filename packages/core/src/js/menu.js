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

function itemsOf(menu) {
  return Array.from(menu.querySelectorAll(':scope > [role="menuitem"]'));
}

function isEnabled(item) {
  return !(
    item.hasAttribute('disabled') ||
    item.getAttribute('aria-disabled') === 'true'
  );
}

function focusByIndex(menu, idx) {
  const enabled = itemsOf(menu).filter(isEnabled);
  if (enabled.length === 0) return;
  const n = enabled.length;
  enabled[((idx % n) + n) % n].focus();
}

function focusFirst(menu) {
  focusByIndex(menu, 0);
}

function focusLast(menu) {
  const n = itemsOf(menu).filter(isEnabled).length;
  if (n > 0) focusByIndex(menu, n - 1);
}

function focusByOffset(menu, current, delta) {
  const enabled = itemsOf(menu).filter(isEnabled);
  if (enabled.length === 0) return;
  const i = enabled.indexOf(current);
  // If focus is elsewhere (e.g. the menu container), treat as
  // "before first item" so ArrowDown goes to index 0.
  const base = i === -1 ? (delta > 0 ? -1 : 0) : i;
  focusByIndex(menu, base + delta);
}

function typeaheadStep(menu, current, ch) {
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
    const r = trigger.getBoundingClientRect();
    Object.assign(menu.style, {
      position: 'fixed',
      insetBlockStart: `${r.bottom + 4}px`,
      insetInlineStart: `${r.left}px`,
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
    const current = menu.ownerDocument.activeElement;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusByOffset(menu, current, +1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusByOffset(menu, current, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusFirst(menu);
        break;
      case 'End':
        event.preventDefault();
        focusLast(menu);
        break;
      case 'Tab':
        // Tab closes the menu (APG). Native popover would not
        // intercept; explicitly close so focus moves outside.
        event.preventDefault();
        menu.hidePopover();
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey) {
          typeaheadStep(menu, current, event.key);
        }
        break;
    }
  }

  function onClick(event) {
    const item = event.target.closest('[role="menuitem"]');
    if (!item || !menu.contains(item) || !isEnabled(item)) return;
    menu.dispatchEvent(
      new CustomEvent('hc:menuselect', {
        bubbles: true,
        detail: { item, menu, trigger },
      }),
    );
    menu.hidePopover();
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
