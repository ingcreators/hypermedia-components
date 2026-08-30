// installCommand — behavior for a command palette (⌘K launcher).
//
// Activates every `.hc-command` that contains an input with
// `role="combobox"` and a `[role="listbox"]`. The palette is the
// WAI-ARIA combobox pattern used as an action launcher: type to filter
// the options, Arrow / Home / End move the `aria-activedescendant`
// highlight, Enter runs the active item, clicking runs an item. Items
// may be grouped under `[role="group"]` headings; groups whose items
// are all filtered out are hidden, and a `.hc-command__empty` element
// is shown when nothing matches.
//
// Typing fuzzy-filters AND re-ranks the options: query characters must
// appear in order (subsequence match), and matches score higher when they
// are contiguous or land on a word / camelCase boundary. Items reorder by
// score (ties keep the authored order); clearing the query restores it.
// Opt out with `data-filter="substring"` on the `.hc-command` to keep the
// plain case-insensitive substring filter (no reordering). Filtering is
// always client-side — the palette never touches the network.
//
// Selecting an item dispatches a bubbling `hc:commandselect` on the
// `.hc-command` root with `detail { item, value, command }` (value is
// the item's `data-value`, falling back to its label text). If the
// palette is inside a native `<dialog>`, selection closes it.
//
// ⌘K / Ctrl+K opener: put `data-hotkey="k"` (any single key,
// default `k`) on the `<dialog>` (or the `.hc-command`), and the
// behavior toggles that dialog with Cmd/Ctrl + the key, focusing the
// input and resetting the filter on open. Escape, focus trapping, and
// the backdrop come from the native `<dialog>`.
//
// installCommand(root = document) returns an idempotent uninstaller.

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcCommandUninstall';

/**
 * Dependency-free fuzzy score. `query` characters must appear in `text` in
 * order (a subsequence); the run is rewarded for contiguity and for landing
 * on a word / camelCase boundary. Returns `-Infinity` when `query` is not a
 * subsequence of `text`, and `0` for an empty query. Higher is better.
 *
 * Exported for unit tests; not part of the package's public entry.
 *
 * @param {string} query
 * @param {string} text
 * @returns {number}
 */
export function commandScore(query, text) {
  const q = query.trim().toLowerCase();
  if (q === '') return 0;
  const lower = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let run = 0;
  let prevMatch = -2;
  for (let ti = 0; ti < text.length && qi < q.length; ti += 1) {
    if (lower[ti] !== q[qi]) continue;
    let bonus = 1;
    if (prevMatch === ti - 1) {
      run += 1;
      bonus += run * 4; // contiguous run
    } else {
      run = 0;
    }
    if (ti === 0) {
      bonus += 10; // start of the string
    } else {
      const before = text[ti - 1];
      if (before === ' ' || before === '-' || before === '_' || before === '/' || before === '.') {
        bonus += 8; // word boundary
      } else if (/[a-z]/.test(before) && /[A-Z]/.test(text[ti])) {
        bonus += 6; // camelCase boundary
      }
    }
    score += bonus;
    prevMatch = ti;
    qi += 1;
  }
  return qi === q.length ? score : -Infinity;
}

function findInput(root) {
  return root.querySelector('[role="combobox"]');
}

function findList(root) {
  return root.querySelector('[role="listbox"]');
}

function itemsOf(root) {
  return Array.from(root.querySelectorAll('[role="option"]'));
}

function groupsOf(root) {
  return Array.from(root.querySelectorAll('[role="group"]'));
}

function isEnabled(item) {
  return item.getAttribute('aria-disabled') !== 'true';
}

function labelOf(item) {
  const shortcut = item.querySelector('.hc-command__shortcut');
  let text = item.textContent ?? '';
  if (shortcut) text = text.replace(shortcut.textContent ?? '', '');
  return text.trim();
}

function visibleItems(root) {
  return itemsOf(root).filter((i) => !i.hasAttribute('hidden') && isEnabled(i));
}

