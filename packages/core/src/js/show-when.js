// installShowWhen — declarative conditional field visibility (#428).
//
//   <form>
//     <label class="hc-field">
//       <span class="hc-field__label">Operation</span>
//       <select class="hc-select" name="op" data-hc-show-switch>
//         <option value="insert">insert</option>
//         <option value="update">update</option>
//         <option value="delete">delete</option>
//       </select>
//     </label>
//
//     <div class="hc-field" data-hc-show-when="update delete">
//       <!-- filter column — only modes that read it -->
//     </div>
//   </form>
//
// A form whose fields depend on a mode selector has no HTML primitive to
// hide the fields the chosen mode does not read. This behavior owns that
// wiring declaratively, so it works under a strict
// `Content-Security-Policy: default-src 'self'` with no inline JS:
//
//   - `data-hc-show-when="<value> [<value> …]"` names the switch values
//     under which the element is visible (whitespace-separated).
//   - The controlling input is the closest form's `[data-hc-show-switch]`
//     control; `data-hc-show-src="<selector>"` overrides it for
//     cross-form cases (resolved against the document).
//   - Visibility is the `hidden` attribute — never inline styles — so
//     CSS keeps working and server-rendered `hidden` state is honored
//     until the first evaluation.
//   - Hidden controls keep submitting. Filtering values is the server's
//     job; visibility is presentation.
//
// Evaluation runs once at install (server-rendered state is corrected
// before any interaction), on every `change` from a switch, and for
// content added later (htmx swaps) via a MutationObserver plus the
// `htmx:afterSwap` / `htmx:oobAfterSwap` events.
//
// installShowWhen(root = document) returns an idempotent uninstaller.

const INSTALL_KEY = '__hcShowWhenUninstall';
const SELECTOR = '[data-hc-show-when]';
const SWITCH_SELECTOR = '[data-hc-show-switch]';

function switchFor(el, root) {
  const src = el.getAttribute('data-hc-show-src');
  if (src) {
    try {
      return (el.ownerDocument || root).querySelector(src);
    } catch {
      return null; // invalid selector — treat as no switch
    }
  }
  const scope = el.closest('form') || el.ownerDocument || root;
  return scope.querySelector(SWITCH_SELECTOR);
}

/**
 * Current value of a switch control.
 *
 * A radio reports the checked radio of its group (empty string when none
 * is checked); a checkbox reports its `value` (default `"on"`) when
 * checked and the empty string otherwise; everything else reports
 * `.value`.
 *
 * @param {Element|null} control
 * @returns {string|null} the value, or null when there is no control
 */
export function switchValue(control) {
  if (!control) return null;
  if (control.type === 'radio') {
    if (!control.name) return control.checked ? control.value : '';
    const scope = control.form || control.ownerDocument;
    for (const radio of scope.querySelectorAll('input[type="radio"]')) {
      if (radio.name === control.name && radio.checked) return radio.value;
    }
    return '';
  }
  if (control.type === 'checkbox') return control.checked ? control.value || 'on' : '';
  return control.value ?? '';
}

/**
 * Install the conditional-visibility behavior on the given document.
 *
 * Elements carrying `data-hc-show-when="<value> [<value> …]"` get their
 * `hidden` attribute toggled so they are visible only while the
 * controlling switch — the closest form's `[data-hc-show-switch]`
 * control, or the `data-hc-show-src` selector override — has one of the
 * listed values. Evaluation happens at install time, on `change`, and
 * for elements added later (htmx swaps). An element whose switch cannot
 * be resolved is left untouched.
 *
 * @param {Document} [root=document]
 * @returns {() => void} idempotent uninstaller
 *
 * @example
 * import { installShowWhen } from '@hypermedia-components/core';
 * const uninstall = installShowWhen();
 */
export function installShowWhen(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function evaluate(el) {
    const control = switchFor(el, root);
    if (!control) return; // unresolvable switch — leave visibility alone
    const value = switchValue(control);
    const shown = (el.getAttribute('data-hc-show-when') || '')
      .trim()
      .split(/\s+/)
      .includes(value);
    el.toggleAttribute('hidden', !shown);
  }

  function evaluateAll(scope) {
    if (scope.matches && scope.matches(SELECTOR)) evaluate(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(SELECTOR).forEach(evaluate);
  }

  function onChange() {
    // Any change may move a switch (marked control, a radio of a marked
    // group, or a data-hc-show-src target); re-evaluating every marked
    // element is cheap and closes the identification holes a narrower
    // guard would open.
    evaluateAll(root.nodeType === 9 ? root.documentElement : root);
  }

  function onSwap(event) {
    const el = event.target;
    if (el && el.nodeType === 1) evaluateAll(el);
  }

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType === 1) evaluateAll(node);
        }
      }
    });
    observer.observe(root.body || root, { childList: true, subtree: true });
  }

  root.addEventListener('change', onChange);
  root.addEventListener('htmx:afterSwap', onSwap);
  root.addEventListener('htmx:oobAfterSwap', onSwap);

  evaluateAll(root.nodeType === 9 ? root.documentElement : root);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('change', onChange);
    root.removeEventListener('htmx:afterSwap', onSwap);
    root.removeEventListener('htmx:oobAfterSwap', onSwap);
    if (observer) observer.disconnect();
    observer = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
