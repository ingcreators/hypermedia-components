// close-popover behavior (plan §13.5).
//
// Contract:
//   - The element has `data-hc-close-popover-on-success`.
//   - After an htmx request succeeds the behavior finds the closest
//     [popover] ancestor and calls hidePopover().
//   - On failure the popover stays open.
//   - The nearest carrier wins: an inner region carrying
//     `data-hc-close-popover-on-success="false"` opts its own requests
//     out, so a panel that edits itself (add / remove a sort key, a
//     column) stays open while its Apply still closes it.
//
// installClosePopover() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcClosePopoverUninstall';

function onAfterRequest(event) {
  const target = event.target;
  if (!target || typeof target.matches !== 'function') return;
  const opener = target.closest('[data-hc-close-popover-on-success]');
  if (!opener) return;

  // The NEAREST carrier wins, so a region inside the panel can opt out
  // with `="false"`. Panels that edit themselves need this: a sort or
  // column list whose add / remove round trips succeed would otherwise
  // dismiss the panel the user is still working in.
  if (opener.getAttribute('data-hc-close-popover-on-success') === 'false') return;

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
