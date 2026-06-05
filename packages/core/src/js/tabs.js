// installTabs — behavior for the ARIA tab pattern.
//
// Activates every `.hc-tabs` root in the document that contains a
// direct-child `[role="tablist"]`. URL-routed variants (a `<nav>` with
// `<a>` children and no ARIA tab roles) are skipped — the browser
// already handles their keyboard and focus.
//
// Per WAI-ARIA APG 1.2:
//   - Manual activation is the default (panels can be lazy-loaded via
//     htmx; we do not want every arrow key to fire a request). Opt in
//     to automatic activation with `data-activation="automatic"` on
//     the .hc-tabs root.
//   - Arrow keys move focus along the tab list; Home/End jump to the
//     first/last enabled tab. Disabled tabs are skipped.
//
// Modern progressive enhancement:
//   - Inactive panels carry `hidden="until-found"` so Ctrl+F can
//     reveal content inside them. When the browser fires `beforematch`
//     on a panel, the matching tab is auto-activated. Browsers
//     without support treat the attribute as a plain `hidden`.
//
// When a panel becomes active, an `hc:tabactivated` event is
// dispatched on the panel (bubbles). Useful for htmx lazy loading:
// `<div role="tabpanel" hx-get="…" hx-trigger="hc:tabactivated once">`.
//
// installTabs(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller.

const INSTALL_KEY = '__hcTabsUninstall';

function tablistOf(rootEl) {
  return rootEl.querySelector(':scope > [role="tablist"]');
}

function tabsOf(list) {
  return Array.from(list.querySelectorAll(':scope > [role="tab"]'));
}

function panelsOf(rootEl) {
  return Array.from(rootEl.querySelectorAll(':scope > [role="tabpanel"]'));
}

function isEnabled(tab) {
  return !(
    tab.hasAttribute('disabled') ||
    tab.getAttribute('aria-disabled') === 'true'
  );
}

function activateTab(rootEl, tab, { focus = true } = {}) {
  const list = tablistOf(rootEl);
  if (!list) return;
  const allTabs = tabsOf(list);
  const allPanels = panelsOf(rootEl);

  for (const t of allTabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.setAttribute('tabindex', selected ? '0' : '-1');
  }
  for (const p of allPanels) {
    const owner = allTabs.find((t) => t.getAttribute('aria-controls') === p.id);
    const selected = owner === tab;
    if (selected) {
      p.removeAttribute('hidden');
      p.dispatchEvent(new CustomEvent('hc:tabactivated', { bubbles: true }));
    } else {
      // `hidden="until-found"` lets Ctrl+F search inactive panels;
      // when the browser finds a match it fires `beforematch` (handled
      // below) so we can auto-switch to the owning tab. Browsers
      // without support treat this as a plain `hidden`.
      p.setAttribute('hidden', 'until-found');
    }
  }
  if (focus) tab.focus();
}

function moveFocus(rootEl, current, delta) {
  const list = tablistOf(rootEl);
  const enabled = tabsOf(list).filter(isEnabled);
  if (enabled.length === 0) return;
  const i = enabled.indexOf(current);
  if (i === -1) return;
  const n = enabled.length;
  enabled[(i + delta + n) % n].focus();
}

function focusEdge(rootEl, edge) {
  const list = tablistOf(rootEl);
  const enabled = tabsOf(list).filter(isEnabled);
  if (enabled.length === 0) return;
  (edge === 'first' ? enabled[0] : enabled[enabled.length - 1]).focus();
}

function attach(rootEl, detachers) {
  if (detachers.has(rootEl)) return;
  const list = tablistOf(rootEl);
  if (!list) return; // URL-routed variant or malformed — skip.

  const auto = rootEl.getAttribute('data-activation') === 'automatic';

  function onClick(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !list.contains(tab) || !isEnabled(tab)) return;
    event.preventDefault();
    activateTab(rootEl, tab);
  }

  function onKeydown(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !list.contains(tab)) return;
    // In RTL the horizontal arrows are mirrored; vertical arrows are not.
    let key = event.key;
    if (getComputedStyle(list).direction === 'rtl') {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(rootEl, tab, +1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(rootEl, tab, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusEdge(rootEl, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusEdge(rootEl, 'last');
        break;
      case 'Enter':
      case ' ':
        if (!isEnabled(tab)) return;
        event.preventDefault();
        activateTab(rootEl, tab);
        break;
      default:
        break;
    }
  }

  function onFocusin(event) {
    if (!auto) return;
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !list.contains(tab) || !isEnabled(tab)) return;
    activateTab(rootEl, tab, { focus: false });
  }

  function onBeforematch(event) {
    const panel = event.target.closest('[role="tabpanel"]');
    if (!panel || panel.parentElement !== rootEl) return;
    const owner = tabsOf(list).find(
      (t) => t.getAttribute('aria-controls') === panel.id,
    );
    if (owner) activateTab(rootEl, owner, { focus: false });
  }

  rootEl.addEventListener('click', onClick);
  rootEl.addEventListener('keydown', onKeydown);
  rootEl.addEventListener('focusin', onFocusin);
  rootEl.addEventListener('beforematch', onBeforematch);

  detachers.set(rootEl, () => {
    rootEl.removeEventListener('click', onClick);
    rootEl.removeEventListener('keydown', onKeydown);
    rootEl.removeEventListener('focusin', onFocusin);
    rootEl.removeEventListener('beforematch', onBeforematch);
  });
}

/**
 * Install the tabs behavior on every `.hc-tabs` root in the document
 * that has a `[role="tablist"]` descendant. URL-routed variants are
 * skipped — they need no JS.
 *
 * The returned uninstaller is idempotent and a no-op when the
 * behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installTabs(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-tabs')) attach(el, detachers);

  // Pick up `.hc-tabs` added later (e.g. by an htmx swap).
  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-tabs')) attach(node, detachers);
          node.querySelectorAll?.('.hc-tabs').forEach((el) =>
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
