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

function isScrollMode(rootEl) {
  return rootEl.getAttribute('data-overflow') === 'scroll';
}

// A vertical tablist navigates on the up/down axis. Opt in with
// `data-orientation="vertical"` on the root (drives the CSS column layout);
// the behavior reflects it onto the tablist's `aria-orientation`.
function isVertical(rootEl, list) {
  return (
    rootEl.getAttribute('data-orientation') === 'vertical' ||
    (list != null && list.getAttribute('aria-orientation') === 'vertical')
  );
}

function makeScrollButton(doc, dir) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'hc-tabs__scroll';
  b.dataset.dir = dir;
  // Mouse affordance only — keyboard arrows already scroll the focused tab
  // into view, so keep these out of the tab order and the a11y tree.
  b.setAttribute('aria-hidden', 'true');
  b.tabIndex = -1;
  b.hidden = true;
  return b;
}

// data-overflow="scroll": inject the edge scroll buttons, keep them in sync
// with the scroll position, and bring the selected tab into view. Returns a
// cleanup (or null when the root is not in scroll mode).
function setupOverflow(rootEl, list) {
  if (!isScrollMode(rootEl)) return null;
  const doc = rootEl.ownerDocument;
  const view = doc.defaultView;
  const startBtn = makeScrollButton(doc, 'start');
  const endBtn = makeScrollButton(doc, 'end');
  rootEl.append(startBtn, endBtn);

  const rtl = () => (view ? view.getComputedStyle(list).direction === 'rtl' : false);

  function update() {
    const h = list.offsetHeight;
    if (h) {
      startBtn.style.blockSize = `${h}px`;
      endBtn.style.blockSize = `${h}px`;
    }
    const max = list.scrollWidth - list.clientWidth;
    const pos = Math.abs(list.scrollLeft); // normalize LTR / RTL scrollLeft
    const overflowing = max > 1;
    startBtn.hidden = !overflowing || pos <= 1;
    endBtn.hidden = !overflowing || pos >= max - 1;
  }

  function page(toEnd) {
    if (typeof list.scrollBy !== 'function') return;
    const amount = Math.max(120, list.clientWidth * 0.8);
    const sign = (toEnd ? 1 : -1) * (rtl() ? -1 : 1);
    list.scrollBy({ left: sign * amount, behavior: 'smooth' });
  }

  const onStart = () => page(false);
  const onEnd = () => page(true);
  startBtn.addEventListener('click', onStart);
  endBtn.addEventListener('click', onEnd);
  list.addEventListener('scroll', update, { passive: true });

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(update);
    ro.observe(list);
  }
  let mo = null;
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(update);
    mo.observe(list, { childList: true });
  }

  update();
  const selected = list.querySelector(':scope > [role="tab"][aria-selected="true"]');
  if (selected && typeof selected.scrollIntoView === 'function') {
    selected.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'instant' });
  }

  return () => {
    startBtn.remove();
    endBtn.remove();
    list.removeEventListener('scroll', update);
    ro?.disconnect();
    mo?.disconnect();
  };
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
  if (focus) {
    tab.focus(); // .focus() natively scrolls the tab into view in the list
  } else if (isScrollMode(rootEl) && typeof tab.scrollIntoView === 'function') {
    tab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
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

  // Reflect the root's orientation onto the tablist so assistive tech knows
  // the arrow-key axis even if the author only set `data-orientation`.
  if (rootEl.getAttribute('data-orientation') === 'vertical') {
    list.setAttribute('aria-orientation', 'vertical');
  }

  function onClick(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !list.contains(tab) || !isEnabled(tab)) return;
    event.preventDefault();
    activateTab(rootEl, tab);
  }

  function onKeydown(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !list.contains(tab)) return;
    const vertical = isVertical(rootEl, list);
    let key = event.key;
    // A horizontal list mirrors the left/right arrows in RTL; a vertical
    // list navigates the (unmirrored) up/down axis.
    if (!vertical && getComputedStyle(list).direction === 'rtl') {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    // Per APG the arrow axis follows the orientation: ←/→ for a horizontal
    // tablist, ↑/↓ for a vertical one. The cross-axis arrows are left alone.
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    switch (key) {
      case nextKey:
        event.preventDefault();
        moveFocus(rootEl, tab, +1);
        break;
      case prevKey:
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

  const overflowCleanup = setupOverflow(rootEl, list);

  rootEl.addEventListener('click', onClick);
  rootEl.addEventListener('keydown', onKeydown);
  rootEl.addEventListener('focusin', onFocusin);
  rootEl.addEventListener('beforematch', onBeforematch);

  detachers.set(rootEl, () => {
    rootEl.removeEventListener('click', onClick);
    rootEl.removeEventListener('keydown', onKeydown);
    rootEl.removeEventListener('focusin', onFocusin);
    rootEl.removeEventListener('beforematch', onBeforematch);
    overflowCleanup?.();
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
