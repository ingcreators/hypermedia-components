// mask behavior — declarative fixed-format input masks.
//
//   <input class="hc-input" name="postal" inputmode="numeric"
//          placeholder="123-4567" pattern="\d{3}-\d{4}"
//          data-hc-mask="postal-jp">
//
// Pattern tokens: `#` digit · `a` letter · `A` letter (upcased) ·
// `*` alphanumeric; every other character is a literal the mask inserts
// itself. `postal-jp` is an alias for `###-####`. Typed characters are
// NFKC-normalized first, so fullwidth digits fill digit slots; characters
// that fit no remaining slot are dropped (strict masks). Literals render
// lazily — `123` stays `123`, typing the fourth digit makes `123-4`.
//
// Editing model:
//   - `input` (outside IME composition) and `compositionend` re-render
//     the mask and restore the caret to "after the same count of raw
//     characters".
//   - Backspace/Delete with the caret against a literal run consumes the
//     run **plus one raw character** — the classic stuck-caret trap.
//   - No `maxlength` is set: the render itself caps at the mask length,
//     and a `maxlength` would truncate pastes like `〒123-4567` before
//     the mask could clean them.
//
// The submitted value is the displayed, literal-including canonical form.
// `data-hc-mask-submit="raw"` strips literals on the wire via the same
// `formdata` hook installFormat uses (fires for htmx's
// `new FormData(form)` and the native submit alike). The behavior never
// blocks submission — mirror the mask with `pattern` for no-JS parity.
//
// Root-delegated, idempotent, returns an uninstaller, no network, no i18n.

const INSTALL_KEY = '__hcMaskUninstall';
const SEL = 'input[data-hc-mask]';
const PRESETS = { 'postal-jp': '###-####' };
const CLASSES = {
  '#': /\d/,
  a: /[a-zA-Z]/,
  A: /[a-zA-Z]/,
  '*': /[0-9a-zA-Z]/,
};

function tokensOf(el) {
  const attr = el.getAttribute('data-hc-mask') ?? '';
  const pattern = PRESETS[attr] ?? attr;
  return [...pattern].map((ch) =>
    CLASSES[ch] ? { kind: ch, test: CLASSES[ch] } : { literal: ch },
  );
}

// One regex matching any raw (slot-fillable) character of this mask —
// used to count raw characters left of the caret and to strip literals.
function rawClassOf(tokens) {
  const kinds = new Set(tokens.filter((t) => t.test).map((t) => t.kind));
  if (kinds.has('*') || (kinds.has('#') && (kinds.has('a') || kinds.has('A')))) {
    return /[0-9a-zA-Z]/;
  }
  if (kinds.has('#')) return /\d/;
  if (kinds.size > 0) return /[a-zA-Z]/;
  return null;
}

function countRaw(text, rawClass) {
  let count = 0;
  for (const ch of text.normalize('NFKC')) {
    if (rawClass.test(ch)) count += 1;
  }
  return count;
}

// Re-render `rawInput` through the mask. Returns the masked value and the
// caret position sitting after the `rawBefore`-th accepted character.
function renderMask(rawInput, tokens, rawBefore) {
  const raw = rawInput.normalize('NFKC');
  let out = '';
  let pending = '';
  let accepted = 0;
  let caret = 0;
  let ri = 0;
  for (const token of tokens) {
    if (token.literal != null) {
      pending += token.literal;
      continue;
    }
    while (ri < raw.length && !token.test.test(raw[ri])) ri += 1;
    if (ri >= raw.length) break;
    let ch = raw[ri];
    ri += 1;
    if (token.kind === 'A') ch = ch.toUpperCase();
    out += pending;
    pending = '';
    out += ch;
    accepted += 1;
    if (accepted === rawBefore) caret = out.length;
  }
  if (rawBefore > accepted) caret = out.length;
  return { value: out, caret };
}

// Which positions of a rendered value are mask literals (replays the
// lazy-literal alignment renderMask produced).
function literalMap(value, tokens) {
  const map = new Array(value.length).fill(false);
  let vi = 0;
  let pending = 0;
  for (const token of tokens) {
    if (vi >= value.length) break;
    if (token.literal != null) {
      pending += 1;
      continue;
    }
    for (let k = 0; k < pending && vi < value.length; k += 1) {
      map[vi] = true;
      vi += 1;
    }
    pending = 0;
    if (vi < value.length) vi += 1;
  }
  return map;
}

function applyMask(el) {
  const tokens = tokensOf(el);
  const rawClass = rawClassOf(tokens);
  if (!rawClass) return;
  const rawBefore = countRaw(el.value.slice(0, el.selectionStart ?? el.value.length), rawClass);
  const { value, caret } = renderMask(el.value, tokens, rawBefore);
  if (value !== el.value) el.value = value;
  if (el === el.ownerDocument.activeElement) el.setSelectionRange(caret, caret);
}

/**
 * Install declarative input masks for `input[data-hc-mask]` (`#` digit,
 * `a` letter, `A` upcased letter, `*` alphanumeric, everything else a
 * literal; `postal-jp` = `###-####`). Typed input is NFKC-normalized, the
 * caret survives re-rendering, and Backspace/Delete hop literal runs.
 * The wire value is the displayed canonical form unless
 * `data-hc-mask-submit="raw"` strips literals via the `formdata` event.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installMask } from '@hypermedia-components/core';
 * installMask();
 */
export function installMask(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onInput(event) {
    const el = event.target;
    if (!el.matches?.(SEL) || event.isComposing) return;
    applyMask(el);
  }

  function onCompositionEnd(event) {
    const el = event.target;
    if (!el.matches?.(SEL)) return;
    applyMask(el);
  }

  function onBeforeInput(event) {
    const el = event.target;
    if (!el.matches?.(SEL)) return;
    const backward = event.inputType === 'deleteContentBackward';
    const forward = event.inputType === 'deleteContentForward';
    if (!backward && !forward) return;
    const start = el.selectionStart;
    if (start == null || start !== el.selectionEnd) return;
    const tokens = tokensOf(el);
    const map = literalMap(el.value, tokens);
    if (backward) {
      let p = start;
      while (p > 0 && map[p - 1]) p -= 1;
      if (p === start) return;
      event.preventDefault();
      if (p === 0) return;
      el.setRangeText('', p - 1, start, 'start');
    } else {
      let p = start;
      while (p < el.value.length && map[p]) p += 1;
      if (p === start) return;
      event.preventDefault();
      if (p >= el.value.length) return;
      el.setRangeText('', start, p + 1, 'start');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function onFormData(event) {
    const form = event.target;
    for (const el of form.elements) {
      if (!el.matches?.(SEL) || !el.name || el.disabled) continue;
      if (el.getAttribute('data-hc-mask-submit') !== 'raw') continue;
      const rawClass = rawClassOf(tokensOf(el));
      if (!rawClass) continue;
      let sameName = 0;
      for (const other of form.elements) {
        if (other.name === el.name) sameName += 1;
      }
      if (sameName !== 1) continue;
      const raw = [...el.value].filter((ch) => rawClass.test(ch)).join('');
      event.formData.set(el.name, raw);
    }
  }

  root.addEventListener('input', onInput);
  root.addEventListener('compositionend', onCompositionEnd);
  root.addEventListener('beforeinput', onBeforeInput);
  root.addEventListener('formdata', onFormData);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('input', onInput);
    root.removeEventListener('compositionend', onCompositionEnd);
    root.removeEventListener('beforeinput', onBeforeInput);
    root.removeEventListener('formdata', onFormData);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
