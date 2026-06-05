// installCombobox — behavior for the WAI-ARIA 1.2 combobox pattern.
//
// Activates every `.hc-combobox` that contains an input with
// `role="combobox"` and a sibling `<ul role="listbox" popover>` (the
// pair the CSS expects). The behavior wires:
//
//   - Filter: each `input` keystroke hides options whose text does
//     not contain the typed string (case-insensitive).
//   - Open / close: focus on input opens the listbox, blur (after a
//     short grace period for option clicks) closes it. Escape and
//     outside click dismiss via the popover algorithm.
//   - Keyboard: ↓ opens / moves to next visible option; ↑ moves to
//     previous; Home / End jump to first / last visible; Enter
//     selects; Tab closes and yields to the next tab stop.
//   - `aria-activedescendant` tracks the highlighted option;
//     `aria-expanded` and the input's `aria-controls` stay in sync.
//   - On select: dispatch a bubbling `hc:comboboxselect` event whose
//     `detail` carries `{ value, label, option, input }`, update the
//     input value, close the listbox.
//   - Anchor Positioning: inline `anchor-name` on the input and
//     `position-anchor` on the listbox so the popover lands under
//     the input. Falls back to JS positioning in browsers without
//     CSS Anchor Positioning.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcComboboxUninstall';
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

function options(listbox) {
  return Array.from(listbox.querySelectorAll(':scope > [role="option"]'));
}

function visibleOptions(listbox) {
  return options(listbox).filter(
    (o) => !o.hasAttribute('hidden')
      && o.getAttribute('aria-disabled') !== 'true',
  );
}

function clearActive(listbox) {
  for (const o of options(listbox)) o.removeAttribute('data-active');
}

function setActive(input, listbox, option) {
  clearActive(listbox);
  if (option) {
    option.setAttribute('data-active', 'true');
    if (!option.id) option.id = `hc-combobox-opt-${Math.random().toString(36).slice(2, 9)}`;
    input.setAttribute('aria-activedescendant', option.id);
    // Scroll the active option into the visible window inside the
    // scrollable listbox. jsdom (and very old browsers) may lack
    // scrollIntoView, so guard the call.
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
    const label = (o.textContent ?? '').trim().toLowerCase();
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
  let marker = listbox.querySelector('.hc-combobox__empty');
  if (shouldShow) {
    if (!marker) {
      marker = listbox.ownerDocument.createElement('li');
      marker.className = 'hc-combobox__empty';
      marker.setAttribute('role', 'presentation');
      marker.textContent = listbox.getAttribute('data-hc-empty') || t('combobox.empty');
      listbox.appendChild(marker);
    }
  } else if (marker) {
    marker.remove();
  }
}

function syncSelectedFromInput(input, listbox) {
  const value = input.value.trim().toLowerCase();
  for (const o of options(listbox)) {
    const label = (o.textContent ?? '').trim().toLowerCase();
    if (value !== '' && label === value) {
      o.setAttribute('aria-selected', 'true');
    } else {
      o.removeAttribute('aria-selected');
    }
  }
}

function attach(root, detachers) {
  if (detachers.has(root)) return;
  const input = findInput(root);
  const listbox = findListbox(root);
  if (!input || !listbox) return;
  if (!listbox.hasAttribute('popover')) listbox.setAttribute('popover', 'manual');
  if (!input.hasAttribute('role')) input.setAttribute('role', 'combobox');
  if (!input.hasAttribute('aria-haspopup')) input.setAttribute('aria-haspopup', 'listbox');
  if (!input.hasAttribute('aria-autocomplete')) input.setAttribute('aria-autocomplete', 'list');
  if (!input.hasAttribute('aria-controls') && listbox.id) {
    input.setAttribute('aria-controls', listbox.id);
  }
  input.setAttribute('aria-expanded', 'false');

  const usingAnchor = supportsAnchorPositioning();
  const anchorName = `--hc-combobox-${listbox.id || Math.random().toString(36).slice(2, 9)}`;
  if (usingAnchor) {
    input.style.setProperty('anchor-name', anchorName);
    listbox.style.setProperty('position-anchor', anchorName);
  }

  let blurTimer = null;

  function open() {
    if (listbox.matches(':popover-open')) return;
    if (!usingAnchor) positionFallback(input, listbox);
    listbox.showPopover();
    input.setAttribute('aria-expanded', 'true');
    // Highlight the currently selected option if any, else the first
    // visible one.
    const selected = options(listbox).find((o) => o.getAttribute('aria-selected') === 'true');
    setActive(input, listbox, selected ?? visibleOptions(listbox)[0] ?? null);
  }

  function close() {
    if (!listbox.matches(':popover-open')) return;
    listbox.hidePopover();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    clearActive(listbox);
  }

  function positionFallback(input, listbox) {
    const r = input.getBoundingClientRect();
    Object.assign(listbox.style, {
      position: 'fixed',
      insetBlockStart: `${r.bottom + 4}px`,
      insetInlineStart: `${r.left}px`,
      minWidth: `${r.width}px`,
      margin: '0',
    });
  }

  function select(option) {
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    const value = option.getAttribute('data-value') ?? option.textContent?.trim() ?? '';
    const label = (option.textContent ?? '').trim();
    input.value = label;
    syncSelectedFromInput(input, listbox);
    input.dispatchEvent(
      new CustomEvent('hc:comboboxselect', {
        bubbles: true,
        detail: { value, label, option, input },
      }),
    );
    close();
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
          select(active);
        }
        break;
      }
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
      select(opt);
      input.focus();
    }
  }

  function onListboxMousedown(event) {
    // Prevent the input from blurring before the click handler runs.
    event.preventDefault();
  }

  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  listbox.addEventListener('click', onListboxClick);
  listbox.addEventListener('mousedown', onListboxMousedown);

  // Initial selected-state sync (in case the input was pre-filled).
  syncSelectedFromInput(input, listbox);

  detachers.set(root, () => {
    if (blurTimer) clearTimeout(blurTimer);
    if (listbox.matches(':popover-open')) listbox.hidePopover();
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('blur', onBlur);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKeydown);
    listbox.removeEventListener('click', onListboxClick);
    listbox.removeEventListener('mousedown', onListboxMousedown);
    input.removeAttribute('aria-haspopup');
    input.removeAttribute('aria-autocomplete');
    input.removeAttribute('aria-expanded');
    input.removeAttribute('aria-activedescendant');
    if (usingAnchor) {
      input.style.removeProperty('anchor-name');
      listbox.style.removeProperty('position-anchor');
    }
    clearActive(listbox);
    toggleEmptyMarker(listbox, false);
  });
}

/**
 * Install the combobox behavior on every `.hc-combobox` in the
 * document. The first matching `[role="combobox"]` input is paired
 * with the first `[role="listbox"]` inside the same wrapper.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installCombobox(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-combobox')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-combobox')) attach(node, detachers);
          node.querySelectorAll?.('.hc-combobox').forEach((el) =>
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
