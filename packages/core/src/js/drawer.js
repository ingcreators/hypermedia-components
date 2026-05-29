// installDrawer — minimal behavior for hc-drawer.
//
// The native <dialog> already handles focus trapping,
// Escape-to-close, and the ::backdrop layer. The only piece the
// platform does NOT give us out of the box is "click outside the
// drawer to close" — a UX users universally expect for slide-in
// panels. This behavior adds exactly that:
//
//   - On `click` events whose target is the dialog itself
//     (i.e. landed on the backdrop, not on the drawer's content
//     box), call `dialog.close()`.
//
// installDrawer(root = document) returns an uninstaller. Repeated
// calls on the same root return the same uninstaller.

const INSTALL_KEY = '__hcDrawerUninstall';

function attach(dialog, detachers) {
  if (detachers.has(dialog)) return;

  function onClick(event) {
    // The native <dialog> reports backdrop clicks with the dialog
    // itself as `event.target`. Clicks on content land on the
    // content element. Anything else (header / body / footer / a
    // button) skips this close path.
    if (event.target === dialog) {
      dialog.close();
    }
  }

  dialog.addEventListener('click', onClick);

  detachers.set(dialog, () => {
    dialog.removeEventListener('click', onClick);
  });
}

/**
 * Install the drawer behavior on every `.hc-drawer` in the document.
 * Adds backdrop-click-to-close to the native `<dialog>` element;
 * everything else (focus trap, Escape, the ::backdrop layer) is
 * already provided by the platform.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installDrawer(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-drawer')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-drawer')) attach(node, detachers);
          node.querySelectorAll?.('.hc-drawer').forEach((el) =>
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
