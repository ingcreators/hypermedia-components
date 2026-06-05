// installTooltip — behavior for the `hc-tooltip` component.
//
// Discovers every `.hc-tooltip` in the document, auto-sets
// `popover="manual"` and `role="tooltip"` on it, then wires every
// trigger that references the tooltip via `aria-describedby` so
// that:
//
//   - hovering the trigger reveals the tooltip after a short delay
//     (300 ms) and hides it after a brief grace period (100 ms)
//     once the cursor leaves;
//   - keyboard-focusing the trigger reveals the tooltip immediately
//     (a11y best practice — no delay on focus) and Esc dismisses it
//     without losing focus;
//   - blur hides the tooltip immediately.
//
// Positioning uses CSS Anchor Positioning (anchor-name on trigger,
// position-anchor on the tooltip — see hc-tooltip.css). For browsers
// without anchor support, a JS fallback positions the tooltip via
// `getBoundingClientRect` with the same default placement
// (above the trigger).
//
// We use `popover="manual"` rather than `popover="hint"` because
// Safari had no `hint` support as of 2026-05; manual + JS toggling
// matches the hint semantics across every browser that supports
// `popover` at all (Chromium 114+, Firefox 125+, Safari 17+).

import { supportsAnchorPositioning, trackFloating, readSideAlign } from './anchor-fallback.js';

const INSTALL_KEY = '__hcTooltipUninstall';
const SHOW_DELAY = 300;
const HIDE_DELAY = 100;

function escapeAttr(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return String(s).replace(/[^\w-]/g, (c) => `\\${c}`);
}

function triggersFor(tooltip) {
  if (!tooltip.id) return [];
  // aria-describedby is space-separated; `~=` matches one of those
  // tokens. The escapeAttr guards id characters that have meaning
  // inside an attribute selector.
  return Array.from(
    tooltip.ownerDocument.querySelectorAll(
      `[aria-describedby~="${escapeAttr(tooltip.id)}"]`,
    ),
  );
}

function attach(tooltip, detachers) {
  if (detachers.has(tooltip)) return;
  if (!tooltip.id) return; // No id → no aria-describedby can target it.
  const triggers = triggersFor(tooltip);
  if (triggers.length === 0) return; // Nothing to bind to.

  // Auto-attribution: only set defaults if the author did not.
  if (!tooltip.hasAttribute('popover')) tooltip.setAttribute('popover', 'manual');
  if (!tooltip.hasAttribute('role')) tooltip.setAttribute('role', 'tooltip');

  const usingAnchor = supportsAnchorPositioning();
  const anchorName = `--hc-tooltip-${tooltip.id}`;

  let showTimer = null;
  let hideTimer = null;
  let fallbackCleanup = null;

  function clearTimers() {
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
  }

  function show(trigger) {
    clearTimers();
    if (tooltip.matches(':popover-open')) return;
    if (usingAnchor) {
      // Rebind the anchor to the trigger that just gained hover /
      // focus. Multiple triggers can share one tooltip — only one
      // anchor edge at a time.
      trigger.style.setProperty('anchor-name', anchorName);
      tooltip.style.setProperty('position-anchor', anchorName);
    }
    tooltip.showPopover();
    // Placement: honor data-side / data-align (default above + centred),
    // mirroring the CSS position-area path. Position after showPopover so the
    // tooltip has measurable dimensions.
    if (!usingAnchor) {
      fallbackCleanup = trackFloating(
        tooltip,
        trigger,
        readSideAlign(tooltip, { side: 'block-start', align: 'center' }),
      );
    }
  }

  function hide() {
    clearTimers();
    fallbackCleanup?.();
    fallbackCleanup = null;
    if (!tooltip.matches(':popover-open')) return;
    tooltip.hidePopover();
  }

  function scheduleShow(trigger) {
    clearTimers();
    showTimer = setTimeout(() => show(trigger), SHOW_DELAY);
  }

  function scheduleHide() {
    clearTimers();
    hideTimer = setTimeout(hide, HIDE_DELAY);
  }

  const triggerListeners = new Map();
  for (const trigger of triggers) {
    const onMouseEnter = () => scheduleShow(trigger);
    const onMouseLeave = () => scheduleHide();
    const onFocus = () => show(trigger);
    const onBlur = () => hide();
    const onKeydown = (e) => {
      if (e.key === 'Escape' && tooltip.matches(':popover-open')) {
        e.stopPropagation();
        hide();
      }
    };
    trigger.addEventListener('mouseenter', onMouseEnter);
    trigger.addEventListener('mouseleave', onMouseLeave);
    trigger.addEventListener('focus', onFocus);
    trigger.addEventListener('blur', onBlur);
    trigger.addEventListener('keydown', onKeydown);
    triggerListeners.set(trigger, {
      onMouseEnter, onMouseLeave, onFocus, onBlur, onKeydown,
    });
  }

  detachers.set(tooltip, () => {
    clearTimers();
    if (tooltip.matches(':popover-open')) tooltip.hidePopover();
    for (const [trigger, ls] of triggerListeners) {
      trigger.removeEventListener('mouseenter', ls.onMouseEnter);
      trigger.removeEventListener('mouseleave', ls.onMouseLeave);
      trigger.removeEventListener('focus', ls.onFocus);
      trigger.removeEventListener('blur', ls.onBlur);
      trigger.removeEventListener('keydown', ls.onKeydown);
      if (usingAnchor) trigger.style.removeProperty('anchor-name');
    }
    if (usingAnchor) tooltip.style.removeProperty('position-anchor');
  });
}

/**
 * Install the tooltip behavior on every `.hc-tooltip` in the
 * document. Each tooltip is bound to every trigger element whose
 * `aria-describedby` references the tooltip's id.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installTooltip(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-tooltip')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-tooltip')) attach(node, detachers);
          node.querySelectorAll?.('.hc-tooltip').forEach((el) =>
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
