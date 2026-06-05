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
//   }

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

function renderToast(ownerDocument, detail) {
  const variant = detail.variant || 'info';
  const isUrgent = variant === 'error';

  const toast = ownerDocument.createElement('div');
  toast.className = 'hc-toast';
  toast.setAttribute('data-variant', variant);
  toast.setAttribute('role', isUrgent ? 'alert' : 'status');
  toast.setAttribute('aria-live', isUrgent ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');

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

  return toast;
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
 */

/**
 * Install the toast behavior on the given document.
 *
 * The behavior listens for `hc:toast` `CustomEvent`s on
 * `document.body`. On each event, it renders a `.hc-toast` into the
 * first `[data-hc-toast-region]` element, creating the region itself
 * if absent. Each toast auto-dismisses after `detail.duration` ms.
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

    const toast = renderToast(root, detail);
    region.appendChild(toast);

    const duration = Number.isFinite(detail.duration)
      ? Number(detail.duration)
      : DEFAULT_DURATION_MS;

    if (duration > 0) {
      setTimeout(() => {
        toast.remove();
      }, duration);
    }
  }

  root.body.addEventListener('hc:toast', onToast);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.body.removeEventListener('hc:toast', onToast);
    if (createdRegion && createdRegion.isConnected) createdRegion.remove();
    createdRegion = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
