// close-popover behavior (plan §13.5).
//
// Contract:
//   - The element has `data-hc-close-popover-on-success`.
//   - After an htmx request succeeds the behavior finds the closest
//     [popover] ancestor and calls hidePopover().
//   - On failure the popover stays open.
//
// installClosePopover() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcClosePopoverUninstall';

function onAfterRequest(event) {
  const target = event.target;
  if (!target || typeof target.matches !== 'function') return;
  const opener = target.closest('[data-hc-close-popover-on-success]');
  if (!opener) return;

  const detail = event.detail || {};
  if (detail.successful !== true) return;

  const popover = opener.closest('[popover]');
  if (popover && typeof popover.hidePopover === 'function') {
    popover.hidePopover();
  }
}

/**
 * Install the close-popover behavior (plan §13.5).
 *
 * On every `htmx:afterRequest` event whose target (or one of its
 * ancestors) carries `data-hc-close-popover-on-success`, the
 * behavior calls `hidePopover()` on the closest `[popover]`
 * ancestor — but only when the request succeeded.
 *
 * Multiple calls on the same root return the same uninstaller.
 *
 * @param {Document} [root=document]
 * @returns {() => void} Uninstaller.
 *
 * @example
 * // <div class="hc-popover" popover>
 * //   <form data-hx-get="/items"
 * //         data-hx-target="#results"
 * //         data-hc-close-popover-on-success>
 * //     …
 * //   </form>
 * // </div>
 */
export function installClosePopover(root = (typeof document !== 'undefined' ? document : null)) {
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
