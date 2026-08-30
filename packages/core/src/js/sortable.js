// installSortable — pointer + keyboard reordering for lists the server
// owns the order of (kanban columns, priority lists, table rows).
//
//   <ul class="hc-stack" data-hc-sortable
//       data-hx-post="/items/order" data-hx-trigger="hc:sortchange"
//       data-hx-include="this" data-hx-swap="none">
//     <li class="hc-item" data-hc-sortable-id="a">
//       <button type="button" class="hc-button" data-variant="ghost"
//               data-hc-sortable-handle>⠿</button>
//       Item A
//       <input type="hidden" name="order[]" value="a">
//     </li>
//     …
//   </ul>
//
// The behavior ONLY reorders DOM nodes and reports the result — htmx
// owns the network. Because each item carries its own hidden input,
// moving items reorders what the form (or `data-hx-include="this"`)
// serializes; persisting is one `hc:sortchange`-triggered request with
// no per-item bookkeeping.
//
//   - `data-hc-sortable` marks the container; its element children are
//     the sortable items.
//   - `data-hc-sortable-handle` marks the drag handle inside each item
//     — a real `<button>`, because it is also the keyboard interface:
//     Space/Enter grabs (aria-pressed, `data-grabbed` on the item),
//     arrows move the grabbed item, Space/Enter drops, Escape cancels
//     and restores the original position, blur commits.
//   - Pointer drags start on the handle after a 4px threshold (clicks
//     pass through); the item reorders live under the pointer on the
//     container's flow axis, `data-dragging="true"` marks it for CSS,
//     Escape cancels mid-drag.
//   - A committed reorder announces through the shared `role="status"`
//     live region (i18n keys `sortable.*`) and dispatches a bubbling
//     `hc:sortchange` CustomEvent from the container:
//     `detail = { item, from, to, order }` where `order` lists each
//     item's `data-hc-sortable-id` (falling back to `id`, else null).
//   - Handles get `touch-action: none` (the one style write — without
//     it touch drags scroll instead) and a default aria-label.
//
// installSortable(root = document) returns an idempotent uninstaller.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcSortableUninstall';
const CONTAINER_SELECTOR = '[data-hc-sortable]';
const HANDLE_SELECTOR = '[data-hc-sortable-handle]';
const THRESHOLD = 4;

function itemsOf(container) {
  return [...container.children];
}

function itemFor(handle, container) {
  let el = handle;
  while (el && el.parentElement !== container) el = el.parentElement;
  return el;
}

function orderOf(container) {
  return itemsOf(container).map(
    (item) => item.getAttribute('data-hc-sortable-id') || item.id || null,
  );
}

/** Column axis unless the first two items sit on one row. */
function axisOf(container) {
  const [a, b] = itemsOf(container).map((el) => el.getBoundingClientRect());
  if (!a || !b) return 'column';
  return Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom) ? 'row' : 'column';
}

// ---- drag motion -------------------------------------------------------
// Visual polish only — the DOM order stays the single source of truth
// and none of this changes it. The dragged item tracks the pointer with
// a transform, displaced siblings FLIP-slide into their new slots, and
// the drop settles the item into place. Everything is skipped when the
// environment cannot animate (no matchMedia — jsdom) or the user
// prefers reduced motion.

const FLIP_TRANSITION =
  'transform var(--hc-motion-duration-fast, 120ms) var(--hc-motion-easing-standard, ease)';

function motionOK(doc) {
  const w = doc.defaultView;
  if (!w || typeof w.matchMedia !== 'function') return false;
  return !w.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The element's LAYOUT rect: its border box with its own translation
 * removed. Reorder decisions and FLIP deltas must use layout geometry —
 * mid-animation visual rects would make the slot math oscillate.
 */
function layoutRect(el) {
  const r = el.getBoundingClientRect();
  const view = el.ownerDocument.defaultView;
  const t = view ? view.getComputedStyle(el).transform : 'none';
  const m = t && t !== 'none' ? t.match(/matrix\(([^)]+)\)/) : null;
  if (!m) return r;
  const parts = m[1].split(',').map(Number);
  const tx = parts[4] || 0;
  const ty = parts[5] || 0;
  return {
    top: r.top - ty,
    bottom: r.bottom - ty,
    left: r.left - tx,
    right: r.right - tx,
    width: r.width,
    height: r.height,
  };
}

const translateBy = (axis, d) =>
  axis === 'row' ? `translateX(${d}px)` : `translateY(${d}px)`;

