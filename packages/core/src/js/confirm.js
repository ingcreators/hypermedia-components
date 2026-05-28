// confirm-action behavior.
//
// Contract (plan §13.2):
//   1. Intercept clicks on elements with `data-hc-confirm`.
//   2. Show a shared modal dialog with the message.
//   3. If the user confirms, dispatch a bubbling `confirmed` event on
//      the original element.
//   4. htmx — listening for `data-hx-trigger="confirmed"` — fires the
//      request. The behavior does not wrap fetch().
//
// installConfirm() returns an `uninstall` function that removes the
// click listener and detaches the shared dialog. Repeated calls on the
// same root are idempotent and return the same uninstaller.
//
// Customization attributes (all optional):
//   data-hc-confirm            (required) message body
//   data-hc-confirm-title      dialog title (default "Confirm")
//   data-hc-confirm-label      confirm-button label (default "Confirm")
//   data-hc-cancel-label       cancel-button label (default "Cancel")
//   data-hc-confirm-variant    confirm-button variant; falls back to
//                              the source's own data-variant, then
//                              "primary".

const INSTALL_KEY = '__hcConfirmUninstall';

function buildDialog(ownerDocument) {
  const dialog = ownerDocument.createElement('dialog');
  dialog.className = 'hc-dialog hc-confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'hc-confirm-title');
  dialog.setAttribute('aria-describedby', 'hc-confirm-message');
  dialog.innerHTML = [
    '<header class="hc-dialog__header">',
    '  <h2 class="hc-dialog__title" id="hc-confirm-title">Confirm</h2>',
    '</header>',
    '<div class="hc-dialog__body" id="hc-confirm-message"></div>',
    '<footer class="hc-dialog__footer">',
    '  <button class="hc-button" type="button" data-hc-confirm-cancel>Cancel</button>',
    '  <button class="hc-button" type="button" data-variant="primary" data-hc-confirm-ok>Confirm</button>',
    '</footer>',
  ].join('\n');
  return dialog;
}

/**
 * Install the confirm-action behavior on the given document.
 *
 * On every click of an element with `data-hc-confirm`, the behavior
 * shows a shared `<dialog class="hc-confirm-dialog">`. If the user
 * confirms, the original element receives a bubbling `confirmed`
 * event so htmx (listening via `data-hx-trigger="confirmed"`) fires
 * the request.
 *
 * The shared dialog is created lazily on first use, reused between
 * triggers, and recreated if it gets detached from the DOM. Multiple
 * calls to `installConfirm` on the same root return the same
 * uninstaller; the listener is only registered once.
 *
 * @param {Document} [root=document]
 *   The document whose `click` events should be intercepted. Defaults
 *   to the global document when available.
 * @returns {() => void}
 *   An uninstaller. Calling it removes the click listener and detaches
 *   the shared dialog. A no-op when the behavior is not installed.
 *
 * @example
 * import { installConfirm } from '@hypermedia-components/core';
 * const uninstall = installConfirm();
 * // …later…
 * uninstall();
 */
export function installConfirm(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  let sharedDialog = null;
  let pendingSource = null;

  function getDialog() {
    if (!sharedDialog || !sharedDialog.isConnected) {
      sharedDialog = buildDialog(root);
      const cancelBtn = sharedDialog.querySelector('[data-hc-confirm-cancel]');
      const okBtn = sharedDialog.querySelector('[data-hc-confirm-ok]');

      cancelBtn.addEventListener('click', () => sharedDialog.close('cancel'));
      okBtn.addEventListener('click', () => sharedDialog.close('confirm'));

      sharedDialog.addEventListener('close', () => {
        const source = pendingSource;
        const result = sharedDialog.returnValue;
        pendingSource = null;
        if (!source) return;
        if (result === 'confirm') {
          source.dispatchEvent(new CustomEvent('confirmed', { bubbles: true }));
        }
      });

      root.body.appendChild(sharedDialog);
    }
    return sharedDialog;
  }

  function onCapturedClick(event) {
    const source = event.target.closest('[data-hc-confirm]');
    if (!source) return;

    // Block the original interaction — htmx (or a default form submit)
    // must not fire yet. If the user confirms we re-emit as `confirmed`.
    event.preventDefault();
    event.stopPropagation();

    const dialog = getDialog();

    const message = source.getAttribute('data-hc-confirm') || 'Continue?';
    const title = source.getAttribute('data-hc-confirm-title') || 'Confirm';
    const confirmLabel = source.getAttribute('data-hc-confirm-label') || 'Confirm';
    const cancelLabel = source.getAttribute('data-hc-cancel-label') || 'Cancel';
    const variant =
      source.getAttribute('data-hc-confirm-variant') ||
      source.getAttribute('data-variant') ||
      'primary';

    dialog.querySelector('#hc-confirm-title').textContent = title;
    dialog.querySelector('#hc-confirm-message').textContent = message;

    const okBtn = dialog.querySelector('[data-hc-confirm-ok]');
    okBtn.textContent = confirmLabel;
    okBtn.setAttribute('data-variant', variant);

    dialog.querySelector('[data-hc-confirm-cancel]').textContent = cancelLabel;

    pendingSource = source;
    dialog.returnValue = '';
    dialog.showModal();

    // Focus the cancel button by default — safer for destructive actions.
    dialog.querySelector('[data-hc-confirm-cancel]').focus();
  }

  root.addEventListener('click', onCapturedClick, true);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('click', onCapturedClick, true);
    if (sharedDialog && sharedDialog.isConnected) sharedDialog.remove();
    sharedDialog = null;
    pendingSource = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
