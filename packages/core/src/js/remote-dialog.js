// remote-dialog behavior (plan §15.5).
//
// Contract:
//   - A host element marked with `data-hc-remote-dialog-root` receives
//     an htmx swap containing a <dialog class="hc-dialog">.
//   - After the swap settles, this behavior finds the first <dialog>
//     descendant of the host and calls showModal() so the dialog
//     becomes visible without the consumer wiring extra JS.
//   - Dismissal is the dialog's own concern — either the form inside
//     uses `data-hc-close-dialog-on-success`, or the dialog's
//     Cancel button calls `dialog.close()` directly.
//
// installRemoteDialog() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcRemoteDialogUninstall';

function onAfterSwap(event) {
  const target = event.target;
  if (!target || typeof target.matches !== 'function') return;
  if (!target.matches('[data-hc-remote-dialog-root]')) return;

  const dialog = target.querySelector('dialog');
  if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
    dialog.showModal();
  }
}

/**
 * Install the remote-dialog behavior (plan §15.5).
 *
 * On every `htmx:afterSwap` whose target carries
 * `data-hc-remote-dialog-root`, the behavior finds the first
 * `<dialog>` descendant and opens it with `showModal()`. If the
 * dialog is already open, it is left alone.
 *
 * Multiple calls on the same root return the same uninstaller.
 *
 * @param {Document} [root=document]
 * @returns {() => void} Uninstaller.
 *
 * @example
 * // <button data-hx-get="/items/1/edit"
 * //         data-hx-target="#dialog-root"
 * //         data-hx-swap="innerHTML">Edit</button>
 * // <div id="dialog-root" data-hc-remote-dialog-root></div>
 * //
 * // Server returns <dialog class="hc-dialog">…</dialog>;
 * // the behavior calls .showModal() automatically.
 */
export function installRemoteDialog(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  root.body.addEventListener('htmx:afterSwap', onAfterSwap);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.body.removeEventListener('htmx:afterSwap', onAfterSwap);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
