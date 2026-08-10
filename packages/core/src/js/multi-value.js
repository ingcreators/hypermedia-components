// installMultiValue — one control, many values on the wire.
//
//   <textarea class="hc-input" name="f-buyer" data-hc-multi="lines">ZAB001000000
//   ZAB001000001
//   ZAB001000002</textarea>
//
//   → f-buyer=ZAB001000000&f-buyer=ZAB001000001&f-buyer=ZAB001000002
//
// The business case is a list of identifiers pasted out of a
// spreadsheet: two hundred order numbers, a column of customer codes.
// A tag input (hc-multicombobox) is the wrong shape for that — it is
// built for picking from a known set, not for accepting a paste — while
// a textarea is exactly right, and the filter wire already takes
// repeated params.
//
// The split happens on the `formdata` event, the same hook
// installFormat() uses: htmx builds requests with `new FormData(form)`
// and a native submit builds the same entry list, and both fire
// `formdata` — one listener covers both transports, and nothing here
// touches the network or rewrites what the user typed.
//
// `data-hc-multi="lines"` splits on newlines; `data-hc-multi="commas"`
// splits on commas as well, for values that cannot contain one. Blank
// lines and surrounding whitespace go; duplicates go (the server would
// have to dedupe anyway, and a doubled value in an IN() list is noise).
// If nothing is left, the entry is dropped entirely rather than sent
// empty — an empty condition is not a condition.
//
// SERVERS SHOULD ALSO ACCEPT THE RAW VALUE. Without JavaScript the
// textarea submits one entry containing newlines, which is a perfectly
// good request; splitting it server-side keeps the no-JS path honest.
//
// Root-delegated, idempotent, returns an uninstaller.

const KEY = '__hcMultiValueUninstall';
const SEL = 'textarea[data-hc-multi], input[data-hc-multi]';

/** Rewriting a shared name would clobber the other controls' entries. */
function soleOwnerOfName(form, el) {
  let count = 0;
  for (const other of form.elements) {
    if (other.name === el.name) count += 1;
  }
  return count === 1;
}

/** The values a control contributes: trimmed, non-empty, de-duplicated. */
export function splitValues(raw, mode = 'lines') {
  const parts = String(raw ?? '').split(mode === 'commas' ? /[\n,]/ : /\n/);
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const value = part.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Install multi-value serialization for `[data-hc-multi]` controls: each
 * line (or comma-separated item) becomes its own entry with the same
 * name, so one textarea sends `f-buyer=A&f-buyer=B&f-buyer=C`. Values are
 * trimmed and de-duplicated, blanks are dropped, and a control that ends
 * up with nothing contributes no entry at all.
 *
 * The rewrite happens on the `formdata` event, which both htmx and a
 * native submit fire — so it covers both transports without wrapping
 * either. Servers should still accept the raw newline-joined value, for
 * the path where this behavior never ran.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installMultiValue } from '@hypermedia-components/core';
 * installMultiValue();
 */
export function installMultiValue(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[KEY]) return root[KEY];

  function onFormData(event) {
    const form = event.target;
    const modes = new Map();
    for (const el of form.elements) {
      if (!el.matches?.(SEL) || !el.name || el.disabled) continue;
      if (!soleOwnerOfName(form, el)) continue;
      modes.set(el.name, el.getAttribute('data-hc-multi'));
    }
    if (modes.size === 0) return;

    // Rebuild the entry list IN PLACE rather than delete-then-append.
    // Appending would move the expanded fields to the end, so the same
    // conditions would serialize differently depending on whether this
    // behavior ran — and a saved view compares querystrings to decide
    // whether it has been modified.
    const rebuilt = [];
    for (const [name, value] of event.formData.entries()) {
      if (!modes.has(name)) {
        rebuilt.push([name, value]);
        continue;
      }
      // An emptied control contributes nothing: the condition should
      // vanish rather than arrive blank.
      for (const part of splitValues(value, modes.get(name))) {
        rebuilt.push([name, part]);
      }
    }
    for (const name of new Set(rebuilt.map(([n]) => n).concat([...modes.keys()]))) {
      event.formData.delete(name);
    }
    for (const [name, value] of rebuilt) event.formData.append(name, value);
  }

  root.addEventListener('formdata', onFormData);

  const uninstall = () => {
    if (root[KEY] !== uninstall) return;
    root.removeEventListener('formdata', onFormData);
    delete root[KEY];
  };
  root[KEY] = uninstall;
  return uninstall;
}
