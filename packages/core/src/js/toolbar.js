// installToolbar — WAI-ARIA APG keyboard navigation for hc-toolbar.
//
// Upgrades every `.hc-toolbar[role="toolbar"]` into a single Tab stop with
// roving-tabindex arrow-key navigation (the APG Toolbar pattern). The plain
// `.hc-toolbar` layout class works without this behavior; only toolbars that
// opt in with `role="toolbar"` become keyboard-navigable.
//
//   • The toolbar is one Tab stop. Tab / Shift+Tab move into and out of the
//     whole toolbar; the controls inside are reached with the arrow keys.
//   • Arrow keys move focus along the toolbar's axis — ←/→ for a horizontal
//     toolbar (default), ↑/↓ when `aria-orientation="vertical"`. Movement
//     wraps at the ends. In RTL the horizontal arrows are mirrored.
//   • Home / End jump to the first / last control.
//   • Disabled controls (`disabled` / `aria-disabled="true"`) and hidden
//     controls are skipped.
//   • The last focused control stays the Tab stop, so focus returns where you
//     left it (set on focus, including clicks).
//
// Toolbar nav only MOVES focus — it never activates anything. Buttons keep
// their native Space / Enter activation. A text-entry or value control
// (`input`, `textarea`, `select`) inside the toolbar keeps the on-axis arrow
// for its own caret / value; use Home / End to jump past it to the toolbar
// ends.
//
// Controls inside a NESTED `.hc-toolbar` belong to that toolbar, not this one.
//
// installToolbar(root = document) returns an idempotent uninstaller. Repeated
// calls on the same root return the same uninstaller.

const INSTALL_KEY = '__hcToolbarUninstall';
const TOOLBAR = '.hc-toolbar[role="toolbar"]';

// Focusable controls a toolbar roves over.
const WIDGETS = 'button, a[href], input, select, textarea';

function isHorizontal(toolbar) {
  return toolbar.getAttribute('aria-orientation') !== 'vertical';
}

function isRtl(toolbar) {
  return getComputedStyle(toolbar).direction === 'rtl';
}

// Controls that consume the arrow keys for their own caret / value. The
// toolbar yields the on-axis arrow to these so typing / adjusting still works.
function editsWithArrows(el) {
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'color', 'file', 'image'].includes(
      type,
    );
  }
  return false;
}

function isNavigable(el) {
  return (
    !el.hasAttribute('disabled') &&
    el.getAttribute('aria-disabled') !== 'true' &&
    !el.hidden &&
    el.getAttribute('aria-hidden') !== 'true'
  );
}

// Focusable controls owned by THIS toolbar (excluding any inside a nested
// `.hc-toolbar`). `all` includes disabled controls so the roving pass can park
// them out of the Tab order too.
function candidates(toolbar) {
  return [...toolbar.querySelectorAll(WIDGETS)].filter(
    (el) => el.closest('.hc-toolbar') === toolbar,
  );
}

function navigable(toolbar) {
  return candidates(toolbar).filter(isNavigable);
}

/** Make exactly one control the Tab stop; park the rest at tabindex -1. */
function setRoving(toolbar, preferred) {
  const all = candidates(toolbar);
  const nav = all.filter(isNavigable);
  let stop = preferred && nav.includes(preferred) ? preferred : null;
  // Otherwise keep the existing tab stop if it is still navigable, else the
  // first navigable control (APG: the toolbar's first control by default).
  if (!stop) stop = nav.find((el) => el.getAttribute('tabindex') === '0') ?? nav[0] ?? null;
  for (const el of all) el.setAttribute('tabindex', el === stop ? '0' : '-1');
}

function move(toolbar, current, delta) {
  const nav = navigable(toolbar);
  const i = nav.indexOf(current);
  if (i === -1) return;
  const next = nav[(i + delta + nav.length) % nav.length];
  next.focus();
  setRoving(toolbar, next);
}

function focusEdge(toolbar, edge) {
  const nav = navigable(toolbar);
  if (nav.length === 0) return;
  const target = edge === 'first' ? nav[0] : nav[nav.length - 1];
  target.focus();
  setRoving(toolbar, target);
}

function attach(toolbar, detachers) {
  if (detachers.has(toolbar)) return;
  setRoving(toolbar, null);

  function onKeydown(event) {
    const item = event.target.closest(WIDGETS);
    if (!item || item.closest('.hc-toolbar') !== toolbar) return;

    const horizontal = isHorizontal(toolbar);
    let key = event.key;
    if (horizontal && isRtl(toolbar)) {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';

    switch (key) {
      case nextKey:
        if (editsWithArrows(item)) return; // the field's caret / value wins
        event.preventDefault();
        move(toolbar, item, +1);
        break;
      case prevKey:
        if (editsWithArrows(item)) return;
        event.preventDefault();
        move(toolbar, item, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusEdge(toolbar, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusEdge(toolbar, 'last');
        break;
      default:
        break;
    }
  }

  // Whatever control gains focus (arrow nav, Tab, or a click) becomes the
  // Tab stop, so focus returns to it next time.
  function onFocusin(event) {
    const item = event.target.closest?.(WIDGETS);
    if (!item || item.closest('.hc-toolbar') !== toolbar || !isNavigable(item)) return;
    setRoving(toolbar, item);
  }

  toolbar.addEventListener('keydown', onKeydown);
  toolbar.addEventListener('focusin', onFocusin);

  // Re-normalise the Tab stop when controls are added / removed (e.g. htmx
  // swaps), keeping the focused control as the stop where possible.
  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      const active = toolbar.ownerDocument.activeElement;
      const focused =
        active && active.closest?.('.hc-toolbar') === toolbar && isNavigable(active)
          ? active
          : null;
      setRoving(toolbar, focused);
    });
    observer.observe(toolbar, { childList: true, subtree: true });
  }

  detachers.set(toolbar, () => {
    toolbar.removeEventListener('keydown', onKeydown);
    toolbar.removeEventListener('focusin', onFocusin);
    if (observer) observer.disconnect();
  });
}

/**
 * Install the toolbar behavior on every `.hc-toolbar[role="toolbar"]` in the
 * document: a single Tab stop with APG roving-tabindex arrow-key navigation.
 * The returned uninstaller is idempotent and a no-op when not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installToolbar(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll(TOOLBAR)) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(TOOLBAR)) attach(node, detachers);
          node.querySelectorAll?.(TOOLBAR).forEach((el) => attach(el, detachers));
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
