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

const INSTALL_KEY = '__hcCommandUninstall';

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

  function applyFilter() {
    const q = input.value.trim().toLowerCase();
    let visibleCount = 0;
    for (const item of itemsOf(root)) {
      const match = q === '' || labelOf(item).toLowerCase().includes(q);
      if (match) {
        item.removeAttribute('hidden');
        visibleCount += 1;
      } else {
        item.setAttribute('hidden', '');
      }
    }
    // Hide a group whose every option is now hidden (heading + all).
    for (const group of groupsOf(root)) {
      const anyVisible = group.querySelector('[role="option"]:not([hidden])');
      if (anyVisible) group.removeAttribute('hidden');
      else group.setAttribute('hidden', '');
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
