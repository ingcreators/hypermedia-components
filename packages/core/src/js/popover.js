// installPopover — directional anchoring for an opt-in `.hc-popover`.
//
// A bare `.hc-popover` is positioned by the browser (centred in the top
// layer). Add `data-side` (top | right | bottom | left, with optional
// `data-align` start | center | end) to anchor it to its `popovertarget`
// trigger instead:
//
//   <button popovertarget="filters" id="filters-trigger">Filter</button>
//   <div id="filters" class="hc-popover" popover
//        data-side="bottom" data-align="start" data-arrow>…</div>
//
// Placement uses CSS Anchor Positioning where supported (see hc-anchored.css)
// and the shared JS fallback (anchor-fallback.js) elsewhere. The native open
// / close / light-dismiss / Escape behaviour all stay the browser's; this
// behavior only positions the popover and keeps `aria-expanded` /
// `aria-controls` in sync on the trigger.
//
// Only popovers that opt in with `data-side` are touched — a plain popover is
// left browser-positioned. installPopover(root = document) returns an
// idempotent uninstaller.

import { supportsAnchorPositioning, trackFloating, readSideAlign } from './anchor-fallback.js';

const INSTALL_KEY = '__hcPopoverUninstall';
const SELECTOR = '.hc-popover[data-side]';

function escapeAttr(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return String(s).replace(/[^\w-]/g, (c) => `\\${c}`);
}

function triggerFor(popover) {
  if (!popover.id) return null;
  return popover.ownerDocument.querySelector(`[popovertarget="${escapeAttr(popover.id)}"]`);
}

function attach(popover, detachers) {
  if (detachers.has(popover)) return;
  if (!popover.hasAttribute('popover')) return; // not a popover-driven element
  const trigger = triggerFor(popover);
  if (!trigger) return; // no popovertarget binding — skip silently

  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', popover.id);

  const anchorName = `--hc-popover-${popover.id}`;
  const usingAnchor = supportsAnchorPositioning();
  if (usingAnchor) {
    trigger.style.setProperty('anchor-name', anchorName);
    popover.style.setProperty('position-anchor', anchorName);
  }
  let fallbackCleanup = null;

  function onToggle(event) {
    trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
  }

  function onBeforeToggle(event) {
    if (usingAnchor) return;
    // Mirror the CSS position-area placement in JS for engines without Anchor
    // Positioning: place + track until close.
    if (event.newState === 'open') {
      fallbackCleanup = trackFloating(popover, trigger, {
        ...readSideAlign(popover, { side: 'block-end', align: 'center' }),
        gap: 8,
      });
    } else {
      fallbackCleanup?.();
      fallbackCleanup = null;
    }
  }

  popover.addEventListener('toggle', onToggle);
  popover.addEventListener('beforetoggle', onBeforeToggle);

  detachers.set(popover, () => {
    popover.removeEventListener('toggle', onToggle);
    popover.removeEventListener('beforetoggle', onBeforeToggle);
    fallbackCleanup?.();
    fallbackCleanup = null;
    trigger.removeAttribute('aria-expanded');
    trigger.removeAttribute('aria-controls');
    if (usingAnchor) {
      trigger.style.removeProperty('anchor-name');
      popover.style.removeProperty('position-anchor');
    }
  });
}

/**
 * Install directional anchoring on every `.hc-popover[data-side]` in the
 * document that has a matching `[popovertarget]` trigger. The returned
 * uninstaller is idempotent and a no-op when not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installPopover(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll(SELECTOR)) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(SELECTOR)) attach(node, detachers);
          node.querySelectorAll?.(SELECTOR).forEach((el) => attach(el, detachers));
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
