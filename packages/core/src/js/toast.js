// toast behavior.
//
// Contract (plan §13.3):
//   - Code anywhere on the page dispatches `hc:toast` on document.body
//     (or the server returns HX-Trigger: {"hc:toast":{…}}).
//   - The behavior renders a toast into the first
//     [data-hc-toast-region] element. If no region exists, one is
//     created lazily and appended to <body>.
//   - The toast auto-dismisses after `duration` ms (default 4500).
//     duration=0 keeps it until removed manually.
//
// installToast() returns an `uninstall` function that removes the
// event listener (and the lazily-created region, if any). Idempotent.
//
// Event detail shape:
//   {
//     message: string,                     // required
//     title?: string,
//     variant?: 'info' | 'success' | 'warning' | 'error',
//     duration?: number,                   // ms; 0 = sticky
//     id?: string,                         // update an existing toast in place
//     action?: { label: string, event: string },  // a button that fires `event`
//   }
//
// Lifecycle / promise pattern: fire a sticky loading toast with an `id`
// (`duration: 0`), then a later `hc:toast` with the SAME `id` updates it to
// success / error in place. The network stays with htmx — typically a request
// returns `HX-Trigger: {"hc:toast": {...}}` for each phase.
//
// Action button: `action: { label, event }` renders a button that, on click,
// dispatches a bubbling `event` (catchable by htmx `hx-trigger="<event>"` on
// any ancestor, or a plain listener) and dismisses the toast.

import { t } from './i18n.js';

const DEFAULT_DURATION_MS = 4500;
const INSTALL_KEY = '__hcToastUninstall';

function getOrCreateRegion(root) {
  let region = root.querySelector('[data-hc-toast-region]');
  if (region) return { region, created: false };
  region = root.createElement('div');
  region.className = 'hc-toast-region';
  region.setAttribute('data-hc-toast-region', '');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', t('toast.label'));
  root.body.appendChild(region);
  return { region, created: true };
}

