// installPasswordToggle — opt-in show/hide toggle for a password field.
//
//   <div class="hc-input-group">
//     <input class="hc-input" type="password" id="pw">
//     <button type="button" class="hc-button" data-variant="ghost"
//             data-hc-password-toggle aria-controls="pw"
//             aria-pressed="false" aria-label="Show password">👁</button>
//   </div>
//
// A click toggles the input's type between `password` and `text` and
// reflects the state on the button: `aria-pressed` plus an `aria-label`
// that swaps between the show / hide wording. Labels come from
// `data-hc-label-show` / `data-hc-label-hide` (defaults "Show password" /
// "Hide password") so they can be localized in markup.
//
// The button is found via `aria-controls`, or — as a fallback — the nearest
// <input> in the same `.hc-input-group`. No network, no field value access.
//
// installPasswordToggle(root = document) returns an idempotent uninstaller.

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcPasswordToggleUninstall';
const SELECTOR = '[data-hc-password-toggle]';

function fieldFor(btn) {
  const doc = btn.ownerDocument || document;
  const id = btn.getAttribute('aria-controls');
  if (id) {
    const el = doc.getElementById(id);
    if (el) return el;
  }
  const group = btn.closest('.hc-input-group');
  return group ? group.querySelector('input') : null;
}

function reflect(btn, field) {
  const revealed = field.type === 'text';
  btn.setAttribute('aria-pressed', String(revealed));
  const show = btn.getAttribute('data-hc-label-show') || 'Show password';
  const hide = btn.getAttribute('data-hc-label-hide') || 'Hide password';
  btn.setAttribute('aria-label', revealed ? hide : show);
}

function attach(btn, detachers) {
  if (detachers.has(btn)) return;
  const field = fieldFor(btn);
  if (!field) return;
  if (btn.getAttribute('type') == null) btn.setAttribute('type', 'button');
  reflect(btn, field);

  const onClick = () => {
    field.type = field.type === 'password' ? 'text' : 'password';
    reflect(btn, field);
  };
  btn.addEventListener('click', onClick);
  detachers.set(btn, () => btn.removeEventListener('click', onClick));
}

/**
 * Install the opt-in password-reveal toggle on every
 * `[data-hc-password-toggle]` button in the document.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installPasswordToggle(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const btn of root.querySelectorAll(SELECTOR)) attach(btn, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(SELECTOR)) attach(node, detachers);
          node.querySelectorAll?.(SELECTOR).forEach((el) => attach(el, detachers));
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