/** Jump the element by `delta`, then transition it back to rest. */
function slideFrom(el, axis, delta) {
  if (Math.abs(delta) < 0.5) return;
  el.style.transition = 'none';
  el.style.transform = translateBy(axis, delta);
  void el.offsetWidth; // flush, so the next write animates
  el.style.transition = FLIP_TRANSITION;
  el.style.transform = '';
  const done = () => {
    el.style.transition = '';
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done);
}

/**
 * Move `item` before `ref` inside `container`, FLIP-sliding every
 * sibling whose slot changes. Returns nothing; safe with motion off.
 */
function moveWithFlip(container, item, ref, axis, motion) {
  const siblings = motion
    ? itemsOf(container)
        .filter((el) => el !== item)
        .map((el) => ({ el, before: layoutRect(el) }))
    : null;
  container.insertBefore(item, ref);
  if (!siblings) return;
  for (const { el, before } of siblings) {
    const after = layoutRect(el);
    slideFrom(el, axis, axis === 'row' ? before.left - after.left : before.top - after.top);
  }
}

/** Transition the item from wherever it visually is into its slot. */
function settleItem(el, axis, motion) {
  if (!motion) {
    el.style.transform = '';
    el.style.transition = '';
    return;
  }
  const visual = el.getBoundingClientRect();
  el.style.transition = 'none';
  el.style.transform = '';
  const layout = el.getBoundingClientRect();
  const delta = axis === 'row' ? visual.left - layout.left : visual.top - layout.top;
  slideFrom(el, axis, delta);
}

/**
 * Install list reordering on the given document.
 *
 * Containers marked `data-hc-sortable` get pointer *and* keyboard
 * reordering through their items' `data-hc-sortable-handle` buttons.
 * The behavior moves DOM nodes only and reports the committed order via
 * a bubbling `hc:sortchange` event — persisting the order is the
 * markup's job (hidden inputs + htmx). Works for containers swapped in
 * later (delegated listeners + MutationObserver for handle prep).
 *
 * @param {Document} [root=document]
 * @returns {() => void} idempotent uninstaller
 *
 * @example
 * import { installSortable } from '@hypermedia-components/core';
 * const uninstall = installSortable();
 */