// (Re)populate a toast element from a detail. Used on create AND on an
// update-by-id, so a loading toast can become a success / error in place.
function applyContent(ownerDocument, toast, detail) {
  const variant = detail.variant || 'info';
  const isUrgent = variant === 'error';

  toast.setAttribute('data-variant', variant);
  toast.setAttribute('role', isUrgent ? 'alert' : 'status');
  toast.setAttribute('aria-live', isUrgent ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');
  if (detail.id != null) toast.setAttribute('data-toast-id', String(detail.id));

  toast.replaceChildren();

  if (detail.title) {
    const title = ownerDocument.createElement('div');
    title.className = 'hc-toast__title';
    title.textContent = String(detail.title);
    toast.appendChild(title);
  }

  const body = ownerDocument.createElement('div');
  body.className = 'hc-toast__body';
  body.textContent = String(detail.message ?? '');
  toast.appendChild(body);

  // Optional action button. Clicking it dispatches a bubbling event the
  // author / htmx can catch (e.g. Undo), then dismisses the toast. The config
  // is stashed for the delegated click handler so updates keep working.
  const action = detail.action;
  if (action && action.label && action.event) {
    const btn = ownerDocument.createElement('button');
    btn.className = 'hc-toast__action';
    btn.type = 'button';
    btn.textContent = String(action.label);
    toast.appendChild(btn);
    toast._hcAction = { id: detail.id ?? null, event: String(action.event), action };
  } else {
    toast._hcAction = null;
  }

  // Visible dismiss affordance. Sticky toasts (duration: 0) are otherwise
  // only dismissable via swipe or Escape-with-focus — neither of which a
  // mouse user can discover. Re-created here so update-by-id keeps it.
  const close = ownerDocument.createElement('button');
  close.className = 'hc-toast__close';
  close.type = 'button';
  close.setAttribute('aria-label', t('toast.dismiss'));
  const glyph = ownerDocument.createElement('span');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '×';
  close.appendChild(glyph);
  toast.appendChild(close);
}

function createToast(ownerDocument, detail) {
  const toast = ownerDocument.createElement('div');
  toast.className = 'hc-toast';
  applyContent(ownerDocument, toast, detail);
  return toast;
}

// Remove a toast and cancel its pending auto-dismiss timer. Idempotent.
function removeToast(toast) {
  if (toast._hcTimer) {
    clearTimeout(toast._hcTimer);
    toast._hcTimer = null;
  }
  toast.remove();
}

// Cap the number of visible toasts via `data-limit` on the region; evict the
// oldest (first in DOM order, regardless of stack direction).
function enforceLimit(region) {
  const limit = parseInt(region.getAttribute('data-limit') ?? '', 10);
  if (!Number.isFinite(limit) || limit <= 0) return;
  while (region.children.length > limit && region.firstElementChild) {
    removeToast(region.firstElementChild);
  }
}

// Swipe-to-dismiss: drag a toast horizontally past ~40% of its width to fly it
// out; release short of that to snap back. Pointer-only (keyboard users rely
// on auto-dismiss). Vertical pans scroll the page (touch-action: pan-y).
function wireSwipe(toast) {
  let startX = 0;
  let dx = 0;
  let width = 1;
  let dragging = false;

  function onDown(event) {
    if (event.button != null && event.button !== 0) return; // primary only
    // Don't start a swipe (or capture the pointer) on the action / close
    // buttons — that would steal their clicks. Let them activate normally.
    if (event.target.closest?.('.hc-toast__action, .hc-toast__close')) return;
    dragging = true;
    startX = event.clientX;
    dx = 0;
    width = toast.offsetWidth || 1;
    toast.style.transition = 'none';
    toast.setPointerCapture?.(event.pointerId);
  }

  function onMove(event) {
    if (!dragging) return;
    dx = event.clientX - startX;
    toast.style.translate = `${dx}px`;
    toast.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / width));
  }

  function onUp(event) {
    if (!dragging) return;
    dragging = false;
    toast.releasePointerCapture?.(event.pointerId);
    toast.style.transition = ''; // restore the CSS transition for the finish
    if (Math.abs(dx) > width * 0.4) {
      const sign = dx < 0 ? -1 : 1;
      toast.style.translate = `${sign * (width + 40)}px`;
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => removeToast(toast), { once: true });
      setTimeout(() => removeToast(toast), 220); // fallback (reduced-motion)
    } else {
      toast.style.translate = '';
      toast.style.opacity = '';
    }
  }

  toast.addEventListener('pointerdown', onDown);
  toast.addEventListener('pointermove', onMove);
  toast.addEventListener('pointerup', onUp);
  toast.addEventListener('pointercancel', onUp);
}

// Wire the action button (once per toast — `_hcAction` is refreshed by
// applyContent, so the listener survives updates). Clicking dispatches a
// bubbling event named by `action.event` (so htmx `hx-trigger` or plain
// listeners on any ancestor can react), then dismisses the toast.
function wireActions(toast) {
  toast.addEventListener('click', (event) => {
    // The close button dismisses without dispatching anything.
    const close = event.target.closest?.('.hc-toast__close');
    if (close && toast.contains(close)) {
      removeToast(toast);
      return;
    }
    const btn = event.target.closest?.('.hc-toast__action');
    if (!btn || !toast.contains(btn) || !toast._hcAction) return;
    const { event: eventName, id, action } = toast._hcAction;
    toast.dispatchEvent(
      new CustomEvent(eventName, { bubbles: true, detail: { id, action, toast } }),
    );
    removeToast(toast);
  });
}

