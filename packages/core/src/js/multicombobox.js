// installMulticombobox — behavior for the multi-select combobox
// pattern (tag input). The visible control shows selected values as
// inline chips next to a filter input; the listbox carries
// `aria-multiselectable="true"` and does not close on each pick so
// the user can choose several without reopening.
//
// Selected state is mirrored to:
//   - `aria-selected="true"` on the option
//   - a chip inside `.hc-multicombobox__tags`
//   - one `<input type="hidden">` per value (only when the wrapper
//     has `data-name="..."`, opt-in form integration)
//
// Events: `hc:multicomboboxchange` dispatches on the input with
// `detail.{values, added, removed, input}` on every state mutation.

const INSTALL_KEY = '__hcMulticomboboxUninstall';
const BLUR_GRACE = 120;

function supportsAnchorPositioning() {
  try {
    return typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('anchor-name', '--x');
  } catch {
    return false;
  }
}

function findInput(root) {
  return root.querySelector('[role="combobox"]');
}

function findListbox(root) {
  return root.querySelector('[role="listbox"]');
}

function findTagsContainer(root) {
  return root.querySelector('.hc-multicombobox__tags');
}

function findHiddenContainer(root) {
  let c = root.querySelector('.hc-multicombobox__hidden');
  if (!c) {
    c = root.ownerDocument.createElement('span');
    c.className = 'hc-multicombobox__hidden';
    c.hidden = true;
    root.appendChild(c);
  }
  return c;
}

function options(listbox) {
  return Array.from(listbox.querySelectorAll(':scope > [role="option"]'));
}

function visibleOptions(listbox) {
  return options(listbox).filter(
    (o) => !o.hasAttribute('hidden')
      && o.getAttribute('aria-disabled') !== 'true',
  );
}

function valueOf(option) {
  return option.getAttribute('data-value') ?? (option.textContent ?? '').trim();
}

function labelOf(option) {
  return (option.textContent ?? '').trim();
}

function findOptionByValue(listbox, value) {
  return options(listbox).find((o) => valueOf(o) === value) ?? null;
}

function clearActive(listbox) {
  for (const o of options(listbox)) o.removeAttribute('data-active');
}

