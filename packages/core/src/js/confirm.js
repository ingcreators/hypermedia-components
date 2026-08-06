// confirm-action behavior.
//
// Contract (plan §13.2):
//   1. Intercept clicks on elements with `data-hc-confirm`.
//   2. Show a shared modal dialog with the message.
//   3. If the user confirms, dispatch a bubbling `hc:confirmed` event on
//      the original element.
//   4. htmx — listening for `data-hx-trigger="hc:confirmed"` — fires the
//      request. The behavior does not wrap fetch().
//   5. If the source is a submit button of a plain (non-htmx) form, the
//      behavior additionally calls `form.requestSubmit(source)` so the
//      intercepted submission completes — with the source as submitter
//      (its formaction/formmethod honored) and constraint validation run.
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

import { t } from './i18n.js';

const INSTALL_KEY = '__hcConfirmUninstall';

const HX_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

function hasHxVerb(el) {
  return HX_VERBS.some(
    (verb) => el.hasAttribute(`hx-${verb}`) || el.hasAttribute(`data-hx-${verb}`),
  );
}

// The form to submit on confirm when the source is a plain submit button:
// a <button>/<input> whose resolved type is "submit" (a type-less <button>
// counts), form-associated, with no htmx verb on itself or its form —
// htmx-wired elements keep the hc:confirmed contract and must not
// double-fire. Returns null when the intercepted click would not have
// submitted a plain form.
function plainSubmitForm(source) {
  const tag = source.tagName;
  if (tag !== 'BUTTON' && tag !== 'INPUT') return null;
  if (source.type !== 'submit') return null;
  const form = source.form;
  if (!form) return null;
  if (hasHxVerb(source) || hasHxVerb(form)) return null;
  return form;
}

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
 * confirms, the original element receives a bubbling `hc:confirmed`
 * event so htmx (listening via `data-hx-trigger="hc:confirmed"`) fires
 * the request. When the element is a submit button of a plain form —
 * no htmx verb attribute on the button or the form — the form is also
 * submitted via `form.requestSubmit(source)`, preserving the submitter
 * and running constraint validation, so the confirmed action completes
 * without htmx.
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
          source.dispatchEvent(new CustomEvent('hc:confirmed', { bubbles: true }));
          const form = plainSubmitForm(source);
          if (form) form.requestSubmit(source);
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
    // must not fire yet. If the user confirms we re-emit as `hc:confirmed`.
    event.preventDefault();
    event.stopPropagation();

    const dialog = getDialog();

    const message = source.getAttribute('data-hc-confirm') || t('confirm.message');
    const title = source.getAttribute('data-hc-confirm-title') || t('confirm.title');
    const confirmLabel = source.getAttribute('data-hc-confirm-label') || t('confirm.confirm');
    const cancelLabel = source.getAttribute('data-hc-cancel-label') || t('confirm.cancel');
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