/**
 * @typedef {Object} HcToastDetail
 * @property {string} message              Required body text.
 * @property {string} [title]              Optional bold one-liner above the message.
 * @property {'info'|'success'|'warning'|'error'} [variant='info']
 *   Visual variant. `error` is mapped to `role="alert"` /
 *   `aria-live="assertive"` for assistive technology; other variants
 *   use `role="status"` / `aria-live="polite"`.
 * @property {number} [duration=4500]      Milliseconds until auto-dismiss. `0` keeps the toast indefinitely.
 * @property {string} [id]                 When set, a later `hc:toast` with the same id updates this toast in place (loading → success / error) instead of stacking a new one; the auto-dismiss timer resets to the new `duration`.
 * @property {{label: string, event: string}} [action]
 *   Renders a button labelled `label`; clicking it dispatches a bubbling
 *   `CustomEvent` named `event` (`detail { id, action, toast }`) and dismisses
 *   the toast. Catch it with htmx `hx-trigger="<event>"` or `addEventListener`.
 */

/**
 * Install the toast behavior on the given document.
 *
 * The behavior listens for `hc:toast` `CustomEvent`s on
 * `document.body`. On each event, it renders a `.hc-toast` into the
 * first `[data-hc-toast-region]` element, creating the region itself
 * if absent. Each toast auto-dismisses after `detail.duration` ms.
 *
 * The region may configure presentation in markup:
 *   - `data-position="{top|bottom}-{left|center|right}"` (default
 *     `bottom-right`) anchors the stack.
 *   - `data-limit="N"` caps the visible toasts, evicting the oldest.
 * Toasts can also be swiped horizontally to dismiss (pointer / touch).
 *
 * Multiple calls to `installToast` on the same root return the same
 * uninstaller; the listener is only registered once.
 *
 * @param {Document} [root=document]
 *   The document whose body should be observed. Defaults to the
 *   global document when available.
 * @returns {() => void}
 *   An uninstaller. Calling it removes the listener and detaches a
 *   region that was lazily created by the behavior (a region the
 *   consumer pre-rendered is left alone). A no-op when the behavior
 *   is not installed.
 *
 * @example
 * // Server fires a toast via HX-Trigger:
 * //   HX-Trigger: {"hc:toast":{"message":"Saved.","variant":"success"}}
 *
 * // Or from client code:
 * document.body.dispatchEvent(new CustomEvent('hc:toast', {
 *   bubbles: true,
 *   detail: { message: 'Saved.', variant: 'success' },
 * }));
 */
export function installToast(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  let createdRegion = null;

  function onToast(event) {
    const detail = event && event.detail;
    if (!detail || !detail.message) return;

    const { region, created } = getOrCreateRegion(root);
    if (created) createdRegion = region;

    // Update-by-id: a later toast carrying the same `id` updates the existing
    // one in place (loading → success / error) instead of stacking a new one.
    let toast = null;
    if (detail.id != null) {
      toast = [...region.querySelectorAll('.hc-toast')].find(
        (el) => el.getAttribute('data-toast-id') === String(detail.id),
      );
    }

    if (toast) {
      if (toast._hcTimer) {
        clearTimeout(toast._hcTimer);
        toast._hcTimer = null;
      }
      applyContent(root, toast, detail); // re-render content / variant in place
    } else {
      toast = createToast(root, detail);
      region.appendChild(toast);
      enforceLimit(region);
      wireSwipe(toast);
      wireActions(toast);
    }

    const duration = Number.isFinite(detail.duration)
      ? Number(detail.duration)
      : DEFAULT_DURATION_MS;

    if (duration > 0) {
      toast._hcTimer = setTimeout(() => removeToast(toast), duration);
    }
  }

  // Escape dismisses the toast that contains the focus (reachable via
  // its action button) — the keyboard counterpart of swipe-to-dismiss.
  // Without it a sticky toast (duration: 0) is undismissable without a
  // pointer. Scoped to focus-inside-a-toast so dialog Escape semantics
  // are untouched.
  function onKeydown(event) {
    if (event.key !== 'Escape') return;
    const toast = event.target && event.target.closest?.('.hc-toast');
    if (toast) removeToast(toast);
  }

  root.body.addEventListener('hc:toast', onToast);
  root.addEventListener('keydown', onKeydown);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.body.removeEventListener('hc:toast', onToast);
    root.removeEventListener('keydown', onKeydown);
    if (createdRegion && createdRegion.isConnected) createdRegion.remove();
    createdRegion = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
