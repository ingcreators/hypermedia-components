// installSlider — keep `--hc-slider-value` synchronised with the
// native input's value so the WebKit gradient fill paints the
// 0→value portion of the track.
//
// Firefox renders the same fill natively via `::-moz-range-progress`
// and ignores `--hc-slider-value` entirely; the behavior is still
// safe to install there — it just sets a property nothing reads.
//
// installSlider(root = document) returns an uninstaller. Repeated
// calls on the same root return the same uninstaller. MutationObserver
// catches sliders added after install (htmx swaps, etc.).

const INSTALL_KEY = '__hcSliderUninstall';

function pctOf(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  if (max === min) return 0;
  const v = Number(slider.value);
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

function syncValue(slider) {
  slider.style.setProperty('--hc-slider-value', String(pctOf(slider)));
}

function attach(slider, detachers) {
  if (detachers.has(slider)) return;
  syncValue(slider);
  const onInput = () => syncValue(slider);
  slider.addEventListener('input', onInput);
  detachers.set(slider, () => {
    slider.removeEventListener('input', onInput);
    slider.style.removeProperty('--hc-slider-value');
  });
}

/**
 * Install the slider behavior — keeps the `--hc-slider-value` CSS
 * custom property synchronised with each `.hc-slider`'s current
 * value so the WebKit track gradient paints the filled portion.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installSlider(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-slider')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-slider')) attach(node, detachers);
          node.querySelectorAll?.('.hc-slider').forEach((el) =>
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
