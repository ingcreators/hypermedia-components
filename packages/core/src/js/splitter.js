// installSplitter — behavior for resizable panels (WAI-ARIA Window
// Splitter pattern).
//
// Activates every `.hc-splitter` that has two `.hc-splitter__panel`
// children separated by a `.hc-splitter__handle`. The handle becomes a
// focusable `role="separator"` whose `aria-valuenow` / `aria-valuemin`
// / `aria-valuemax` track the primary (first) pane's size as a
// percentage. Layout is flexbox driven by `--hc-splitter-pos` on the
// container.
//
//   <div class="hc-splitter" data-orientation="horizontal" style="block-size:16rem">
//     <div class="hc-splitter__panel">A</div>
//     <div class="hc-splitter__handle" role="separator" tabindex="0"
//          aria-label="Resize panels"></div>
//     <div class="hc-splitter__panel">B</div>
//   </div>
//
// Config: `data-orientation` ("horizontal" default = side-by-side /
// "vertical" = stacked), `data-value` (initial primary-pane %, default
// 50), `data-min` / `data-max` (%, default 10 / 90), `data-step`
// (keyboard step %, default 5), `data-collapsible` (double-click / Enter
// on the handle toggles the primary pane collapsed↔last-open), and
// `data-persist="<key>"` (save / restore the position in localStorage).
//
// Pointer: drag the handle. Keyboard: ←/→ (horizontal) or ↑/↓
// (vertical) by one step, Home = min, End = max, Enter = toggle collapse
// (when `data-collapsible`). Each change dispatches a bubbling
// `hc:splitterchange` (`detail { value, collapsed, orientation }`). A
// collapsed splitter carries `data-collapsed` on the container.
//
// installSplitter(root = document) returns an idempotent uninstaller.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcSplitterUninstall';

// localStorage is optional and may throw (privacy mode, disabled). Guard it.
function readStored(key) {
  try {
    const v = localStorage.getItem(key);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function attach(root, detachers) {
  if (detachers.has(root)) return;
  const panels = root.querySelectorAll(':scope > .hc-splitter__panel');
  const handle = root.querySelector(':scope > .hc-splitter__handle');
  if (panels.length < 2 || !handle) return;

  const primary = panels[0];
  const orientation = root.getAttribute('data-orientation') === 'vertical' ? 'vertical' : 'horizontal';
  const min = root.hasAttribute('data-min') ? Number(root.getAttribute('data-min')) : 10;
  const max = root.hasAttribute('data-max') ? Number(root.getAttribute('data-max')) : 90;
  const step = root.hasAttribute('data-step') ? Number(root.getAttribute('data-step')) : 5;
  const collapsible = root.hasAttribute('data-collapsible');
  const persistKey = root.getAttribute('data-persist');
  const defaultPos = root.hasAttribute('data-value') ? Number(root.getAttribute('data-value')) : 50;
  let pos = defaultPos;
  // Restore a persisted position (incl. a collapsed 0) over data-value.
  if (persistKey) {
    const saved = readStored(persistKey);
    if (saved != null) pos = saved;
  }
  // The size to restore to when expanding from collapsed.
  let lastOpen = pos > 0 ? pos : defaultPos;

  if (!primary.id) primary.id = `hc-splitter-panel-${Math.random().toString(36).slice(2, 9)}`;

  if (!handle.hasAttribute('role')) handle.setAttribute('role', 'separator');
  if (!handle.hasAttribute('tabindex')) handle.setAttribute('tabindex', '0');
  // For side-by-side panes the separator line is vertical, and vice-versa.
  handle.setAttribute('aria-orientation', orientation === 'horizontal' ? 'vertical' : 'horizontal');
  handle.setAttribute('aria-controls', primary.id);
  handle.setAttribute('aria-valuemin', String(min));
  handle.setAttribute('aria-valuemax', String(max));
  if (!handle.hasAttribute('aria-label') && !handle.hasAttribute('aria-labelledby')) {
    handle.setAttribute('aria-label', t('splitter.resize'));
  }

  function clamp(p) {
    return Math.min(max, Math.max(min, p));
  }

  // Apply a raw position (collapse uses 0, below `min`). The visual size
  // tracks the raw value; aria-valuenow stays within [min, max].
  function applyPos(p, { dispatch = true } = {}) {
    pos = p;
    const collapsed = p <= 0;
    root.style.setProperty('--hc-splitter-pos', `${Math.max(0, p)}%`);
    handle.setAttribute('aria-valuenow', String(Math.round(clamp(p))));
    root.toggleAttribute('data-collapsed', collapsed);
    if (persistKey && dispatch) writeStored(persistKey, Math.round(p));
    if (dispatch) {
      root.dispatchEvent(new CustomEvent('hc:splitterchange', {
        bubbles: true,
        detail: { value: p, collapsed, orientation, handle, primary },
      }));
    }
  }

  function setPos(next, opts) {
    applyPos(clamp(next), opts);
  }

  function toggleCollapse() {
    if (pos <= 0) {
      applyPos(clamp(lastOpen > 0 ? lastOpen : defaultPos)); // expand
    } else {
      lastOpen = pos;
      applyPos(0); // collapse the primary pane
    }
  }

  applyPos(pos <= 0 ? 0 : clamp(pos), { dispatch: false });

  const doc = root.ownerDocument;
  let dragging = false;

  function onPointerDown(event) {
    dragging = true;
    event.preventDefault();
  }

  // Move / up are bound at the document level (not the handle) so a
  // fast drag that outruns the cursor still tracks — relying on
  // setPointerCapture alone proved flaky across engines.
  function onPointerMove(event) {
    if (!dragging) return;
    const rect = root.getBoundingClientRect();
    let next = pos;
    if (orientation === 'horizontal') {
      if (rect.width) next = ((event.clientX - rect.left) / rect.width) * 100;
    } else if (rect.height) {
      next = ((event.clientY - rect.top) / rect.height) * 100;
    }
    setPos(next);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onDblclick() {
    if (collapsible) toggleCollapse();
  }

  function onKeydown(event) {
    if (collapsible && event.key === 'Enter') {
      event.preventDefault();
      toggleCollapse();
      return;
    }
    // For a side-by-side (horizontal) splitter in RTL, the primary pane sits
    // on the inline-start (right) edge, so mirror the horizontal arrows.
    const rtl =
      orientation === 'horizontal' && getComputedStyle(root).direction === 'rtl';
    const forward =
      orientation === 'horizontal' ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
    const back =
      orientation === 'horizontal' ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
    switch (event.key) {
      case forward: event.preventDefault(); setPos(pos + step); break;
      case back: event.preventDefault(); setPos(pos - step); break;
      case 'Home': event.preventDefault(); setPos(min); break;
      case 'End': event.preventDefault(); setPos(max); break;
      default: break;
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('keydown', onKeydown);
  if (collapsible) handle.addEventListener('dblclick', onDblclick);
  doc.addEventListener('pointermove', onPointerMove);
  doc.addEventListener('pointerup', onPointerUp);

  detachers.set(root, () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('keydown', onKeydown);
    handle.removeEventListener('dblclick', onDblclick);
    doc.removeEventListener('pointermove', onPointerMove);
    doc.removeEventListener('pointerup', onPointerUp);
  });
}

/**
 * Install the splitter behavior on every `.hc-splitter` in the
 * document. The returned uninstaller is idempotent and a no-op when the
 * behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installSplitter(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const element of root.querySelectorAll('.hc-splitter')) attach(element, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-splitter')) attach(node, detachers);
          node.querySelectorAll?.('.hc-splitter').forEach((element) => attach(element, detachers));
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
