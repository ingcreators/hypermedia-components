// close-dialog behavior (plan §13.4).
//
// Contract:
//   - The element has `data-hc-close-dialog-on-success`.
//   - After an htmx request succeeds the behavior finds the closest
//     <dialog> ancestor of the requesting element and calls close().
//   - On failure the dialog stays open so the user can see the error.
//   - The nearest carrier wins: an inner region carrying
//     `data-hc-close-dialog-on-success="false"` opts its own requests
//     out, so a panel that edits itself stays open while Apply closes it.
//
// installCloseDialog() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcCloseDialogUninstall';

function onAfterRequest(event) {
  const target = event.target;
  if (!target || typeof target.matches !== 'function') return;
  const carrier = target.closest('[data-hc-close-dialog-on-success]');
  if (!carrier) return;

  // The NEAREST carrier wins, so a region inside the dialog can opt out
  // with `="false"` — a panel that edits itself (add / remove a sort
  // key, a column) must not be dismissed by its own round trips.
  if (carrier.getAttribute('data-hc-close-dialog-on-success') === 'false') return;

  const detail = event.detail || {};
  // htmx sets `successful` to true for 2xx responses.
  if (detail.successful !== true) return;

  const dialog = carrier.closest('dialog');
  if (dialog && typeof dialog.close === 'function') {
    dialog.close();
  }
}

/**
 * Install the close-dialog behavior (plan §13.4).
 *
 * On every `htmx:afterRequest` event whose target (or one of its
 * ancestors) carries `data-hc-close-dialog-on-success`, the behavior
 * checks `detail.successful === true`. If the request succeeded it
 * calls `close()` on the closest `<dialog>` ancestor. On failure the
 * dialog stays open so the user can see the error.
 *
 * Multiple calls on the same root return the same uninstaller.
 *
 * @param {Document} [root=document]
 * @returns {() => void} Uninstaller.
 *
 * @example
 * // <dialog class="hc-dialog">
 * //   <form data-hx-post="/items"
 * //         data-hx-target="closest dialog"
 * //         data-hx-swap="outerHTML"
 * //         data-hc-close-dialog-on-success>
 * //     …
 * //   </form>
 * // </dialog>
 *
 * import { installCloseDialog } from '@hypermedia-components/core';
 * installCloseDialog();
 */
export function installCloseDialog(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  root.body.addEventListener('htmx:afterRequest', onAfterRequest);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.body.removeEventListener('htmx:afterRequest', onAfterRequest);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
