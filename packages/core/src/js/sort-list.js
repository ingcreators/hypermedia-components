// installSortList — an ordered list of sort keys, one param on the wire.
//
//   <ul class="hc-stack" data-hc-sortable data-hc-sort-list="sort">
//     <li class="hc-item" data-hc-sortable-id="ship" data-hc-sort-key="ship">
//       <button type="button" data-hc-sortable-handle>⠿</button>
//       Ship date
//       <select name="dir-ship" aria-label="Ship date direction">
//         <option value="asc">Ascending</option>
//         <option value="desc" selected>Descending</option>
//       </select>
//     </li>
//     <li class="hc-item" data-hc-sortable-id="order" data-hc-sort-key="order">…</li>
//   </ul>
//
//   → sort=-ship,order
//
// Column headers are the fast path for sorting and stay. What they
// cannot do is answer *what is the current sort set*: shift-click for
// multi-sort is undiscoverable, the sorted column is often scrolled out
// of view in a wide grid, a key on a hidden column has no header at
// all, and re-ordering keys means re-clicking headers in the right
// sequence. So the sort set gets a control that is both the read-out
// and the editor — and this is how that control speaks.
//
// The list is reordered by installSortable() (pointer + keyboard), and
// the ORDER OF THE ITEMS IS THE ORDER OF THE KEYS. Nothing here
// duplicates that state: the DOM is the model.
//
// The join happens on the `formdata` event — the hook installFormat(),
// installMultiValue() and installRangeValue() already share, because
// htmx builds requests with `new FormData(form)` and a native submit
// builds the same entry list. Nothing here touches the network.
//
// THE NO-JS PATH IS THE PER-KEY DIRECTION CONTROLS. Form entries arrive
// in DOM order, so `dir-ship=desc&dir-order=asc` carries both the keys
// and their order; a server that reads them in arrival order
// reconstructs `-ship,order` exactly. That is why each row's direction
// control is named after its key rather than sharing one name.
//
// Root-delegated, idempotent, returns an uninstaller.

const KEY = '__hcSortListUninstall';
const LIST = '[data-hc-sort-list]';
const ITEM = '[data-hc-sort-key]';

/** `{key, direction}` for each row, in DOM order. */
function keysOf(list) {
  const rows = [];
  for (const item of list.querySelectorAll(ITEM)) {
    const key = item.getAttribute('data-hc-sort-key');
    if (!key) continue;
    rows.push({ key, item });
  }
  return rows;
}

/**
 * The wire value for one list: keys in DOM order, a leading `-` for
 * descending — the `?sort=name,-price` convention the datagrid's own
 * header sorting already mirrors into `input[data-hc-datagrid-sort]`.
 *
 * @param {Element} list the `[data-hc-sort-list]` container.
 * @param {(name: string) => string|null} read
 *   how to read a direction control's submitted value.
 * @returns {string} e.g. `-ship,order`, or `''` for an empty list.
 */
export function sortWire(list, read) {
  const prefix = list.getAttribute('data-hc-sort-dir-prefix') || 'dir-';
  return keysOf(list)
    .map(({ key }) => {
      const direction = read(`${prefix}${key}`);
      return direction === 'desc' ? `-${key}` : key;
    })
    .join(',');
}

/**
 * Install sort-list serialization for `[data-hc-sort-list]` containers:
 * the ordered rows and their per-key direction controls become a single
 * `sort=-ship,order` entry, in the position the first of them held.
 *
 * An empty list contributes no entry at all — no sort is not a sort.
 * Servers should still accept the per-key `dir-<key>` params in arrival
 * order, for the path where this behavior never ran.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installSortList } from '@hypermedia-components/core';
 * installSortList();
 */
export function installSortList(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[KEY]) return root[KEY];

  function onFormData(event) {
    const form = event.target;
    const lists = [...form.querySelectorAll(LIST)];
    if (lists.length === 0) return;

    // Read directions out of the entry list, so whatever the control
    // actually submitted is what lands in the joined value.
    const entries = [...event.formData.entries()];
    const read = (name) => {
      const hit = entries.find(([n]) => n === name);
      return hit ? String(hit[1]) : null;
    };

    // name → the param that replaces it (the first direction control of
    // each list), plus the names that simply disappear.
    const joined = new Map();
    const dropped = new Set();
    const emitted = new Set();
    const pending = [];
    for (const list of lists) {
      const param = list.getAttribute('data-hc-sort-list') || 'sort';
      const prefix = list.getAttribute('data-hc-sort-dir-prefix') || 'dir-';
      const names = keysOf(list).map(({ key }) => `${prefix}${key}`);
      const wire = sortWire(list, read);
      // A list with no rows still has to clear a stale `sort` param, so
      // the param name is dropped either way; only a non-empty list
      // contributes a value.
      dropped.add(param);
      pending.push([param, wire]);
      if (names.length > 0) {
        joined.set(names[0], [param, wire]);
        for (const name of names.slice(1)) dropped.add(name);
      }
    }

    // Rebuild in place rather than delete-then-append: appending would
    // move the sort to the end, so the same conditions would serialize
    // differently depending on whether this behavior ran — and a saved
    // view compares querystrings to decide whether it has been modified.
    const rebuilt = [];
    for (const [name, value] of entries) {
      if (dropped.has(name)) continue;
      if (!joined.has(name)) {
        rebuilt.push([name, value]);
        continue;
      }
      const [param, wire] = joined.get(name);
      if (wire) rebuilt.push([param, wire]);
      emitted.add(param);
    }

    // A list whose rows carry no direction controls has nothing in the
    // entry list to anchor to — the contract asks for `dir-<key>` on
    // every row precisely so the no-JS submit keeps the order — so its
    // value goes at the end rather than nowhere.
    for (const [param, wire] of pending) {
      if (!emitted.has(param) && wire) rebuilt.push([param, wire]);
    }

    const touched = new Set([
      ...rebuilt.map(([n]) => n),
      ...joined.keys(),
      ...dropped,
      ...[...joined.values()].map(([param]) => param),
    ]);
    for (const name of touched) event.formData.delete(name);
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
