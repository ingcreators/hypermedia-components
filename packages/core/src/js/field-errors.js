// installFieldErrors — distribute a server-sent validation-error fragment
// to the form fields it names (recipe `field-errors`).
//
// The canonical fragment (the server returns this on e.g. a 422; htmx
// swaps it into a container inside — or pointed at — the form):
//
//   <div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
//     <p class="hc-alert__title">Unprocessable Entity</p>
//     <ul class="hc-alert__errors">
//       <li class="hc-alert__error" data-field="email" data-code="duplicate"
//           data-message-key="members.email.duplicate">email: duplicate</li>
//     </ul>
//     <p class="hc-alert__body">optional hint line</p>
//   </div>
//
// `data-hc-field-errors` is the opt-in: empty means "distribute into the
// closest form"; a non-empty value is a CSS selector for the form (for
// out-of-band swaps or an alert rendered outside the form).
//
// For each `.hc-alert__error[data-field]` whose name matches a control in
// the form, the behavior writes the message into the field's
// `.hc-field__error` (creating one after a bare control), sets
// `aria-invalid` + `aria-describedby` on the control and `data-invalid`
// on the field — the same wiring installValidation() uses — and marks the
// item `data-distributed` so the summary doesn't read it twice. Items
// naming no known control stay visible in the summary. The first invalid
// control is focused (opt out with `data-focus="none"` on the alert).
//
// Message resolution per item: `data-message-key` found in the i18n
// catalog → `t(key, { field, code, ...data-message-params })`; otherwise
// the item's own text; otherwise `t('fieldErrors.unknown')`. Localize once
// via `setMessages()`. `data-message-params` is an optional JSON object of
// server-provided interpolation values (constraint declarations, validation
// row columns) for translations with placeholders beyond {field}/{code}.
//
// Server errors are stale the moment the user edits the field or
// resubmits: cleared on first `input`/`change` per field, on `submit` /
// `reset` of the form, and before re-distributing a newly swapped-in
// fragment. Native constraint validation outranks a server error on the
// same control (the native message reflects the current value).
//
// The behavior never makes a request — htmx owns the network. State lives
// in HTML attributes; install is idempotent and returns an uninstaller.

import {
  ensureDescribedBy,
  fieldOf,
  getOrCreateError,
  pruneDescribedBy,
} from './field-error-core.js';
import { hasMessage, t } from './i18n.js';

const INSTALL_KEY = '__hcFieldErrorsUninstall';

function escapeName(name) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(name);
  return name.replace(/["\\]/g, '\\$&');
}

// Resolve the scope (normally the <form>) an alert distributes into.
function scopeOf(alert, root) {
  const selector = alert.getAttribute('data-hc-field-errors');
  if (selector) {
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    return doc.querySelector(selector);
  }
  return alert.closest('form');
}

// First control in the scope whose `name` matches. `form.elements`
// handles radio/checkbox groups natively (RadioNodeList). Hidden inputs
// are skipped when the group has a visible member: the blessed boolean
// idiom pairs `<input type="hidden" value="false">` with the real
// checkbox under one name, and the ARIA wiring, focus, and edit-to-clear
// belong on the control the user can operate.
function controlFor(scope, name) {
  let found;
  if (scope.elements && typeof scope.elements.namedItem === 'function') {
    found = scope.elements.namedItem(name);
  } else {
    found = scope.querySelectorAll(`[name="${escapeName(name)}"]`);
  }
  if (found && found.tagName == null && typeof found.length === 'number') {
    const members = Array.from(found); // RadioNodeList / NodeList
    found = members.find((el) => el.type !== 'hidden') ?? members[0];
  }
  return found ?? null;
}

function resolveMessage(item) {
  const key = item.getAttribute('data-message-key');
  const params = {
    field: item.getAttribute('data-field') ?? '',
    code: item.getAttribute('data-code') ?? '',
  };
  // Optional server-provided interpolation params (a JSON object), so a
  // catalog translation may use placeholders beyond {field}/{code} — e.g.
  // data-message-params='{"stock": 5}' for "在庫 {stock} を超えています。".
  // Item params win over the implicit field/code; malformed or non-object
  // JSON degrades to the attribute being ignored.
  const raw = item.getAttribute('data-message-params');
  if (raw) {
    try {
      const extra = JSON.parse(raw);
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        Object.assign(params, extra);
      }
    } catch {
      /* malformed JSON — keep the default params */
    }
  }
  if (key && hasMessage(key)) return t(key, params);
  const text = item.textContent.trim();
  if (text) return text;
  return t('fieldErrors.unknown', params);
}

let ownedIdSeq = 0;

