// installRange — the dual-thumb range behavior for `.hc-range`.
//
// The component is two overlapping native <input type="range">s (low,
// high — in DOM order). The behavior:
//   - clamps so low ≤ high, pushing the value back onto the input the
//     user is dragging (the sibling never moves);
//   - keeps the container's `--hc-range-low` / `--hc-range-high`
//     custom properties (0–100 percentages) in sync so the CSS paints
//     the fill segment;
//   - emits a bubbling `hc:rangechange` { low, high } (numeric input
//     values, not percentages) on every accepted change.
//
// It never fetches. Server-rendered fallback: inline custom properties
// on the container — without JS the inputs still work and serialize;
// only the cross-thumb clamp and the live fill are lost.
//
// installRange(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller. MutationObserver
// catches ranges added after install (htmx swaps, etc.).

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcRangeUninstall';

function pctOf(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  if (max === min) return 0;
  const v = Number(input.value);
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

function inputsOf(range) {
  const inputs = range.querySelectorAll('.hc-range__input');
  return inputs.length === 2 ? { low: inputs[0], high: inputs[1] } : null;
}

function sync(range, low, high) {
  range.style.setProperty('--hc-range-low', String(pctOf(low)));
  range.style.setProperty('--hc-range-high', String(pctOf(high)));
}

function attach(range, detachers) {
  if (detachers.has(range)) return;
  const pair = inputsOf(range);
  if (!pair) return;
  const { low, high } = pair;

  sync(range, low, high);

  const onInput = (event) => {
    // Clamp the thumb being dragged; the sibling holds its ground.
    if (event.target === low && Number(low.value) > Number(high.value)) {
      low.value = high.value;
    } else if (event.target === high && Number(high.value) < Number(low.value)) {
      high.value = low.value;
    }
    sync(range, low, high);
    range.dispatchEvent(
      new CustomEvent('hc:rangechange', {
        bubbles: true,
        detail: { low: Number(low.value), high: Number(high.value) },
      }),
    );
  };

  range.addEventListener('input', onInput);
  detachers.set(range, () => {
    range.removeEventListener('input', onInput);
    range.style.removeProperty('--hc-range-low');
    range.style.removeProperty('--hc-range-high');
  });
}

/**
 * Install the dual-thumb range behavior — clamps low ≤ high, keeps the
 * `--hc-range-low` / `--hc-range-high` fill percentages synchronised,
 * and emits `hc:rangechange` on every accepted change.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installRange(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-range')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-range')) attach(node, detachers);
          node.querySelectorAll?.('.hc-range').forEach((el) =>
            attach(el, detachers),
          );
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
