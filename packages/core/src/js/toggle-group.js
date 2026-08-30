// installToggleGroup — behavior for a row of two-state toggle buttons.
//
// Activates every `.hc-toggle-group` in the document. The group's
// `data-type` selects the selection model:
//
//   data-type="single" (default) — exclusive. The group is a radio
//     group (role="radiogroup", buttons role="radio" + aria-checked).
//     Selection follows focus: arrow keys move focus *and* check, per
//     the WAI-ARIA APG Radio Group pattern. Clicking a button checks
//     it; an already-checked button stays checked (radio semantics —
//     the group is never emptied by a click).
//
//   data-type="multiple" — independent toggles (role="group", buttons
//     with aria-pressed). Arrow keys move focus only; Space / Enter /
//     click toggle the focused button on and off.
//
// Both modes use a roving tabindex so the group is a single Tab stop.
// Disabled buttons (`disabled` or `aria-disabled="true"`) are skipped
// by keyboard navigation and ignored on click.
//
// Space / Enter are handled by the native <button> (they synthesise a
// click), so this behavior only binds Arrow / Home / End in keydown to
// avoid double-firing.
//
// Each change dispatches a bubbling `hc:togglegroupchange` on the
// group:
//   single   → detail { type:'single', value, item, group }
//   multiple → detail { type:'multiple', values, item, pressed, group }
// `value` / `values` come from each button's `data-value` attribute.
//
// Optional form integration: set `data-name="X"` on the group and the
// behavior maintains hidden inputs (one for single, one per pressed
// value for multiple) so the group serialises like a native control.
//
// installToggleGroup(root = document) returns an idempotent uninstaller.

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const INSTALL_KEY = '__hcToggleGroupUninstall';

function typeOf(group) {
  return group.getAttribute('data-type') === 'multiple' ? 'multiple' : 'single';
}

function togglesOf(group) {
  return Array.from(group.querySelectorAll(':scope > .hc-toggle'));
}

function isEnabled(t) {
  return !(t.hasAttribute('disabled') || t.getAttribute('aria-disabled') === 'true');
}

function isOn(t, type) {
  return type === 'single'
    ? t.getAttribute('aria-checked') === 'true'
    : t.getAttribute('aria-pressed') === 'true';
}

function valueOf(t) {
  return t.getAttribute('data-value');
}

/** Make exactly one button the tab stop. */
function setRoving(group, focused) {
  const type = typeOf(group);
  const items = togglesOf(group);
  const enabled = items.filter(isEnabled);
  let stop = focused && isEnabled(focused) ? focused : null;
  // Single (radio) parks the tab stop on the checked option; multiple
  // parks it on the first enabled button (APG toolbar semantics).
  if (!stop && type === 'single') stop = enabled.find((t) => isOn(t, 'single'));
  if (!stop) stop = enabled[0] ?? null;
  for (const t of items) t.setAttribute('tabindex', t === stop ? '0' : '-1');
}

function findHiddenContainer(group) {
  let c = group.querySelector(':scope > .hc-toggle-group__hidden');
  if (!c) {
    c = group.ownerDocument.createElement('span');
    c.className = 'hc-toggle-group__hidden';
    c.hidden = true;
    group.appendChild(c);
  }
  return c;
}

function syncHidden(group) {
  const name = group.getAttribute('data-name');
  if (!name) return;
  const type = typeOf(group);
  const doc = group.ownerDocument;
  const container = findHiddenContainer(group);
  const values = togglesOf(group)
    .filter((t) => isOn(t, type))
    .map(valueOf)
    .filter((v) => v != null);
  const used = type === 'single' ? values.slice(0, 1) : values;
  container.replaceChildren();
  for (const v of used) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = v;
    container.appendChild(input);
  }
}

function dispatch(group, item) {
  const type = typeOf(group);
  const detail =
    type === 'single'
      ? { type, value: valueOf(group.querySelector('[aria-checked="true"]')), item, group }
      : {
          type,
          values: togglesOf(group)
            .filter((t) => isOn(t, 'multiple'))
            .map(valueOf)
            .filter((v) => v != null),
          item,
          pressed: item ? isOn(item, 'multiple') : undefined,
          group,
        };
  group.dispatchEvent(new CustomEvent('hc:togglegroupchange', { bubbles: true, detail }));
}

function selectSingle(group, target) {
  if (target.getAttribute('aria-checked') === 'true') return false;
  for (const t of togglesOf(group)) {
    t.setAttribute('aria-checked', String(t === target));
  }
  return true;
}

function toggleMultiple(target) {
  const next = target.getAttribute('aria-pressed') !== 'true';
  target.setAttribute('aria-pressed', String(next));
  return true;
}

function commit(group, target, changed) {
  setRoving(group, target);
  if (!changed) return;
  syncHidden(group);
  dispatch(group, target);
}

function moveFocus(group, current, delta) {
  const enabled = togglesOf(group).filter(isEnabled);
  if (enabled.length === 0) return;
  const i = enabled.indexOf(current);
  if (i === -1) return;
  const next = enabled[(i + delta + enabled.length) % enabled.length];
  next.focus();
  if (typeOf(group) === 'single') {
    commit(group, next, selectSingle(group, next));
  } else {
    setRoving(group, next);
  }
}

function focusEdge(group, edge) {
  const enabled = togglesOf(group).filter(isEnabled);
  if (enabled.length === 0) return;
  const target = edge === 'first' ? enabled[0] : enabled[enabled.length - 1];
  target.focus();
  if (typeOf(group) === 'single') {
    commit(group, target, selectSingle(group, target));
  } else {
    setRoving(group, target);
  }
}

function attach(group, detachers) {
  if (detachers.has(group)) return;
  setRoving(group, null);
  syncHidden(group);

  function onClick(event) {
    const t = event.target.closest('.hc-toggle');
    if (!t || t.parentElement !== group || !isEnabled(t)) return;
    if (typeOf(group) === 'single') {
      commit(group, t, selectSingle(group, t));
    } else {
      commit(group, t, toggleMultiple(t));
    }
  }

  function onKeydown(event) {
    const t = event.target.closest('.hc-toggle');
    if (!t || t.parentElement !== group) return;
    // In RTL the horizontal arrows are mirrored; vertical arrows are not.
    let key = event.key;
    if (getComputedStyle(group).direction === 'rtl') {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(group, t, +1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(group, t, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusEdge(group, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusEdge(group, 'last');
        break;
      default:
        break;
    }
  }

  group.addEventListener('click', onClick);
  group.addEventListener('keydown', onKeydown);

  detachers.set(group, () => {
    group.removeEventListener('click', onClick);
    group.removeEventListener('keydown', onKeydown);
  });
}

/**
 * Install the toggle-group behavior on every `.hc-toggle-group` in the
 * document. The returned uninstaller is idempotent and a no-op when the
 * behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installToggleGroup(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-toggle-group')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-toggle-group')) attach(node, detachers);
          node.querySelectorAll?.('.hc-toggle-group').forEach((el) =>
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
