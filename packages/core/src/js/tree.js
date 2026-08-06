// installTree — behavior for hc-tree (the WAI-ARIA tree pattern).
//
// Upgrades a semantic nested list into a tree view:
//
//   1. Applies the roles (tree / treeitem / group) and a roving
//      tabindex — one tab stop per tree, like the datagrid.
//   2. The APG keyboard model over VISIBLE items: ↑/↓ move (collapsed
//      subtrees are skipped), → opens a closed branch then descends,
//      ← closes an open branch else ascends, Home/End jump,
//      Enter/Space activate (follow the label's link when there is
//      one, otherwise toggle the branch), and single-character
//      type-ahead. ←/→ mirror in RTL.
//   3. Expansion: toggles `aria-expanded` (branch-ness is DECLARED by
//      the attribute's presence — the server owns it) and dispatches a
//      bubbling `hc:treeexpand` (`detail: { item }`) on every
//      expansion. When the expanding item carries `data-hx-get` and an
//      empty group, the group gets `aria-busy="true"` until children
//      arrive — the lazy-tree recipe pairs the event with htmx's
//      `hc:treeexpand once` trigger.
//
// Selection is a server state (`aria-current` / `aria-selected` are
// styled, not managed). The behavior never touches the network.
//
// installTree(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller (idempotent).

const INSTALL_KEY = '__hcTreeUninstall';

function ownedBy(tree, selector) {
  return [...tree.querySelectorAll(selector)].filter(
    (el) => el.closest('.hc-tree') === tree,
  );
}

function itemsOf(tree) {
  return ownedBy(tree, '.hc-tree__item');
}

function parentItemOf(item, tree) {
  const candidate = item.parentElement && item.parentElement.closest('.hc-tree__item');
  return candidate && candidate.closest('.hc-tree') === tree ? candidate : null;
}

function isBranch(item) {
  return item.hasAttribute('aria-expanded');
}

function isExpanded(item) {
  return item.getAttribute('aria-expanded') === 'true';
}

// The keyboard model operates on VISIBLE items only: an item counts
// when every ancestor branch on its path is expanded.
function visibleItems(tree) {
  return itemsOf(tree).filter((item) => {
    for (let p = parentItemOf(item, tree); p; p = parentItemOf(p, tree)) {
      if (!isExpanded(p)) return false;
    }
    return true;
  });
}

function labelText(item) {
  const label = item.querySelector(':scope > .hc-tree__row .hc-tree__label');
  return (label ? label.textContent : '').trim().toLowerCase();
}

function labelLink(item) {
  return item.querySelector(':scope > .hc-tree__row .hc-tree__label a[href]');
}

