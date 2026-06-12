// Shared field-error plumbing for `installValidation()` (native constraint
// validation) and `installFieldErrors()` (server-sent validation errors).
//
// Both behaviors surface a message inside a field's `.hc-field__error`
// element with identical ARIA wiring (`aria-describedby` on the control,
// `aria-live` on the message). Keeping the mechanics in one module
// guarantees the two error sources stay byte-identical instead of
// drifting copies. Internal module — not part of the public entry.

let errorIdSeq = 0;

/** @param {Element} control */
export function fieldOf(control) {
  return control?.closest?.('.hc-field') ?? null;
}

/**
 * Append `id` to the control's `aria-describedby` token list (idempotent).
 *
 * @param {Element} control
 * @param {string} id
 */
export function ensureDescribedBy(control, id) {
  const existing = (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (!existing.includes(id)) {
    existing.push(id);
    control.setAttribute('aria-describedby', existing.join(' '));
  }
}

/**
 * Remove `id` from the control's `aria-describedby` token list, dropping
 * the attribute entirely when no tokens remain.
 *
 * @param {Element} control
 * @param {string} id
 */
export function pruneDescribedBy(control, id) {
  const existing = (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== id);
  if (existing.length) {
    control.setAttribute('aria-describedby', existing.join(' '));
  } else {
    control.removeAttribute('aria-describedby');
  }
}

/**
 * Find or create the field's `.hc-field__error` element, give it a stable
 * id, and point the control's `aria-describedby` at it.
 *
 * @param {Element} field
 * @param {Element} control
 * @returns {Element}
 */
export function getOrCreateError(field, control) {
  let error = field.querySelector('.hc-field__error');
  if (!error) {
    error = field.ownerDocument.createElement('p');
    error.className = 'hc-field__error';
    error.setAttribute('aria-live', 'polite');
    field.appendChild(error);
  }
  if (!error.id) error.id = `hc-field-error-${(errorIdSeq += 1)}`;
  ensureDescribedBy(control, error.id);
  return error;
}
