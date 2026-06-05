// installHovercard — behavior for the `hc-hovercard` component.
//
// Sibling of `installTooltip`: discovers every `.hc-hovercard`
// element, auto-sets `popover="manual"` on it, wires every trigger
// that references the card via `aria-describedby`, and toggles
// visibility on hover / focus.
//
// The key difference from tooltip is the "hover into card" UX. A
// card is sized for reading and may contain links the user wants to
// click, so:
//
//   - Pointer events on the card are NOT suppressed (CSS leaves
//     `pointer-events: auto`, unlike tooltip).
//   - The behavior tracks hover state on BOTH the active trigger and
//     the card. The card stays open while either is hovered, and a
//     200 ms grace period covers the brief gap when the cursor
//     crosses from one to the other.
//
// Show / hide routing per the WAI-ARIA tooltip-with-rich-content
// recipe:
//
//   - `mouseenter` on the trigger schedules a 500 ms show.
//   - `mouseleave` on the trigger schedules a 200 ms hide.
//   - `mouseenter` on the card cancels any pending hide.
//   - `mouseleave` on the card schedules a 200 ms hide.
//   - `focus` on the trigger opens immediately (a11y — no delay).
//   - `blur` on the trigger schedules a 200 ms hide so focusable
//     elements inside the card can take focus without flickering.
//   - `Escape` while either trigger or card is focused closes.
//
// We use `popover="manual"` rather than the newer `popover="hint"`
// because Safari had no `hint` support as of 2026-05. `manual` +
// JS toggling matches the `hint` semantics everywhere `popover` is
// supported.

import { supportsAnchorPositioning, trackFloating, readSideAlign } from './anchor-fallback.js';

const INSTALL_KEY = '__hcHoverCardUninstall';
const SHOW_DELAY = 500;
const HIDE_DELAY = 200;

function escapeAttr(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return String(s).replace(/[^\w-]/g, (c) => `\\${c}`);
}

function triggersFor(card) {
  if (!card.id) return [];
  return Array.from(
    card.ownerDocument.querySelectorAll(
      `[aria-describedby~="${escapeAttr(card.id)}"]`,
    ),
  );
}

function attach(card, detachers) {
  if (detachers.has(card)) return;
  if (!card.id) return;
  const triggers = triggersFor(card);
  if (triggers.length === 0) return;

  if (!card.hasAttribute('popover')) card.setAttribute('popover', 'manual');

  const usingAnchor = supportsAnchorPositioning();
  const anchorName = `--hc-hovercard-${card.id}`;

  let showTimer = null;
  let hideTimer = null;
  let currentTrigger = null;
  let cardHovered = false;
  let fallbackCleanup = null;
  // Per-trigger hover / focus state — keyed by element. The card
  // stays open while ANY tracked state is true.
  const triggerState = new WeakMap();

  function setTriggerState(trigger, key, value) {
    const s = triggerState.get(trigger) ?? { hover: false, focus: false };
    s[key] = value;
    triggerState.set(trigger, s);
  }

  function anyTriggerActive() {
    for (const t of triggers) {
      const s = triggerState.get(t);
      if (s && (s.hover || s.focus)) return t;
    }
    return null;
  }

  function clearTimers() {
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
  }

  function show(trigger) {
    clearTimers();
    currentTrigger = trigger;
    if (card.matches(':popover-open')) return;
    if (usingAnchor) {
      trigger.style.setProperty('anchor-name', anchorName);
      card.style.setProperty('position-anchor', anchorName);
    }
    card.showPopover();
    // Placement: honor data-side / data-align (default below + centred),
    // mirroring the CSS position-area path. After show so it has size.
    if (!usingAnchor) {
      fallbackCleanup = trackFloating(card, trigger, {
        ...readSideAlign(card, { side: 'block-end', align: 'center' }),
        gap: 6,
      });
    }
  }

  function hide() {
    clearTimers();
    currentTrigger = null;
    fallbackCleanup?.();
    fallbackCleanup = null;
    if (!card.matches(':popover-open')) return;
    card.hidePopover();
  }

  function schedule() {
    clearTimers();
    const active = anyTriggerActive();
    if (active || cardHovered) {
      if (card.matches(':popover-open')) return;
      const trigger = active ?? currentTrigger ?? triggers[0];
      showTimer = setTimeout(() => show(trigger), SHOW_DELAY);
    } else {
      hideTimer = setTimeout(hide, HIDE_DELAY);
    }
  }

  function scheduleShowFromFocus(trigger) {
    clearTimers();
    show(trigger);
  }

  function onCardEnter() {
    cardHovered = true;
    schedule();
  }

  function onCardLeave() {
    cardHovered = false;
    schedule();
  }

  function onCardKeydown(event) {
    if (event.key !== 'Escape') return;
    if (!card.matches(':popover-open')) return;
    event.stopPropagation();
    hide();
  }

  card.addEventListener('mouseenter', onCardEnter);
  card.addEventListener('mouseleave', onCardLeave);
  card.addEventListener('keydown', onCardKeydown);

  const triggerListeners = new Map();
  for (const trigger of triggers) {
    const onMouseEnter = () => {
      setTriggerState(trigger, 'hover', true);
      schedule();
    };
    const onMouseLeave = () => {
      setTriggerState(trigger, 'hover', false);
      schedule();
    };
    const onFocus = () => {
      setTriggerState(trigger, 'focus', true);
      scheduleShowFromFocus(trigger);
    };
    const onBlur = () => {
      setTriggerState(trigger, 'focus', false);
      schedule();
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape' && card.matches(':popover-open')) {
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

  detachers.set(card, () => {
    clearTimers();
    if (card.matches(':popover-open')) card.hidePopover();
    card.removeEventListener('mouseenter', onCardEnter);
    card.removeEventListener('mouseleave', onCardLeave);
    card.removeEventListener('keydown', onCardKeydown);
    for (const [trigger, ls] of triggerListeners) {
      trigger.removeEventListener('mouseenter', ls.onMouseEnter);
      trigger.removeEventListener('mouseleave', ls.onMouseLeave);
      trigger.removeEventListener('focus', ls.onFocus);
      trigger.removeEventListener('blur', ls.onBlur);
      trigger.removeEventListener('keydown', ls.onKeydown);
      if (usingAnchor) trigger.style.removeProperty('anchor-name');
    }
    if (usingAnchor) card.style.removeProperty('position-anchor');
  });
}

/**
 * Install the hovercard behavior on every `.hc-hovercard` in the
 * document. Each card is bound to every trigger whose
 * `aria-describedby` references the card's id. The card stays open
 * while either the active trigger OR the card itself is hovered, so
 * users can move the cursor into the card and click links inside.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installHovercard(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-hovercard')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-hovercard')) attach(node, detachers);
          node.querySelectorAll?.('.hc-hovercard').forEach((el) =>
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