function attach(tree, detachers) {
  if (detachers.has(tree)) return;

  function applyRoles() {
    if (!tree.getAttribute('role')) tree.setAttribute('role', 'tree');
    for (const group of ownedBy(tree, '.hc-tree__group')) {
      group.setAttribute('role', 'group');
    }
    const items = itemsOf(tree);
    for (const item of items) {
      item.setAttribute('role', 'treeitem');
      if (!item.hasAttribute('tabindex')) item.tabIndex = -1;
    }
    // Roving tab stop: keep the current one if it is still visible.
    const visible = visibleItems(tree);
    if (!visible.length) return;
    const current = visible.find((i) => i.tabIndex === 0);
    setRoving(current || visible[0]);
  }

  function setRoving(item) {
    for (const other of itemsOf(tree)) other.tabIndex = -1;
    item.tabIndex = 0;
  }

  function focusItem(item) {
    if (!item) return;
    setRoving(item);
    item.focus();
  }

  function setExpanded(item, on) {
    if (!isBranch(item)) return;
    if (isExpanded(item) === on) return;
    item.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) return;

    // Lazy branch: empty group + an htmx GET on the item → busy until
    // the children arrive (the datagrid lazy-detail shape).
    const group = item.querySelector(':scope > .hc-tree__group');
    if (
      group
      && !group.children.length
      && (item.hasAttribute('data-hx-get') || item.hasAttribute('hx-get'))
      && typeof MutationObserver !== 'undefined'
    ) {
      group.setAttribute('aria-busy', 'true');
      const obs = new MutationObserver(() => {
        group.removeAttribute('aria-busy');
        obs.disconnect();
        applyRoles(); // the swapped-in children need roles + tabindex
      });
      obs.observe(group, { childList: true });
    }

    item.dispatchEvent(
      new CustomEvent('hc:treeexpand', { bubbles: true, detail: { item } }),
    );
  }

  function activate(item) {
    const link = labelLink(item);
    if (link) {
      link.click(); // navigation stays hypermedia
      return;
    }
    if (isBranch(item)) setExpanded(item, !isExpanded(item));
  }

  function isRtl() {
    return typeof getComputedStyle === 'function'
      && getComputedStyle(tree).direction === 'rtl';
  }

  function onKeydown(event) {
    const item = event.target.closest && event.target.closest('.hc-tree__item');
    if (!item || item.closest('.hc-tree') !== tree) return;
    // Don't steal keys from widgets inside rows (inputs, etc.).
    if (event.target.closest('input, button, select, textarea')) return;

    const visible = visibleItems(tree);
    const index = visible.indexOf(item);
    if (index === -1) return;

    let key = event.key;
    if (isRtl()) {
      if (key === 'ArrowLeft') key = 'ArrowRight';
      else if (key === 'ArrowRight') key = 'ArrowLeft';
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      focusItem(visible[index + 1]);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      focusItem(visible[index - 1]);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      if (isBranch(item) && !isExpanded(item)) setExpanded(item, true);
      else if (isBranch(item)) focusItem(visibleItems(tree)[index + 1]);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      if (isBranch(item) && isExpanded(item)) setExpanded(item, false);
      else focusItem(parentItemOf(item, tree) || undefined);
    } else if (key === 'Home') {
      event.preventDefault();
      focusItem(visible[0]);
    } else if (key === 'End') {
      event.preventDefault();
      focusItem(visible[visible.length - 1]);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      activate(item);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && key !== ' ') {
      // Type-ahead: the next visible item (cyclic) starting with the char.
      const ch = key.toLowerCase();
      for (let step = 1; step <= visible.length; step += 1) {
        const candidate = visible[(index + step) % visible.length];
        if (labelText(candidate).startsWith(ch)) {
          focusItem(candidate);
          break;
        }
      }
    }
  }

  function onClick(event) {
    const item = event.target.closest && event.target.closest('.hc-tree__item');
    if (!item || item.closest('.hc-tree') !== tree) return;

    if (event.target.closest('.hc-tree__toggle')) {
      setExpanded(item, !isExpanded(item));
      focusItem(item);
      return;
    }
    const row = event.target.closest('.hc-tree__row');
    if (row && row.parentElement === item) {
      // A row click focuses the item and, on a branch, toggles it — unless
      // the click originated inside an interactive control (link, button,
      // form widget): those own their activation, and toggling too would
      // collapse the branch the user is acting on. Same control set the
      // keydown handler exempts.
      if (!event.target.closest('a[href], input, button, select, textarea') && isBranch(item)) {
        setExpanded(item, !isExpanded(item));
      }
      setRoving(item);
      if (typeof item.focus === 'function') item.focus();
    }
  }

  function onFocusin(event) {
    const item = event.target.closest && event.target.closest('.hc-tree__item');
    if (item && item.closest('.hc-tree') === tree && event.target === item) {
      setRoving(item);
    }
  }

  applyRoles();

  tree.addEventListener('keydown', onKeydown);
  tree.addEventListener('click', onClick);
  tree.addEventListener('focusin', onFocusin);

  // Re-apply roles when subtrees are swapped in (htmx lazy loads).
  let mo = null;
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(() => applyRoles());
    mo.observe(tree, { childList: true, subtree: true });
  }

  detachers.set(tree, () => {
    tree.removeEventListener('keydown', onKeydown);
    tree.removeEventListener('click', onClick);
    tree.removeEventListener('focusin', onFocusin);
    if (mo) mo.disconnect();
  });
}

/**
 * Install the tree behavior on every `.hc-tree` in the root: ARIA
 * roles, a roving tabindex, the APG keyboard model over visible items
 * (with type-ahead and RTL mirroring), click/keyboard expansion, and
 * the `hc:treeexpand` event lazy subtrees build on (see the lazy-tree
 * recipe). Trees swapped in later are picked up automatically.
 *
 * @param {Document|Element} [root]
 *   The root to scan. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installTree } from '@hypermedia-components/core';
 * installTree();
 */
export function installTree(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll('.hc-tree')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('.hc-tree')) attach(node, detachers);
          if (node.querySelectorAll) {
            node.querySelectorAll('.hc-tree').forEach((el) => attach(el, detachers));
          }
        }
      }
    });
    observer.observe(root.body || root, { childList: true, subtree: true });
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
