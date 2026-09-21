// installInvokerCommands — a feature-detected fallback for the invoker
// commands the kit blesses for dialogs (#624).
//
//   <button type="button" commandfor="filters" command="show-modal">Filters</button>
//   <dialog class="hc-dialog" id="filters">
//     …
//     <button type="button" commandfor="filters" command="close">Cancel</button>
//   </dialog>
//
// `commandfor` / `command` reached Baseline in 2025 (Chromium 135, Firefox
// 144, Safari 26). Below that floor the markup is silent: an iPad that
// stays on Safari 18, a Mac on Ventura's Safari 17, a Firefox ESR 140
// fleet — and a list page whose only way to compose a filter is the
// Filters dialog cannot be filtered at all. That is a functional loss,
// not a cosmetic one, so — like the anchor-positioning fallback, which
// covers a *newer* platform feature — the kit carries the script.
//
// Contract:
//   - Detection at install: if the engine implements the API
//     (`commandForElement` on HTMLButtonElement.prototype) nothing is
//     installed and a no-op uninstaller is returned — the native path is
//     untouched, so a supporting engine never sees a second showModal().
//   - Otherwise one delegated `click` listener (bubble phase, honours
//     `defaultPrevented`): a non-disabled, non-submit <button> carrying
//     `commandfor` + `command` resolves its target by id from the
//     button's root node (as the spec does) and performs the two
//     commands the kit blesses — `show-modal` on a <dialog> that is not
//     open, `close` on one that is. Anything else is left alone.
//   - Out of scope: the `command` event (CommandEvent), the popover
//     commands (the kit's popovers use `popovertarget`, Baseline 2024) and
//     custom `--` commands. A consumer who needs the full API loads
//     invokers-polyfill; the kit needs two commands.
//
// Focus return on close needs nothing: it is the <dialog> element's own
// behaviour for showModal(), on every engine that has <dialog>.
//
// Idempotent per root, self-retiring, returns an uninstaller.

const INSTALL_KEY = '__hcInvokerCommandsUninstall';
const SELECTOR = 'button[commandfor][command]';
const NOOP = () => {};

/**
 * Feature-detect the Invoker Commands API. Returns false where there is
 * no HTMLButtonElement at all (server-side), which routes that
 * environment through the fallback too — harmless without a document.
 *
 * @returns {boolean}
 */
export function supportsInvokerCommands() {
  return (
    typeof HTMLButtonElement !== 'undefined' &&
    'commandForElement' in HTMLButtonElement.prototype &&
    'command' in HTMLButtonElement.prototype
  );
}

function isSubmitButton(button) {
  // A submit button with a form owner ignores its command natively and
  // submits the form; the fallback must not do more than the platform.
  return button.type === 'submit' && button.form != null;
}

function onClick(event) {
  if (event.defaultPrevented) return;
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return;
  const button = target.closest(SELECTOR);
  if (!button) return;
  if (button.disabled || isSubmitButton(button)) return;

  const root = button.getRootNode();
  const id = button.getAttribute('commandfor');
  const dialog = root && typeof root.getElementById === 'function' && id ? root.getElementById(id) : null;
  if (!dialog || dialog.tagName !== 'DIALOG') return;

  const command = (button.getAttribute('command') || '').toLowerCase();
  if (command === 'show-modal') {
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
  } else if (command === 'close') {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
  }
}

/**
 * Install the invoker-commands fallback: on an engine without
 * `commandfor` / `command`, a delegated click listener performs
 * `command="show-modal"` and `command="close"` on the `<dialog>` the
 * button names. On an engine with the API nothing is installed.
 *
 * @param {Document} [root]
 * @returns {() => void} Uninstaller. Idempotent per root; a no-op where
 *   the engine is native.
 */
export function installInvokerCommands(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return NOOP;
  if (supportsInvokerCommands()) return NOOP;
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

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
