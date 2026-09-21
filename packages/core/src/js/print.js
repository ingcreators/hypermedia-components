// installPrint — a declarative Print button.
//
//   <button class="hc-button" type="button" data-hc-print>Print</button>
//
// Activating the button calls `window.print()`. That is the whole
// behavior: HTML has no declarative print the way it now has
// `commandfor` / `command="show-modal"` for dialogs, and the alternative —
// `onclick="window.print()"` — is inline script, dead under a strict
// Content-Security-Policy. hc.print.css already hides `.hc-button` on
// paper, so the button itself never prints.
//
// Whole-page print only. Printing a subtree is a *print view* the server
// renders (see fundamentals/print) — out of scope here. Without
// JavaScript the button does nothing; Ctrl/Cmd+P remains.
//
// Root-delegated, idempotent, returns an uninstaller.

const INSTALL_KEY = '__hcPrintUninstall';
const SELECTOR = '[data-hc-print]';

function onClick(event) {
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return;
  const button = target.closest(SELECTOR);
  if (!button) return;
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
  event.preventDefault();
  const win = button.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  if (win && typeof win.print === 'function') win.print();
}

/**
 * Install the declarative Print button: a click on any `[data-hc-print]`
 * element calls `window.print()`.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} Uninstaller. Idempotent per root.
 */
export function installPrint(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  // A type-less <button> inside a form would submit it as well.
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (el.tagName === 'BUTTON' && el.getAttribute('type') == null) el.setAttribute('type', 'button');
  }

  const listenTarget = root.body ?? root;
  listenTarget.addEventListener('click', onClick);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    listenTarget.removeEventListener('click', onClick);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
