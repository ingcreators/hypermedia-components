// installValidation — surface native HTML constraint validation inside
// `.hc-field`, with no per-field wiring.
//
// The browser already validates `required`, `type="email"`, `pattern`,
// `min` / `max`, `minlength`, etc., and exposes a localized message via
// `control.validationMessage`. This behavior wires that into the field:
//
//   - On blur (and live, once a control has been validated once) it checks
//     the control. When invalid it writes `validationMessage` into the
//     field's `.hc-field__error` (created if absent), sets
//     `aria-invalid="true"` on the control and `data-invalid="true"` on the
//     field, and points the control's `aria-describedby` at the error.
//   - When the control becomes valid it clears all of that.
//   - The native `invalid` event (e.g. on form submit) is intercepted so the
//     browser's default bubble is replaced by the inline message; submission
//     is still blocked by the browser as usual.
//
// Styling is independent: the controls also paint themselves via the CSS
// `:user-invalid` rules, so the *visual* invalid state needs no JS at all —
// this behavior adds the message text and ARIA wiring.
//
// State lives in HTML attributes; the behavior is idempotent and returns an
// uninstaller.

import { fieldOf, getOrCreateError } from './field-error-core.js';

const INSTALL_KEY = '__hcValidationUninstall';

// A control the browser will constraint-validate, inside a field.
function isValidatable(el) {
  return (
    el &&
    typeof el.willValidate === 'boolean' &&
    el.willValidate &&
    typeof el.checkValidity === 'function' &&
    fieldOf(el) != null
  );
}

function renderError(control) {
  const field = fieldOf(control);
  if (!field) return;
  control.dataset.hcValidated = '';
  control.setAttribute('aria-invalid', 'true');
  field.setAttribute('data-invalid', 'true');
  const error = getOrCreateError(field, control);
  error.textContent = control.validationMessage;
  // The native message reflects the *current* value, so it supersedes a
  // server-sent error (installFieldErrors) that may occupy the same slot.
  delete control.dataset.hcServerInvalid;
  error.removeAttribute('data-hc-server-error');
}

function clearError(control) {
  const field = fieldOf(control);
  if (!field) return;
  control.removeAttribute('aria-invalid');
  field.removeAttribute('data-invalid');
  const error = field.querySelector('.hc-field__error');
  if (error) error.textContent = '';
}

/**
 * Install constraint-validation messaging on the given root.
 *
 * @param {Document|Element} [root]
 *   The root whose `.hc-field` controls should be wired. Defaults to the
 *   global document when available.
 * @returns {() => void} an idempotent uninstaller.
 */
export function installValidation(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onInvalid(event) {
    const el = event.target;
    if (!isValidatable(el)) return;
    // Replace the browser's default bubble with our inline message; the
    // form is still blocked from submitting by the browser.
    event.preventDefault();
    renderError(el);
  }

  function onBlur(event) {
    const el = event.target;
    if (!isValidatable(el)) return;
    // A server-sent error (installFieldErrors) is not ours to clear — the
    // control may be natively valid yet still rejected by the server.
    if (el.dataset.hcServerInvalid != null) return;
    // checkValidity() fires `invalid` (→ renderError) when invalid.
    if (el.checkValidity()) clearError(el);
  }

  function onInput(event) {
    const el = event.target;
    if (!isValidatable(el)) return;
    if (el.dataset.hcServerInvalid != null) return;
    // Only validate live once the control has been validated at least once,
    // so we never flag a field the user hasn't finished with.
    if (el.dataset.hcValidated == null) return;
    if (el.checkValidity()) clearError(el);
  }

  // `invalid` and `blur` do not bubble — listen in the capture phase.
  root.addEventListener('invalid', onInvalid, true);
  root.addEventListener('blur', onBlur, true);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('invalid', onInvalid, true);
    root.removeEventListener('blur', onBlur, true);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onInput);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