function attach(root, detachers) {
  if (detachers.has(root)) return;
  const input = findInput(root);
  const list = findList(root);
  if (!input || !list) return;

  const doc = root.ownerDocument;
  const dialog = root.closest('dialog');

  // ARIA wiring on the input.
  if (!input.hasAttribute('role')) input.setAttribute('role', 'combobox');
  if (!input.hasAttribute('aria-autocomplete')) input.setAttribute('aria-autocomplete', 'list');
  if (!input.hasAttribute('aria-haspopup')) input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'true');
  if (!list.id) list.id = `hc-command-list-${Math.random().toString(36).slice(2, 9)}`;
  if (!input.hasAttribute('aria-controls')) input.setAttribute('aria-controls', list.id);

  const emptyEl = root.querySelector('.hc-command__empty');

  // Remember the authored order so we can restore it when the query clears.
  const order = new WeakMap();
  itemsOf(root).forEach((item, i) => order.set(item, i));
  const groupOrder = new WeakMap();
  groupsOf(root).forEach((g, i) => groupOrder.set(g, i));
  let reordered = false;

  function clearActive() {
    for (const i of itemsOf(root)) i.removeAttribute('data-active');
    input.removeAttribute('aria-activedescendant');
  }

  function setActive(item) {
    for (const i of itemsOf(root)) i.removeAttribute('data-active');
    if (!item) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    item.setAttribute('data-active', 'true');
    if (!item.id) item.id = `hc-command-item-${Math.random().toString(36).slice(2, 9)}`;
    input.setAttribute('aria-activedescendant', item.id);
    item.scrollIntoView?.({ block: 'nearest' });
  }

  // Reorder by score (descending), keeping the group structure: options sort
  // within their parent AND groups float by their best option's score, so the
  // global best match lands first while headings stay intact. A null `scoreFn`
  // (and ties) fall back to the authored order, restoring the original
  // sequence when the query clears.
  function reorderBy(scoreFn) {
    // 1. Options within each parent.
    const byParent = new Map();
    for (const item of itemsOf(root)) {
      const p = item.parentElement;
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(item);
    }
    for (const [parent, opts] of byParent) {
      const decorated = opts.map((el) => ({
        el,
        ord: order.get(el) ?? 0,
        s: scoreFn ? scoreFn(el) : 0,
      }));
      decorated.sort((a, b) => b.s - a.s || a.ord - b.ord);
      for (const d of decorated) parent.append(d.el);
    }

    // 2. Groups within the listbox, by their best option score.
    const groups = groupsOf(root);
    if (groups.length) {
      const decorated = groups.map((g) => {
        const opts = [...g.querySelectorAll('[role="option"]')];
        const best = scoreFn ? Math.max(-1e9, ...opts.map(scoreFn)) : 0;
        return { g, ord: groupOrder.get(g) ?? 0, s: best };
      });
      decorated.sort((a, b) => b.s - a.s || a.ord - b.ord);
      for (const d of decorated) list.append(d.g);
    }
  }

  function applyFilter() {
    const raw = input.value.trim();
    const fuzzy = raw !== '' && root.getAttribute('data-filter') !== 'substring';
    const qLower = raw.toLowerCase();
    let visibleCount = 0;
    const score = new Map();

    for (const item of itemsOf(root)) {
      const label = labelOf(item);
      let visible;
      let s = 0;
      if (raw === '') {
        visible = true;
      } else if (!fuzzy) {
        visible = label.toLowerCase().includes(qLower);
      } else {
        s = commandScore(raw, label);
        visible = s > -Infinity;
      }
      score.set(item, s);
      item.toggleAttribute('hidden', !visible);
      if (visible) visibleCount += 1;
    }

    if (fuzzy) {
      reorderBy((el) => {
        const s = score.get(el);
        return Number.isFinite(s) ? s : -1e9;
      });
      reordered = true;
    } else if (reordered) {
      reorderBy(null); // restore the authored order
      reordered = false;
    }

    // Hide a group whose every option is now hidden (heading + all).
    for (const group of groupsOf(root)) {
      const anyVisible = group.querySelector('[role="option"]:not([hidden])');
      group.toggleAttribute('hidden', !anyVisible);
    }
    if (emptyEl) emptyEl.toggleAttribute('hidden', visibleCount > 0);
    return visibleCount;
  }

  function move(delta) {
    const all = visibleItems(root);
    if (all.length === 0) return;
    const current = list.querySelector('[data-active="true"]');
    const i = current ? all.indexOf(current) : -1;
    const n = all.length;
    setActive(all[((i + delta) % n + n) % n]);
  }

  function moveTo(edge) {
    const all = visibleItems(root);
    if (all.length === 0) return;
    setActive(edge === 'first' ? all[0] : all[all.length - 1]);
  }

  function select(item) {
    if (!item || !isEnabled(item)) return;
    const value = item.getAttribute('data-value') ?? labelOf(item);
    root.dispatchEvent(
      new CustomEvent('hc:commandselect', {
        bubbles: true,
        detail: { item, value, command: root },
      }),
    );
    if (dialog && dialog.open) {
      dialog.close();
    } else {
      input.focus();
    }
  }

  function reset() {
    input.value = '';
    applyFilter();
    setActive(visibleItems(root)[0] ?? null);
  }

  function onInput() {
    applyFilter();
    setActive(visibleItems(root)[0] ?? null);
  }

  function onKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(+1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo('first');
        break;
      case 'End':
        event.preventDefault();
        moveTo('last');
        break;
      case 'Enter': {
        const active = list.querySelector('[data-active="true"]');
        if (active) {
          event.preventDefault();
          select(active);
        }
        break;
      }
      default:
        break;
    }
  }

  function onListClick(event) {
    const item = event.target.closest('[role="option"]');
    if (item && list.contains(item) && isEnabled(item)) select(item);
  }

  // ⌘K / Ctrl+K opener (opt-in via data-hotkey).
  const hotkey = (
    dialog?.getAttribute('data-hotkey') ??
    root.getAttribute('data-hotkey')
  );
  function onHotkey(event) {
    if (!hotkey || !dialog) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key.toLowerCase() !== hotkey.toLowerCase()) return;
    event.preventDefault();
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
      reset();
      input.focus();
    }
  }

  function onDialogClose() {
    reset();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  list.addEventListener('click', onListClick);
  if (hotkey && dialog) {
    doc.addEventListener('keydown', onHotkey);
    dialog.addEventListener('close', onDialogClose);
  }

  // Initial state so an inline (non-dialog) palette is usable at once.
  applyFilter();
  setActive(visibleItems(root)[0] ?? null);

  detachers.set(root, () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKeydown);
    list.removeEventListener('click', onListClick);
    if (hotkey && dialog) {
      doc.removeEventListener('keydown', onHotkey);
      dialog.removeEventListener('close', onDialogClose);
    }
    input.removeAttribute('aria-activedescendant');
    input.removeAttribute('aria-haspopup');
    input.removeAttribute('aria-autocomplete');
    clearActive();
  });
}

/**
 * Install the command-palette behavior on every `.hc-command` in the
 * document. The returned uninstaller is idempotent and a no-op when the
 * behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installCommand(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-command')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-command')) attach(node, detachers);
          node.querySelectorAll?.('.hc-command').forEach((el) =>
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
