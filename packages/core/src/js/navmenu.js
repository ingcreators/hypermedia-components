// installNavmenu — top-level site navigation with content panels (mega-menu).
//
//   <nav class="hc-navmenu" aria-label="Main">
//     <ul class="hc-navmenu__list">
//       <li class="hc-navmenu__item">
//         <button class="hc-navmenu__trigger" type="button"
//                 data-hc-navmenu-trigger aria-controls="nm-products">Products</button>
//         <div class="hc-navmenu__panel" id="nm-products">
//           <a class="hc-navmenu__link" href="/a">Analytics</a>
//           <a class="hc-navmenu__link" href="/b">Billing</a>
//         </div>
//       </li>
//       <li class="hc-navmenu__item">
//         <a class="hc-navmenu__link" href="/pricing">Pricing</a>
//       </li>
//     </ul>
//   </nav>
//
// A disclosure set: each trigger button controls a `popover` panel anchored
// with CSS Anchor Positioning (JS fallback via anchor-fallback.js). Panels
// open on hover / focus with a short close delay, **one at a time**; Escape
// closes and returns focus to the trigger; ↓ / ↑ open and move focus into the
// panel. Plain links inside panels stay real <a> (htmx / MPA friendly) — the
// behavior never intercepts them.
//
// installNavmenu(root = document) returns an idempotent uninstaller.

import { supportsAnchorPositioning, trackFloating } from './anchor-fallback.js';

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcNavmenuUninstall';
const SHOW_DELAY = 100;
const HIDE_DELAY = 150;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
let panelSeq = 0;

function isOpen(panel) {
  // Real browsers expose `:popover-open`; a popover never uses the `open`
  // attribute (that's <details>), so the attribute check is a safe fallback
  // for environments (jsdom) where the pseudo-class isn't matched.
  try {
    if (panel.matches(':popover-open')) return true;
  } catch {
    /* unknown pseudo in this engine */
  }
  return panel.hasAttribute('open');
}

function panelFor(trigger) {
  const id = trigger.getAttribute('aria-controls');
  if (id) {
    const el = trigger.ownerDocument.getElementById(id);
    if (el) return el;
  }
  const sib = trigger.nextElementSibling;
  return sib && sib.matches?.('.hc-navmenu__panel, [data-hc-navmenu-panel]') ? sib : null;
}

