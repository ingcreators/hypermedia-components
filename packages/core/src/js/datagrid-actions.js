// datagrid-actions behavior — the selection actions bar for hc-datagrid.
//
// A bar (typically an hc-toolbar) declares which grid it serves via a
// selector, and holds the bulk-action buttons plus a live count:
//
//   <div class="hc-toolbar" role="toolbar" aria-label="Bulk actions"
//        data-hc-datagrid-actions="#grid" hidden>
//     <span data-hc-datagrid-count></span>
//     <button class="hc-button" type="submit" name="action" value="archive"
//             data-hx-post="/products/bulk" …>Archive</button>
//   </div>
//
// The behavior mirrors the grid's selection state into the bar:
//
//   - `[data-hc-datagrid-count]` gets the i18n `datagrid.selected`
//     message (params: {selected}, {total}) and a default `role="status"`
//     so count changes are announced politely.
//   - The bar is `hidden` while nothing is selected — the actions appear
//     with the first selected row and disappear with the last.
//
// State comes from the grid itself: the initial pass reads the public
// selection attributes (`data-selected` records / `aria-selected` rows),
// then `hc:datagridselectionchange` keeps the bar fresh — including the
// grid's re-emit after an htmx row swap, which is what clears the bar
// after a bulk action re-renders the page.
//
// The selected ids themselves travel by native form serialization (row
// checkboxes with `name`/`value` inside the wrapping <form> — see the
// datagrid-bulk-actions recipe); this behavior never touches the network
// and never assembles a payload.
//
// installDatagridActions(root = document) returns an uninstaller.
// Repeated calls on the same root return the same uninstaller (idempotent).

import { t } from './i18n.js';

const INSTALL_KEY = '__hcDatagridActionsUninstall';
const BAR = '[data-hc-datagrid-actions]';

function scopeOf(root) {
  return root.querySelectorAll ? root : document;
}

// The grid a bar points at — `data-hc-datagrid-actions` holds a selector
// resolved against the install root (an invalid selector is a no-op).
function gridOf(bar, root) {
  const sel = bar.getAttribute('data-hc-datagrid-actions');
  if (!sel) return null;
  try {
    return scopeOf(root).querySelector(sel);
  } catch {
    return null;
  }
}

// Mirror of the grid's own selection accounting (datagrid.js): records
// are the selectable units when present, otherwise body rows; elements
// inside a nested grid don't count.
function countSelection(grid) {
  const owned = (selector) =>
    [...grid.querySelectorAll(selector)].filter(
      (el) => el.closest('.hc-datagrid') === grid,
    );
  const records = owned('.hc-datagrid__record');
  const units = records.length
    ? records
    : owned('.hc-datagrid__body > .hc-datagrid__row');
  const selected = units.filter(
    (u) =>
      u.hasAttribute('data-selected') ||
      u.getAttribute('aria-selected') === 'true',
  ).length;
  return { selected, total: units.length };
}

function update(bar, { selected, total }) {
  const count = bar.querySelector('[data-hc-datagrid-count]');
  if (count) {
    if (!count.hasAttribute('role')) count.setAttribute('role', 'status');
    count.textContent = t('datagrid.selected', { selected, total });
  }
  bar.toggleAttribute('hidden', selected === 0);
}

function initBar(bar, root) {
  const grid = gridOf(bar, root);
  if (grid) update(bar, countSelection(grid));
}

/**
 * Install the datagrid selection-actions-bar behavior: every element
 * with `data-hc-datagrid-actions="<grid selector>"` mirrors that grid's
 * selection — a `[data-hc-datagrid-count]` child shows the translated
 * count (`datagrid.selected`), and the bar is hidden while the selection
 * is empty. Driven by the grid's `hc:datagridselectionchange` events;
 * bars added later (e.g. by an htmx swap) are picked up automatically.
 *
 * @param {Document|Element} [root]
 *   The root to install on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installDatagridActions } from '@hypermedia-components/core';
 * installDatagridActions();
 */
export function installDatagridActions(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onSelectionChange(event) {
    for (const bar of scopeOf(root).querySelectorAll(BAR)) {
      if (gridOf(bar, root) === event.target) update(bar, event.detail);
    }
  }

  root.addEventListener('hc:datagridselectionchange', onSelectionChange);
  for (const bar of scopeOf(root).querySelectorAll(BAR)) initBar(bar, root);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(BAR)) initBar(node, root);
          node.querySelectorAll?.(BAR).forEach((bar) => initBar(bar, root));
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('hc:datagridselectionchange', onSelectionChange);
    if (observer) observer.disconnect();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
