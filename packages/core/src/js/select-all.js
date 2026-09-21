// installSelectAll — a master checkbox for a group of checkboxes.
//
//   <fieldset class="hc-field" id="perms">
//     <legend>Permissions</legend>
//     <label class="hc-checkbox-label">
//       <input class="hc-checkbox" type="checkbox" data-hc-select-all="perms"> All
//     </label>
//     <label class="hc-checkbox-label">
//       <input class="hc-checkbox" type="checkbox" name="perm" value="read"> Read
//     </label>
//     …
//   </fieldset>
//
// Contract:
//   - `data-hc-select-all="<group id>"` on the master checkbox. The GROUP
//     is the element with that id (the master may live inside it or
//     anywhere else); the MEMBERS are every enabled `input[type=checkbox]`
//     inside the group other than the master.
//   - The master carries NO `name`: it must never serialize. What the
//     server sees is the members, by native form serialization.
//   - Master → members: checking / unchecking it sets every enabled
//     member. Members → master: the master is `checked` when all are,
//     unchecked when none are, and `indeterminate` in between — kept in
//     sync on every change, at install, and after an htmx swap inside
//     the group (new members count from then on).
//   - Setting a member programmatically fires no `change` on it (native
//     semantics); the master's own `change` bubbles through the group
//     once, so a container-level `data-hc-submit-on-change` sees one
//     event, not one per member.
//
// Rows in an `hc-datagrid` need none of this — the grid's own header
// checkbox does it. This is for a checklist: a permission matrix, the
// columns to export, a batch of notifications.
//
// Idempotent per root, observer-attached, returns an uninstaller.

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcSelectAllUninstall';
const SELECTOR = 'input[type="checkbox"][data-hc-select-all]';

function groupOf(master) {
  const doc = master.ownerDocument || document;
  const id = master.getAttribute('data-hc-select-all');
  return id ? doc.getElementById(id) : null;
}

function membersOf(master, group) {
  return [...group.querySelectorAll('input[type="checkbox"]')].filter(
    (cb) => cb !== master && !cb.disabled && !cb.hasAttribute('data-hc-select-all'),
  );
}

function sync(master, group) {
  const members = membersOf(master, group);
  const checked = members.filter((cb) => cb.checked).length;
  master.checked = members.length > 0 && checked === members.length;
  master.indeterminate = checked > 0 && checked < members.length;
}

function attach(master, detachers) {
  if (detachers.has(master)) return;
  const group = groupOf(master);
  if (!group) return;
  if (master.hasAttribute('name')) master.removeAttribute('name'); // never serializes

  sync(master, group);

  const onMaster = () => {
    const on = master.checked;
    master.indeterminate = false;
    for (const cb of membersOf(master, group)) cb.checked = on;
  };
  const onGroup = (event) => {
    const target = event.target;
    if (target === master) return;
    if (!target || target.type !== 'checkbox' || !group.contains(target)) return;
    sync(master, group);
  };
  const onSwap = () => sync(master, group);

  master.addEventListener('change', onMaster);
  group.addEventListener('change', onGroup);
  group.addEventListener('htmx:afterSwap', onSwap);
  detachers.set(master, () => {
    master.removeEventListener('change', onMaster);
    group.removeEventListener('change', onGroup);
    group.removeEventListener('htmx:afterSwap', onSwap);
  });
}

/**
 * Install the select-all behavior on every `[data-hc-select-all]` master
 * checkbox: it sets every enabled checkbox in the group it names, and
 * reflects their state back as checked / unchecked / indeterminate.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} Uninstaller. Idempotent per root.
 */
export function installSelectAll(root = typeof document !== 'undefined' ? document : null) {
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