function attach(nav, detachers) {
  if (detachers.has(nav)) return;
  const triggers = Array.from(nav.querySelectorAll('[data-hc-navmenu-trigger]')).filter(
    (t) => t.closest('.hc-navmenu') === nav,
  );
  if (triggers.length === 0) return;

  const usingAnchor = supportsAnchorPositioning();
  const pairs = [];
  const cleanups = [];
  const fallbacks = new WeakMap();
  const hoverState = new WeakMap(); // trigger -> { th, ph }
  let openTrigger = null;
  let showTimer = null;
  let hideTimer = null;
  // One-shot guard: after Escape we move focus back to the trigger, which must
  // NOT re-open the panel via the focus-to-open path.
  let suppressFocusOpen = false;

  const pairOf = (trigger) => pairs.find((p) => p.trigger === trigger) || null;

  function clearTimers() {
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
  }

  function hide(pair) {
    if (isOpen(pair.panel) && typeof pair.panel.hidePopover === 'function') {
      try {
        pair.panel.hidePopover();
      } catch {
        /* not open */
      }
    }
  }

  function show(pair) {
    clearTimers();
    if (isOpen(pair.panel)) return;
    // One at a time — close any other open panel first.
    if (openTrigger && openTrigger !== pair.trigger) {
      const cur = pairOf(openTrigger);
      if (cur) hide(cur);
    }
    if (typeof pair.panel.showPopover === 'function') {
      try {
        pair.panel.showPopover();
      } catch {
        /* already open / disconnected */
      }
    }
  }

  function keepAlive() {
    const ae = nav.ownerDocument.activeElement;
    for (const p of pairs) {
      const s = hoverState.get(p.trigger);
      if (s && (s.th || s.ph)) return true;
      if (p.trigger === ae || p.panel.contains(ae)) return true;
    }
    return false;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (keepAlive()) return;
      if (openTrigger) {
        const cur = pairOf(openTrigger);
        if (cur) hide(cur);
      }
    }, HIDE_DELAY);
  }

  function scheduleShow(pair) {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(pair), SHOW_DELAY);
  }

  for (const trigger of triggers) {
    const panel = panelFor(trigger);
    if (!panel) continue;
    if (!panel.id) panel.id = `hc-navmenu-panel-${(panelSeq += 1)}`;
    if (!panel.hasAttribute('popover')) panel.setAttribute('popover', 'auto');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);

    const anchorName = `--hc-navmenu-${panel.id}`;
    if (usingAnchor) {
      trigger.style.setProperty('anchor-name', anchorName);
      panel.style.setProperty('position-anchor', anchorName);
    }

    const pair = { trigger, panel, anchorName };
    pairs.push(pair);
    hoverState.set(trigger, { th: false, ph: false });

    // Keep aria-expanded / open-state in sync however the panel opens or
    // closes (hover, keyboard, native light-dismiss, or auto-close on a
    // sibling opening).
    const onToggle = (e) => {
      const open = e.newState === 'open';
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        openTrigger = trigger;
        if (!usingAnchor && !fallbacks.has(panel)) {
          fallbacks.set(
            panel,
            trackFloating(panel, trigger, { side: 'block-end', align: 'start', gap: 4 }),
          );
        }
      } else {
        const fb = fallbacks.get(panel);
        if (fb) {
          fb();
          fallbacks.delete(panel);
        }
        if (openTrigger === trigger) openTrigger = null;
      }
    };
    panel.addEventListener('toggle', onToggle);

    const onTriggerEnter = () => {
      hoverState.get(trigger).th = true;
      scheduleShow(pair);
    };
    const onTriggerLeave = () => {
      hoverState.get(trigger).th = false;
      scheduleHide();
    };
    const onTriggerFocus = () => {
      if (suppressFocusOpen) return;
      show(pair);
    };
    const onTriggerBlur = () => scheduleHide();
    const onPanelEnter = () => {
      hoverState.get(trigger).ph = true;
      clearTimers();
    };
    const onPanelLeave = () => {
      hoverState.get(trigger).ph = false;
      scheduleHide();
    };
    const onPanelFocusout = () => scheduleHide();

    trigger.addEventListener('mouseenter', onTriggerEnter);
    trigger.addEventListener('mouseleave', onTriggerLeave);
    trigger.addEventListener('focus', onTriggerFocus);
    trigger.addEventListener('blur', onTriggerBlur);
    panel.addEventListener('mouseenter', onPanelEnter);
    panel.addEventListener('mouseleave', onPanelLeave);
    panel.addEventListener('focusout', onPanelFocusout);

    cleanups.push(() => {
      panel.removeEventListener('toggle', onToggle);
      trigger.removeEventListener('mouseenter', onTriggerEnter);
      trigger.removeEventListener('mouseleave', onTriggerLeave);
      trigger.removeEventListener('focus', onTriggerFocus);
      trigger.removeEventListener('blur', onTriggerBlur);
      panel.removeEventListener('mouseenter', onPanelEnter);
      panel.removeEventListener('mouseleave', onPanelLeave);
      panel.removeEventListener('focusout', onPanelFocusout);
      const fb = fallbacks.get(panel);
      if (fb) {
        fb();
        fallbacks.delete(panel);
      }
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-expanded');
      if (usingAnchor) {
        trigger.style.removeProperty('anchor-name');
        panel.style.removeProperty('position-anchor');
      }
    });
  }

  // Click toggles; ↓ / ↑ open and move focus into the panel; Escape closes
  // the open panel and returns focus to its trigger.
  function onClick(e) {
    const trigger = e.target.closest?.('[data-hc-navmenu-trigger]');
    if (!trigger || trigger.closest('.hc-navmenu') !== nav) return;
    const pair = pairOf(trigger);
    if (!pair) return;
    e.preventDefault();
    if (isOpen(pair.panel)) hide(pair);
    else show(pair);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && openTrigger) {
      const cur = pairOf(openTrigger);
      const t = openTrigger;
      if (cur) {
        // Closing returns focus to the trigger (both hidePopover's native
        // focus-return and our explicit focus). Neither must re-open it, so
        // guard the whole synchronous close and clear on the next tick.
        suppressFocusOpen = true;
        hide(cur);
        t.focus();
        e.preventDefault();
        setTimeout(() => {
          suppressFocusOpen = false;
        }, 0);
      }
      return;
    }
    const trigger = e.target.closest?.('[data-hc-navmenu-trigger]');
    if (!trigger || trigger.closest('.hc-navmenu') !== nav) return;
    const pair = pairOf(trigger);
    if (!pair) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      show(pair);
      pair.panel.querySelector(FOCUSABLE)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      show(pair);
      const f = pair.panel.querySelectorAll(FOCUSABLE);
      f[f.length - 1]?.focus();
    }
  }

  nav.addEventListener('click', onClick);
  nav.addEventListener('keydown', onKeydown);
  cleanups.push(() => {
    clearTimers();
    nav.removeEventListener('click', onClick);
    nav.removeEventListener('keydown', onKeydown);
  });

  const detach = () => {
    for (const c of cleanups) c();
  };
  // Stale when a trigger or panel this attachment wired was swapped away
  // (its listeners and inline anchor-name died with it), or when a new
  // unwired trigger arrived inside the surviving nav. The install
  // observer rebinds then.
  const wired = new Set(pairs.map((p) => p.trigger));
  detach.stale = () => {
    for (const p of pairs) {
      if (!nav.contains(p.trigger) || !nav.contains(p.panel)) return true;
    }
    for (const t of nav.querySelectorAll('[data-hc-navmenu-trigger]')) {
      if (t.closest('.hc-navmenu') !== nav) continue;
      if (!wired.has(t)) return true;
    }
    return false;
  };
  detachers.set(nav, detach);
}

/**
 * Install the navigation-menu behavior on every `.hc-navmenu` in the
 * document: hover / focus / keyboard-driven content panels, one open at a
 * time, anchored under their trigger.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installNavmenu(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll('.hc-navmenu')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      const affected = new Set();
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-navmenu')) affected.add(node);
          node.querySelectorAll?.('.hc-navmenu').forEach((el) => affected.add(el));
          // Content swapped INTO a surviving nav (a re-rendered item list,
          // a lazy-loaded panel): the nav itself never appears in
          // addedNodes — resolve it by walking up.
          const nav = node.closest?.('.hc-navmenu');
          if (nav) affected.add(nav);
        }
      }
      for (const nav of affected) {
        const detach = detachers.get(nav);
        if (detach) {
          if (!detach.stale()) continue;
          detach();
          detachers.delete(nav);
        }
        attach(nav, detachers);
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
