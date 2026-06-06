// installInputOtp — behavior for a segmented one-time-code input.
//
// Uses the accessible single-input approach: every `.hc-inputotp`
// contains ONE real `<input>` that captures all typing, paste,
// autofill (`autocomplete="one-time-code"`), and selection. The
// behavior overlays it transparently and renders N decorative slots
// that mirror the value, so screen readers interact with one labelled
// input while sighted users see the familiar boxes.
//
//   <div class="hc-inputotp" data-length="6">
//     <input class="hc-inputotp__input" name="otp" inputmode="numeric"
//            autocomplete="one-time-code" aria-label="One-time code">
//   </div>
//
// Config: `data-length` (number of slots, default 6) and `data-pattern`
// (a CSS-style character class of allowed characters, default `[0-9]`;
// characters that don't match are stripped on input). The behavior sets
// `maxlength` and sensible `inputmode` / `autocomplete` defaults.
//
// Events (bubbling, on the container): `hc:otpchange`
// (`detail { value, input }`) on every edit, and `hc:otpcomplete`
// (same detail) when the value fills every slot.
//
// The active slot (where the caret is) carries `data-active` and renders a
// blinking caret (CSS, `prefers-reduced-motion`-aware). Clicking a slot moves
// the caret into it — clamped to the typed length so you can't open a gap —
// and the active slot follows.
//
// installInputOtp(root = document) returns an idempotent uninstaller.

const INSTALL_KEY = '__hcInputOtpUninstall';

function charClassRe(spec) {
  const body = spec.startsWith('[') && spec.endsWith(']') ? spec.slice(1, -1) : spec;
  try {
    return new RegExp(`[${body}]`, 'u');
  } catch {
    return /[0-9]/u;
  }
}

// `data-groups="3-3"` (also `"3 3"` / `"2,2,2"`) → the set of slot indices
// after which a separator is rendered. Ignored unless the group sizes are
// positive integers that sum to the slot count.
function groupBoundaries(spec, length) {
  if (!spec) return new Set();
  const parts = spec.split(/[\s,-]+/).filter(Boolean).map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isInteger(n) || n <= 0)) return new Set();
  if (parts.reduce((a, b) => a + b, 0) !== length) return new Set();
  const set = new Set();
  let acc = 0;
  for (let g = 0; g < parts.length - 1; g += 1) {
    acc += parts[g];
    set.add(acc);
  }
  return set;
}

function attach(root, detachers) {
  if (detachers.has(root)) return;
  const input = root.querySelector('.hc-inputotp__input') || root.querySelector('input');
  if (!input) return;

  const doc = root.ownerDocument;
  const length = Math.max(1, Number(root.getAttribute('data-length')) || 6);
  const allowed = charClassRe(root.getAttribute('data-pattern') || '[0-9]');

  input.setAttribute('maxlength', String(length));
  if (!input.hasAttribute('inputmode')) input.setAttribute('inputmode', 'numeric');
  if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'one-time-code');
  if (!input.hasAttribute('type')) input.setAttribute('type', 'text');

  const slots = [];
  function renderSlots() {
    for (const old of root.querySelectorAll('.hc-inputotp__slot, .hc-inputotp__separator')) {
      old.remove();
    }
    slots.length = 0;
    const boundaries = groupBoundaries(root.getAttribute('data-groups'), length);
    for (let i = 0; i < length; i++) {
      const slot = doc.createElement('div');
      slot.className = 'hc-inputotp__slot';
      slot.setAttribute('aria-hidden', 'true');
      root.appendChild(slot);
      slots.push(slot);
      if (boundaries.has(i + 1)) {
        const sep = doc.createElement('span');
        sep.className = 'hc-inputotp__separator';
        sep.setAttribute('aria-hidden', 'true');
        root.appendChild(sep);
      }
    }
  }

  function filterValue(v) {
    return Array.from(v).filter((ch) => allowed.test(ch)).join('').slice(0, length);
  }

  function sync() {
    const v = input.value;
    const focused = doc.activeElement === input;
    const caret = input.selectionStart ?? v.length;
    const activeIndex = Math.min(caret, length - 1);
    for (let i = 0; i < length; i++) {
      const slot = slots[i];
      slot.textContent = v[i] ?? '';
      slot.toggleAttribute('data-empty', !v[i]);
      slot.toggleAttribute('data-active', focused && i === activeIndex);
    }
  }

  function onInput() {
    const filtered = filterValue(input.value);
    if (filtered !== input.value) {
      input.value = filtered;
      try {
        input.setSelectionRange(filtered.length, filtered.length);
      } catch { /* some input types disallow setSelectionRange */ }
    }
    sync();
    root.dispatchEvent(new CustomEvent('hc:otpchange', {
      bubbles: true,
      detail: { value: input.value, input },
    }));
    if (input.value.length === length) {
      root.dispatchEvent(new CustomEvent('hc:otpcomplete', {
        bubbles: true,
        detail: { value: input.value, input },
      }));
    }
  }

  function onSelectionMove() {
    sync();
  }

  // The slot under the pointer, by x position (the input overlays the slots,
  // so it — not the slot — is the event target). Returns -1 off any slot.
  function slotIndexAt(clientX) {
    for (let i = 0; i < slots.length; i += 1) {
      const r = slots[i].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return i;
    }
    return -1;
  }

  // Clicking a slot places the caret in it (clamped to the typed length, so
  // you can't open a gap), overriding the input's imprecise native hit-test.
  // The active slot + blinking caret follow via sync().
  function onClick(event) {
    const idx = slotIndexAt(event.clientX);
    if (idx !== -1) {
      const pos = Math.min(idx, input.value.length);
      input.focus();
      try {
        input.setSelectionRange(pos, pos);
      } catch { /* some input types disallow setSelectionRange */ }
    }
    sync();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onSelectionMove);
  input.addEventListener('blur', onSelectionMove);
  input.addEventListener('keyup', onSelectionMove);
  root.addEventListener('click', onClick);

  renderSlots();
  if (input.value) input.value = filterValue(input.value);
  sync();

  detachers.set(root, () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('focus', onSelectionMove);
    input.removeEventListener('blur', onSelectionMove);
    input.removeEventListener('keyup', onSelectionMove);
    root.removeEventListener('click', onClick);
    for (const el of root.querySelectorAll('.hc-inputotp__slot, .hc-inputotp__separator')) {
      el.remove();
    }
  });
}

/**
 * Install the one-time-code input behavior on every `.hc-inputotp` in
 * the document. The returned uninstaller is idempotent and a no-op when
 * the behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installInputOtp(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const element of root.querySelectorAll('.hc-inputotp')) attach(element, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-inputotp')) attach(node, detachers);
          node.querySelectorAll?.('.hc-inputotp').forEach((element) => attach(element, detachers));
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
