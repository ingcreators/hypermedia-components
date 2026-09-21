// installCount — a character count next to a bounded field.
//
//   <div class="hc-field">
//     <label class="hc-field__label" for="memo">Memo</label>
//     <textarea class="hc-input" id="memo" name="memo" maxlength="500"
//               data-hc-count aria-describedby="memo-count"></textarea>
//     <output class="hc-field__hint" id="memo-count" for="memo">0 / 500</output>
//   </div>
//
// Contract:
//   - `data-hc-count` on the control. Its OUTPUT is the element whose id
//     the attribute names, or — bare — the `<output for="<control id>">`
//     in the document. The server renders the initial text (so the count
//     is right before any script runs, and without one); the behavior
//     rewrites it on every `input`.
//   - The LIMIT is `maxlength` (hard: the browser refuses further input)
//     or `data-hc-count-max` (soft: typing past it is allowed and the
//     output is marked over). Length is `value.length` — UTF-16 code
//     units, exactly what `maxlength` counts — so the two never disagree.
//   - Text comes from the i18n catalog: `count.of` ("{used} / {max}"),
//     or `count.used` ("{used}") when there is no limit.
//   - State on the output: `data-count-state="near"` within the last 10%
//     of the limit, `"over"` past a soft limit; removed otherwise. The
//     field stylesheet colours those.
//   - Announcing: an `<output>` (implicit role=status) or any element
//     with `aria-live` is updated only after a 500 ms typing pause, so a
//     screen reader hears the count once per pause instead of once per
//     keystroke. A plain `<p>` updates immediately.
//
// Idempotent per root, observer-attached, returns an uninstaller.

import { t } from './i18n.js';
import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcCountUninstall';
const SELECTOR = '[data-hc-count]';
const LIVE_DELAY = 500;

function outputFor(control) {
  const doc = control.ownerDocument || document;
  const id = control.getAttribute('data-hc-count');
  if (id) return doc.getElementById(id);
  if (!control.id) return null;
  for (const out of doc.querySelectorAll('output[for]')) {
    if ((out.getAttribute('for') || '').split(/\s+/).includes(control.id)) return out;
  }
  return null;
}

function limitOf(control) {
  const soft = Number(control.getAttribute('data-hc-count-max'));
  if (Number.isFinite(soft) && soft > 0) return { max: soft, soft: true };
  const hard = Number(control.getAttribute('maxlength'));
  if (Number.isFinite(hard) && hard > 0) return { max: hard, soft: false };
  return null;
}

function render(control, output) {
  const used = (control.value ?? '').length;
  const limit = limitOf(control);
  if (!limit) {
    output.textContent = t('count.used', { used });
    output.removeAttribute('data-count-state');
    return;
  }
  const { max, soft } = limit;
  output.textContent = t('count.of', { used, max, remaining: Math.max(0, max - used) });
  if (soft && used > max) output.setAttribute('data-count-state', 'over');
  else if (max - used <= Math.max(1, Math.ceil(max * 0.1))) output.setAttribute('data-count-state', 'near');
  else output.removeAttribute('data-count-state');
}

function isLive(output) {
  return output.tagName === 'OUTPUT' || output.hasAttribute('aria-live');
}

function attach(control, detachers) {
  if (detachers.has(control)) return;
  const output = outputFor(control);
  if (!output) return;

  render(control, output);

  let timer = null;
  const onInput = () => {
    if (!isLive(output)) {
      render(control, output);
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => render(control, output), LIVE_DELAY);
  };
  control.addEventListener('input', onInput);
  control.addEventListener('change', onInput);
  detachers.set(control, () => {
    clearTimeout(timer);
    control.removeEventListener('input', onInput);
    control.removeEventListener('change', onInput);
  });
}

/**
 * Install the character-count behavior on every `[data-hc-count]` control:
 * its output shows `{used} / {max}` (from `maxlength` or
 * `data-hc-count-max`), marked `near` in the last 10% and `over` past a
 * soft limit; live outputs update after a typing pause.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} Uninstaller. Idempotent per root.
 */
export function installCount(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll(SELECTOR)) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
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