export function installSortable(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  let liveRegion = null;
  let drag = null; // pointer drag state
  let grab = null; // keyboard grab state

  function announce(message) {
    if (!liveRegion || !liveRegion.isConnected) {
      liveRegion = doc.createElement('div');
      liveRegion.className = 'hc-sr-only';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      doc.body.appendChild(liveRegion);
    }
    liveRegion.textContent = '';
    liveRegion.textContent = message;
  }

  function position(item) {
    const items = itemsOf(item.parentElement);
    return { index: items.indexOf(item) + 1, count: items.length };
  }

  function prepareHandles(scope) {
    const handles =
      scope.querySelectorAll?.(`${CONTAINER_SELECTOR} ${HANDLE_SELECTOR}`) ?? [];
    for (const handle of handles) {
      handle.style.touchAction = 'none';
      if (!handle.hasAttribute('aria-pressed')) handle.setAttribute('aria-pressed', 'false');
      // Icon/glyph-only handles (⠿, ↕, …) have no accessible name —
      // only text with letters or digits counts as a label.
      if (!handle.hasAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(handle.textContent)) {
        handle.setAttribute('aria-label', t('sortable.handle'));
      }
    }
  }

  function commit(container, item, from) {
    const to = itemsOf(container).indexOf(item);
    if (to === from) return;
    announce(t('sortable.dropped', position(item)));
    container.dispatchEvent(
      new CustomEvent('hc:sortchange', {
        bubbles: true,
        detail: { item, from, to, order: orderOf(container) },
      }),
    );
  }

  function restore(container, item, from) {
    container.insertBefore(item, itemsOf(container).filter((el) => el !== item)[from] ?? null);
  }

  // ---- pointer path ----------------------------------------------------

  function onPointerDown(event) {
    const handle = event.target.closest?.(HANDLE_SELECTOR);
    const container = handle?.closest(CONTAINER_SELECTOR);
    if (!handle || !container) return;
    const item = itemFor(handle, container);
    if (!item) return;
    drag = {
      container,
      item,
      from: itemsOf(container).indexOf(item),
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function onPointerMove(event) {
    if (!drag) return;
    if (!drag.active) {
      if (
        Math.abs(event.clientX - drag.startX) < THRESHOLD &&
        Math.abs(event.clientY - drag.startY) < THRESHOLD
      ) {
        return;
      }
      drag.active = true;
      drag.item.setAttribute('data-dragging', 'true');
      drag.axis = axisOf(drag.container);
      drag.motion = motionOK(doc);
      const start = layoutRect(drag.item);
      drag.grabOffset =
        (drag.axis === 'row' ? event.clientX : event.clientY) -
        (drag.axis === 'row' ? start.left : start.top);
    }
    const { container, item, axis, motion } = drag;
    const pointer = axis === 'row' ? event.clientX : event.clientY;
    for (const sibling of itemsOf(container)) {
      if (sibling === item) continue;
      // Layout geometry, not visual: a sibling mid-slide would make
      // the midpoint math oscillate.
      const r = layoutRect(sibling);
      const mid = axis === 'row' ? r.left + r.width / 2 : r.top + r.height / 2;
      const itemBefore =
        item.compareDocumentPosition(sibling) & Node.DOCUMENT_POSITION_PRECEDING;
      if (itemBefore && pointer < mid) {
        moveWithFlip(container, item, sibling, axis, motion);
        break;
      }
      if (!itemBefore && pointer > mid) {
        moveWithFlip(container, item, sibling.nextSibling, axis, motion);
        break;
      }
    }
    if (motion) {
      // The item itself tracks the pointer — its DOM slot snaps, the
      // visual glides with the hand.
      const lr = layoutRect(item);
      const delta = pointer - drag.grabOffset - (axis === 'row' ? lr.left : lr.top);
      item.style.transition = 'none';
      item.style.transform = translateBy(axis, delta);
    }
  }

  function endPointerDrag(cancelled) {
    if (!drag) return;
    const { container, item, from, active, axis, motion } = drag;
    drag = null;
    if (!active) return;
    item.removeAttribute('data-dragging');
    if (cancelled) {
      restore(container, item, from);
      announce(t('sortable.cancel'));
    } else {
      commit(container, item, from);
    }
    // From wherever the hand left it, glide into the final slot.
    settleItem(item, axis, motion);
  }

  function onPointerUp() {
    endPointerDrag(false);
  }

  // ---- keyboard path ---------------------------------------------------

  function dropGrab(cancelled) {
    if (!grab) return;
    const { container, item, from, handle } = grab;
    grab = null;
    item.removeAttribute('data-grabbed');
    handle.setAttribute('aria-pressed', 'false');
    if (cancelled) {
      restore(container, item, from);
      announce(t('sortable.cancel'));
    } else {
      commit(container, item, from);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (drag) {
        endPointerDrag(true);
        event.stopPropagation();
        return;
      }
      if (grab) {
        dropGrab(true);
        event.stopPropagation();
      }
      return;
    }

    const handle = event.target.closest?.(HANDLE_SELECTOR);
    const container = handle?.closest(CONTAINER_SELECTOR);
    if (!handle || !container) return;
    const item = itemFor(handle, container);
    if (!item) return;

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grab && grab.item === item) {
        dropGrab(false);
      } else {
        dropGrab(false); // commit any other pending grab first
        grab = { container, item, from: itemsOf(container).indexOf(item), handle };
        item.setAttribute('data-grabbed', 'true');
        handle.setAttribute('aria-pressed', 'true');
        announce(t('sortable.grabbed', position(item)));
      }
      return;
    }

    if (!grab || grab.item !== item) return;
    const prev = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const next = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    if (!prev && !next) return;
    event.preventDefault();
    const sibling = prev ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    // Moving the focused handle fires focusout mid-move — guard so the
    // blur-commit below doesn't end the grab we're still using.
    moving = true;
    const motion = motionOK(doc);
    const axis = axisOf(container);
    const before = motion ? layoutRect(item) : null;
    moveWithFlip(container, item, prev ? sibling : sibling.nextSibling, axis, motion);
    if (motion) {
      const after = layoutRect(item);
      slideFrom(item, axis, axis === 'row' ? before.left - after.left : before.top - after.top);
    }
    handle.focus();
    moving = false;
    announce(t('sortable.moved', position(item)));
  }

  let moving = false;
  function onFocusOut(event) {
    if (!moving && grab && event.target === grab.handle) dropGrab(false);
  }

  // ---- wiring ----------------------------------------------------------

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType === 1) prepareHandles(node);
        }
      }
    });
    observer.observe(doc.body || doc, { childList: true, subtree: true });
  }
  const onSwap = (event) => {
    if (event.target?.nodeType === 1) prepareHandles(event.target);
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('htmx:afterSwap', onSwap);
  root.addEventListener('htmx:oobAfterSwap', onSwap);

  prepareHandles(root);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    endPointerDrag(true);
    dropGrab(true);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('htmx:afterSwap', onSwap);
    root.removeEventListener('htmx:oobAfterSwap', onSwap);
    if (observer) observer.disconnect();
    observer = null;
    if (liveRegion) liveRegion.remove();
    liveRegion = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