function setActive(input, listbox, option) {
  clearActive(listbox);
  if (option) {
    option.setAttribute('data-active', 'true');
    if (!option.id) option.id = `hc-multicombobox-opt-${Math.random().toString(36).slice(2, 9)}`;
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView?.({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function applyFilter(input, listbox) {
  const q = input.value.trim().toLowerCase();
  let firstVisible = null;
  let visibleCount = 0;
  for (const o of options(listbox)) {
    const label = labelOf(o).toLowerCase();
    const match = q === '' || label.includes(q);
    if (match) {
      o.removeAttribute('hidden');
      if (!firstVisible) firstVisible = o;
      visibleCount += 1;
    } else {
      o.setAttribute('hidden', '');
    }
  }
  toggleEmptyMarker(listbox, visibleCount === 0);
  return firstVisible;
}

function toggleEmptyMarker(listbox, shouldShow) {
  let marker = listbox.querySelector('.hc-multicombobox__empty');
  if (shouldShow) {
    if (!marker) {
      marker = listbox.ownerDocument.createElement('li');
      marker.className = 'hc-multicombobox__empty';
      marker.setAttribute('role', 'presentation');
      marker.textContent = 'No matches';
      listbox.appendChild(marker);
    }
  } else if (marker) {
    marker.remove();
  }
}

function renderTag(doc, value, label, onRemove) {
  const tag = doc.createElement('span');
  tag.className = 'hc-multicombobox__tag';
  tag.dataset.value = value;
  tag.textContent = label;
  const remove = doc.createElement('button');
  remove.type = 'button';
  remove.className = 'hc-multicombobox__tag-remove';
  remove.setAttribute('aria-label', `Remove ${label}`);
  remove.textContent = '×'; // ×
  remove.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove(value);
  });
  tag.appendChild(remove);
  return tag;
}

function renderHidden(doc, name, value) {
  const i = doc.createElement('input');
  i.type = 'hidden';
  i.name = name;
  i.value = value;
  return i;
}

function attach(root, detachers) {
  if (detachers.has(root)) return;
  const input = findInput(root);
  const listbox = findListbox(root);
  const tagsContainer = findTagsContainer(root);
  if (!input || !listbox || !tagsContainer) return;

  if (!listbox.hasAttribute('popover')) listbox.setAttribute('popover', 'manual');
  listbox.setAttribute('aria-multiselectable', 'true');
  if (!input.hasAttribute('aria-haspopup')) input.setAttribute('aria-haspopup', 'listbox');
  if (!input.hasAttribute('aria-autocomplete')) input.setAttribute('aria-autocomplete', 'list');
  if (!input.hasAttribute('aria-controls') && listbox.id) {
    input.setAttribute('aria-controls', listbox.id);
  }
  input.setAttribute('aria-expanded', 'false');

  const usingAnchor = supportsAnchorPositioning();
  const anchorName = `--hc-multicombobox-${listbox.id || Math.random().toString(36).slice(2, 9)}`;
  if (usingAnchor) {
    input.style.setProperty('anchor-name', anchorName);
    listbox.style.setProperty('position-anchor', anchorName);
  }

  const name = root.getAttribute('data-name');
  const hiddenContainer = name ? findHiddenContainer(root) : null;

  // Selected state — single source of truth in this Set. Seed from
  // any options the author marked aria-selected="true" up-front.
  const selected = new Set();
  for (const o of options(listbox)) {
    if (o.getAttribute('aria-selected') === 'true') selected.add(valueOf(o));
  }

  function renderTags() {
    tagsContainer.replaceChildren();
    for (const v of selected) {
      const opt = findOptionByValue(listbox, v);
      const label = opt ? labelOf(opt) : v;
      tagsContainer.appendChild(renderTag(root.ownerDocument, v, label, removeValue));
    }
  }

  function renderHiddens() {
    if (!hiddenContainer) return;
    hiddenContainer.replaceChildren();
    for (const v of selected) {
      hiddenContainer.appendChild(renderHidden(root.ownerDocument, name, v));
    }
  }

  function syncOptions() {
    for (const o of options(listbox)) {
      if (selected.has(valueOf(o))) o.setAttribute('aria-selected', 'true');
      else o.removeAttribute('aria-selected');
    }
  }

  function fireChange(added, removed) {
    input.dispatchEvent(
      new CustomEvent('hc:multicomboboxchange', {
        bubbles: true,
        detail: {
          values: Array.from(selected),
          added: added ? Array.from(added) : [],
          removed: removed ? Array.from(removed) : [],
          input,
        },
      }),
    );
  }

  function addValue(value) {
    if (selected.has(value)) return;
    selected.add(value);
    syncOptions();
    renderTags();
    renderHiddens();
    fireChange([value], []);
  }

  function removeValue(value) {
    if (!selected.has(value)) return;
    selected.delete(value);
    syncOptions();
    renderTags();
    renderHiddens();
    fireChange([], [value]);
  }

  function toggleOption(option) {
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    const v = valueOf(option);
    if (selected.has(v)) removeValue(v);
    else addValue(v);
    // Reset filter so the listbox shows the full menu again — common
    // multi-select UX.
    input.value = '';
    applyFilter(input, listbox);
  }

  let blurTimer = null;

  function positionFallback() {
    const r = input.getBoundingClientRect();
    Object.assign(listbox.style, {
      position: 'fixed',
      insetBlockStart: `${r.bottom + 4}px`,
      insetInlineStart: `${r.left}px`,
      minWidth: `${r.width}px`,
      margin: '0',
    });
  }

  function open() {
    if (listbox.matches(':popover-open')) return;
    if (!usingAnchor) positionFallback();
    listbox.showPopover();
    input.setAttribute('aria-expanded', 'true');
    setActive(input, listbox, visibleOptions(listbox)[0] ?? null);
  }

  function close() {
    if (!listbox.matches(':popover-open')) return;
    listbox.hidePopover();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    clearActive(listbox);
  }

  function move(delta) {
    const all = visibleOptions(listbox);
    if (all.length === 0) return;
    const current = listbox.querySelector('[data-active="true"]');
    const i = current ? all.indexOf(current) : -1;
    const next = all[Math.max(0, Math.min(all.length - 1, i + delta))]
      ?? all[delta > 0 ? 0 : all.length - 1];
    setActive(input, listbox, next);
  }

  function moveTo(edge) {
    const all = visibleOptions(listbox);
    if (all.length === 0) return;
    setActive(input, listbox, edge === 'first' ? all[0] : all[all.length - 1]);
  }

  function onFocus() {
    if (blurTimer) clearTimeout(blurTimer);
    open();
  }

  function onBlur() {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(close, BLUR_GRACE);
  }

  function onInput() {
    const firstVisible = applyFilter(input, listbox);
    if (!listbox.matches(':popover-open')) open();
    setActive(input, listbox, firstVisible);
  }

  function onControlClick(event) {
    // Click anywhere on the control (gap between chips, padding,
    // tags container) focuses the input — the standard tag-input
    // affordance.
    if (event.target.closest('.hc-multicombobox__tag-remove')) return;
    if (event.target === input) return;
    input.focus();
  }

  function onKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!listbox.matches(':popover-open')) open();
        else move(+1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!listbox.matches(':popover-open')) open();
        else move(-1);
        break;
      case 'Home':
        if (listbox.matches(':popover-open')) {
          event.preventDefault();
          moveTo('first');
        }
        break;
      case 'End':
        if (listbox.matches(':popover-open')) {
          event.preventDefault();
          moveTo('last');
        }
        break;
      case 'Enter': {
        if (!listbox.matches(':popover-open')) return;
        const active = listbox.querySelector('[data-active="true"]');
        if (active) {
          event.preventDefault();
          toggleOption(active);
        }
        break;
      }
      case 'Backspace':
        if (input.value === '' && selected.size > 0) {
          event.preventDefault();
          const last = Array.from(selected).pop();
          removeValue(last);
        }
        break;
      case 'Escape':
        if (listbox.matches(':popover-open')) {
          event.preventDefault();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  }

  function onListboxClick(event) {
    const opt = event.target.closest('[role="option"]');
    if (opt && listbox.contains(opt)) {
      if (blurTimer) clearTimeout(blurTimer);
      toggleOption(opt);
      input.focus();
    }
  }

  function onListboxMousedown(event) {
    event.preventDefault();
  }

  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  root.addEventListener('click', onControlClick);
  listbox.addEventListener('click', onListboxClick);
  listbox.addEventListener('mousedown', onListboxMousedown);

  // Initial paint.
  renderTags();
  renderHiddens();

  detachers.set(root, () => {
    if (blurTimer) clearTimeout(blurTimer);
    if (listbox.matches(':popover-open')) listbox.hidePopover();
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('blur', onBlur);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKeydown);
    root.removeEventListener('click', onControlClick);
    listbox.removeEventListener('click', onListboxClick);
    listbox.removeEventListener('mousedown', onListboxMousedown);
    input.removeAttribute('aria-haspopup');
    input.removeAttribute('aria-autocomplete');
    input.removeAttribute('aria-expanded');
    input.removeAttribute('aria-activedescendant');
    listbox.removeAttribute('aria-multiselectable');
    if (usingAnchor) {
      input.style.removeProperty('anchor-name');
      listbox.style.removeProperty('position-anchor');
    }
    tagsContainer.replaceChildren();
    if (hiddenContainer) hiddenContainer.replaceChildren();
    clearActive(listbox);
    toggleEmptyMarker(listbox, false);
  });
}

/**
 * Install the multi-select combobox behavior. Each `.hc-multicombobox`
 * gets a tag chip per selected value, an `aria-multiselectable`
 * listbox, and (optionally, via `data-name`) hidden inputs for form
 * serialisation.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installMulticombobox(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-multicombobox')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-multicombobox')) attach(node, detachers);
          node.querySelectorAll?.('.hc-multicombobox').forEach((el) =>
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
