// Unit coverage for the shared WAI-ARIA menu primitives. installMenu,
// installContextMenu, and installMenubar all delegate item scoping,
// roving focus, type-ahead, and the checkbox / radio selection semantics
// (incl. the hc:menuselect contract — public API per VERSIONING §5) to
// this module; a regression here breaks all three surfaces at once.
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  itemsOf,
  isEnabled,
  radioGroupOf,
  focusFirst,
  focusLast,
  focusByOffset,
  typeaheadStep,
  handleMenuNavKeydown,
  selectMenuItem,
} from '../src/js/menu-core.js';

beforeEach(() => {
  document.body.innerHTML = `
    <menu class="hc-menu" id="m">
      <li><button role="menuitem" id="i1">Alpha</button></li>
      <li><button role="menuitem" id="i2" disabled>Beta</button></li>
      <li><button role="menuitem" id="i3">Gamma</button></li>
      <li>
        <div role="group" id="g">
          <button role="menuitemradio" id="r1" aria-checked="false">Small</button>
          <button role="menuitemradio" id="r2" aria-checked="true">Large</button>
        </div>
      </li>
      <li><button role="menuitemcheckbox" id="c1" aria-checked="false">Grid lines</button></li>
      <li>
        <menu class="hc-menu" id="sub">
          <li><button role="menuitem" id="s1">Sub item</button></li>
          <li><button role="menuitemradio" id="sr1" aria-checked="true">Sub radio</button></li>
        </menu>
      </li>
    </menu>`;
});

const $ = (id) => document.getElementById(id);

describe('itemsOf', () => {
  it('collects items in document order, including inside role="group"', () => {
    expect(itemsOf($('m')).map((el) => el.id)).toEqual([
      'i1', 'i2', 'i3', 'r1', 'r2', 'c1',
    ]);
  });

  it('excludes items that belong to a nested submenu', () => {
    expect(itemsOf($('m')).some((el) => el.id === 's1')).toBe(false);
    expect(itemsOf($('sub')).map((el) => el.id)).toEqual(['s1', 'sr1']);
  });
});

describe('isEnabled', () => {
  it('rejects disabled and aria-disabled="true" items', () => {
    expect(isEnabled($('i1'))).toBe(true);
    expect(isEnabled($('i2'))).toBe(false);
    $('i3').setAttribute('aria-disabled', 'true');
    expect(isEnabled($('i3'))).toBe(false);
  });
});

describe('radioGroupOf', () => {
  it('resolves the nearest role="group", falling back to the menu', () => {
    expect(radioGroupOf($('r1'))).toBe($('g'));
    expect(radioGroupOf($('c1'))).toBe($('m'));
  });
});

describe('roving focus', () => {
  it('focusFirst / focusLast land on the first / last enabled item', () => {
    focusFirst($('m'));
    expect(document.activeElement).toBe($('i1'));
    focusLast($('m'));
    expect(document.activeElement).toBe($('c1'));
  });

  it('focusByOffset skips disabled items and wraps in both directions', () => {
    focusByOffset($('m'), $('i1'), +1);
    expect(document.activeElement).toBe($('i3')); // i2 is disabled
    focusByOffset($('m'), $('c1'), +1);
    expect(document.activeElement).toBe($('i1')); // wrap end → start
    focusByOffset($('m'), $('i1'), -1);
    expect(document.activeElement).toBe($('c1')); // wrap start → end
  });

  it('treats focus-elsewhere as before-first so ArrowDown enters at the top', () => {
    focusByOffset($('m'), document.body, +1);
    expect(document.activeElement).toBe($('i1'));
  });
});

describe('typeaheadStep', () => {
  it('moves to the next item starting with the letter, searching forward with wrap', () => {
    typeaheadStep($('m'), $('i1'), 'g');
    expect(document.activeElement).toBe($('i3')); // Gamma
    typeaheadStep($('m'), $('i3'), 'g');
    expect(document.activeElement).toBe($('c1')); // Grid lines (next g, wrapping past radios)
    typeaheadStep($('m'), $('c1'), 'g');
    expect(document.activeElement).toBe($('i3')); // wraps back to Gamma
  });

  it('is case-insensitive and a no-op when nothing matches', () => {
    typeaheadStep($('m'), $('i1'), 'S');
    expect(document.activeElement).toBe($('r1')); // Small
    const before = document.activeElement;
    typeaheadStep($('m'), before, 'z');
    expect(document.activeElement).toBe(before);
  });
});

describe('handleMenuNavKeydown', () => {
  const fakeEvent = (key, extra = {}) => ({
    key,
    preventDefault: vi.fn(),
    ctrlKey: false,
    metaKey: false,
    ...extra,
  });

  it('handles ArrowDown / ArrowUp / Home / End with preventDefault', () => {
    focusFirst($('m'));
    let e = fakeEvent('ArrowDown');
    expect(handleMenuNavKeydown($('m'), e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe($('i3'));

    e = fakeEvent('End');
    handleMenuNavKeydown($('m'), e);
    expect(document.activeElement).toBe($('c1'));

    e = fakeEvent('Home');
    handleMenuNavKeydown($('m'), e);
    expect(document.activeElement).toBe($('i1'));

    e = fakeEvent('ArrowUp');
    handleMenuNavKeydown($('m'), e);
    expect(document.activeElement).toBe($('c1'));
  });

  it('Tab closes the menu via hidePopover', () => {
    const menu = $('m');
    menu.hidePopover = vi.fn();
    const e = fakeEvent('Tab');
    expect(handleMenuNavKeydown(menu, e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(menu.hidePopover).toHaveBeenCalledTimes(1);
  });

  it('routes printable keys to type-ahead but not ctrl/meta chords', () => {
    focusFirst($('m'));
    expect(handleMenuNavKeydown($('m'), fakeEvent('g'))).toBe(true);
    expect(document.activeElement).toBe($('i3'));
    expect(handleMenuNavKeydown($('m'), fakeEvent('g', { ctrlKey: true }))).toBe(false);
    expect(handleMenuNavKeydown($('m'), fakeEvent('Escape'))).toBe(false);
  });
});

describe('selectMenuItem', () => {
  it('toggles aria-checked on menuitemcheckbox, first activation checking it', () => {
    const onSelect = vi.fn();
    $('m').addEventListener('hc:menuselect', onSelect);
    let result = selectMenuItem($('m'), $('c1'));
    expect(result).toEqual({ role: 'menuitemcheckbox', checked: true });
    expect($('c1').getAttribute('aria-checked')).toBe('true');
    result = selectMenuItem($('m'), $('c1'));
    expect(result.checked).toBe(false);
    expect($('c1').getAttribute('aria-checked')).toBe('false');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('checks a menuitemradio exclusively within its group', () => {
    selectMenuItem($('m'), $('r1'));
    expect($('r1').getAttribute('aria-checked')).toBe('true');
    expect($('r2').getAttribute('aria-checked')).toBe('false');
  });

  it('never clears radios that live in a nested submenu', () => {
    selectMenuItem($('m'), $('r1'));
    expect($('sr1').getAttribute('aria-checked')).toBe('true');
  });

  it('dispatches a bubbling hc:menuselect with the contract detail shape', () => {
    const seen = [];
    document.addEventListener('hc:menuselect', (e) => seen.push(e));
    const result = selectMenuItem($('m'), $('i1'), { trigger: $('i3') });
    expect(result).toEqual({ role: 'menuitem', checked: undefined });
    expect(seen).toHaveLength(1);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].detail).toEqual({
      item: $('i1'),
      menu: $('m'),
      checked: undefined,
      trigger: $('i3'),
    });
  });
});