// Write one or more messages (one per line) into the field's error slot —
// or into a created slot right after a control that has no `.hc-field`.
function applyErrors(control, messages) {
  const doc = control.ownerDocument;
  const field = fieldOf(control);
  let error;
  if (field) {
    error = getOrCreateError(field, control);
    field.setAttribute('data-invalid', 'true');
  } else {
    error = doc.createElement('p');
    error.className = 'hc-field__error';
    error.setAttribute('aria-live', 'polite');
    // "owned" = created by this behavior next to a bare control; removed
    // entirely on clear (a field's shared slot is only emptied).
    error.setAttribute('data-hc-server-error-owned', '');
    error.id = `hc-server-error-${(ownedIdSeq += 1)}`;
    control.insertAdjacentElement('afterend', error);
    ensureDescribedBy(control, error.id);
  }
  error.textContent = '';
  messages.forEach((message, index) => {
    if (index > 0) error.appendChild(doc.createElement('br'));
    error.appendChild(doc.createTextNode(message));
  });
  error.setAttribute('data-hc-server-error', '');
  control.setAttribute('aria-invalid', 'true');
  control.dataset.hcServerInvalid = '';
}

// Clear every server error inside the scope (errors created by us are
// removed; errors living in a field's shared slot are emptied).
function clearServerErrors(scope) {
  for (const control of scope.querySelectorAll('[data-hc-server-invalid]')) {
    clearServerErrorFor(control);
  }
}

function clearServerErrorFor(control) {
  delete control.dataset.hcServerInvalid;
  control.removeAttribute('aria-invalid');
  const field = fieldOf(control);
  if (field) field.removeAttribute('data-invalid');
  // The error element(s) this control points at via aria-describedby.
  const doc = control.ownerDocument;
  const ids = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  for (const id of ids) {
    const error = doc.getElementById(id);
    if (!error || !error.hasAttribute('data-hc-server-error')) continue;
    if (error.hasAttribute('data-hc-server-error-owned')) {
      pruneDescribedBy(control, id);
      error.remove();
    } else {
      error.textContent = '';
      error.removeAttribute('data-hc-server-error');
    }
  }
}

function distribute(alert, root) {
  if (alert.dataset.distributed != null) return;

  const scope = scopeOf(alert, root);
  if (!scope) {
    // No form to distribute into — everything stays in the summary.
    alert.dataset.distributed = 'none';
    return;
  }

  clearServerErrors(scope);

  const items = alert.querySelectorAll('.hc-alert__error[data-field]');
  // Group by control so several errors for one field render one per line.
  const perControl = new Map();
  let distributed = 0;
  let total = 0;
  for (const item of items) {
    total += 1;
    const control = controlFor(scope, item.getAttribute('data-field'));
    if (!control) continue; // unknown field — stays visible in the summary
    if (!perControl.has(control)) perControl.set(control, []);
    perControl.get(control).push(resolveMessage(item));
    item.setAttribute('data-distributed', 'true');
    distributed += 1;
  }

  for (const [control, messages] of perControl) {
    applyErrors(control, messages);
  }

  alert.dataset.distributed =
    distributed === 0 ? 'none' : distributed === total ? 'all' : 'partial';

  if (alert.getAttribute('data-focus') !== 'none') {
    const first = perControl.keys().next().value;
    try {
      first?.focus?.();
    } catch {
      /* unfocusable control — the wiring still stands */
    }
  }
}

function scan(node, root) {
  if (!node || typeof node.querySelectorAll !== 'function') return;
  if (typeof node.matches === 'function' && node.matches('[data-hc-field-errors]')) {
    distribute(node, root);
  }
  for (const alert of node.querySelectorAll('[data-hc-field-errors]')) {
    distribute(alert, root);
  }
}

/**
 * Install the field-errors behavior: distribute server-sent
 * `[data-hc-field-errors]` fragments (see the `field-errors` recipe) to
 * the form fields they name, with the same ARIA wiring
 * `installValidation()` uses.
 *
 * Fragments are picked up when swapped in by htmx (`htmx:afterSwap` /
 * `htmx:oobAfterSwap`), when inserted by any other means
 * (`MutationObserver`), and once at install time for a full-page render.
 *
 * @param {Document|Element} [root]
 *   The root to watch. Defaults to the global document when available.
 * @returns {() => void} an idempotent uninstaller.
 */
export function installFieldErrors(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onSwap(event) {
    scan(event.target, root);
  }

  function onInput(event) {
    const el = event.target;
    if (el?.dataset?.hcServerInvalid != null) clearServerErrorFor(el);
  }

  function onSubmitOrReset(event) {
    const form = event.target;
    if (form && typeof form.querySelectorAll === 'function') clearServerErrors(form);
  }

  root.addEventListener('htmx:afterSwap', onSwap);
  root.addEventListener('htmx:oobAfterSwap', onSwap);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('submit', onSubmitOrReset, true);
  root.addEventListener('reset', onSubmitOrReset, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) scan(node, root);
      }
    }
  });
  const observeTarget = root.nodeType === 9 ? root.documentElement : root;
  observer.observe(observeTarget, { childList: true, subtree: true });

  // A full-page error render (no swap) is distributed immediately.
  scan(observeTarget, root);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:afterSwap', onSwap);
    root.removeEventListener('htmx:oobAfterSwap', onSwap);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onInput);
    root.removeEventListener('submit', onSubmitOrReset, true);
    root.removeEventListener('reset', onSubmitOrReset, true);
    observer.disconnect();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
