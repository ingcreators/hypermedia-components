import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { installSortable } from '../src/js/sortable.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

const LIST = `
  <ul id="list" data-hc-sortable>
    <li id="a" data-hc-sortable-id="a">
      <button type="button" id="ha" data-hc-sortable-handle>⠿</button>A
      <input type="hidden" name="order[]" value="a">
    </li>
    <li id="b" data-hc-sortable-id="b">
      <button type="button" id="hb" data-hc-sortable-handle>⠿</button>B
      <input type="hidden" name="order[]" value="b">
    </li>
    <li id="c" data-hc-sortable-id="c">
      <button type="button" id="hc" data-hc-sortable-handle>⠿</button>C
      <input type="hidden" name="order[]" value="c">
    </li>
  </ul>`;

const $ = (id) => document.getElementById(id);
const order = () => [...$('list').children].map((li) => li.id);
const liveText = () => document.querySelector('[role="status"]')?.textContent ?? '';

function key(el, k) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

function pointer(type, el, x, y) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

/** Give each item a stacked fake rect so axis/midpoint math works. */
function stackRects() {
  ['a', 'b', 'c'].forEach((id, i) => {
    $(id).getBoundingClientRect = () => ({
      left: 0,
      top: i * 40,
      width: 100,
      height: 40,
      right: 100,
      bottom: i * 40 + 40,
    });
  });
}

describe('installSortable — handle preparation', () => {
  it('sets touch-action, aria-pressed, and a default aria-label on icon-only handles', () => {
    document.body.innerHTML = LIST;
    uninstall = installSortable();
    const handle = $('ha');
    expect(handle.style.touchAction).toBe('none');
    expect(handle.getAttribute('aria-pressed')).toBe('false');
    expect(handle.getAttribute('aria-label')).toBe('Reorder');
  });

  it('keeps an author-provided aria-label and text-labelled handles', () => {
    document.body.innerHTML = `
      <ul data-hc-sortable>
        <li><button id="h1" data-hc-sortable-handle aria-label="Move row">⠿</button></li>
        <li><button id="h2" data-hc-sortable-handle>Move</button></li>
      </ul>`;
    uninstall = installSortable();
    expect($('h1').getAttribute('aria-label')).toBe('Move row');
    expect($('h2').hasAttribute('aria-label')).toBe(false);
  });

  it('prepares handles inside content added after install', async () => {
    uninstall = installSortable();
    document.body.innerHTML = LIST;
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver tick
    expect($('ha').getAttribute('aria-pressed')).toBe('false');
  });

  it('is idempotent — a second install returns the same uninstaller', () => {
    document.body.innerHTML = LIST;
    uninstall = installSortable();
    expect(installSortable()).toBe(uninstall);
  });
});

describe('installSortable — keyboard reordering', () => {
  beforeEach(() => {
    document.body.innerHTML = LIST;
    uninstall = installSortable();
  });

  it('Space grabs (state + announcement), arrows move, Space drops and fires hc:sortchange', () => {
    const events = [];
    $('list').addEventListener('hc:sortchange', (e) => events.push(e.detail));

    key($('ha'), ' ');
    expect($('a').getAttribute('data-grabbed')).toBe('true');
    expect($('ha').getAttribute('aria-pressed')).toBe('true');
    expect(liveText()).toBe('Grabbed. Position 1 of 3.');

    key($('ha'), 'ArrowDown');
    expect(order()).toEqual(['b', 'a', 'c']);
    expect(liveText()).toBe('Position 2 of 3');

    key($('ha'), 'ArrowDown');
    expect(order()).toEqual(['b', 'c', 'a']);

    key($('ha'), ' ');
    expect($('a').hasAttribute('data-grabbed')).toBe(false);
    expect($('ha').getAttribute('aria-pressed')).toBe('false');
    expect(liveText()).toBe('Dropped. Position 3 of 3.');
    expect(events).toEqual([
      { item: $('a'), from: 0, to: 2, order: ['b', 'c', 'a'] },
    ]);
  });

  it('the hidden inputs serialize in the new order after a move', () => {
    key($('ha'), ' ');
    key($('ha'), 'ArrowDown');
    key($('ha'), ' ');
    const values = [...$('list').querySelectorAll('input[name="order[]"]')].map((i) => i.value);
    expect(values).toEqual(['b', 'a', 'c']);
  });

  it('Escape cancels and restores the original position, with no event', () => {
    const spy = vi.fn();
    $('list').addEventListener('hc:sortchange', spy);
    key($('hb'), ' ');
    key($('hb'), 'ArrowUp');
    expect(order()).toEqual(['b', 'a', 'c']);
    key($('hb'), 'Escape');
    expect(order()).toEqual(['a', 'b', 'c']);
    expect($('b').hasAttribute('data-grabbed')).toBe(false);
    expect(liveText()).toBe('Reorder cancelled');
    expect(spy).not.toHaveBeenCalled();
  });

  it('dropping without moving fires no event', () => {
    const spy = vi.fn();
    $('list').addEventListener('hc:sortchange', spy);
    key($('ha'), ' ');
    key($('ha'), ' ');
    expect(spy).not.toHaveBeenCalled();
  });

  it('arrows do nothing when not grabbed', () => {
    key($('ha'), 'ArrowDown');
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('blur commits the grab', () => {
    const events = [];
    $('list').addEventListener('hc:sortchange', (e) => events.push(e.detail));
    key($('ha'), ' ');
    key($('ha'), 'ArrowDown');
    $('ha').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect($('a').hasAttribute('data-grabbed')).toBe(false);
    expect(events.length).toBe(1);
    expect(events[0].to).toBe(1);
  });
});

describe('installSortable — pointer reordering', () => {
  beforeEach(() => {
    document.body.innerHTML = LIST;
    stackRects();
    uninstall = installSortable();
  });

  it('drags past a sibling midpoint, marks data-dragging, commits on release', () => {
    const events = [];
    $('list').addEventListener('hc:sortchange', (e) => events.push(e.detail));

    pointer('pointerdown', $('ha'), 50, 20);
    pointer('pointermove', $('ha'), 50, 21); // below threshold — not a drag yet
    expect($('a').hasAttribute('data-dragging')).toBe(false);

    pointer('pointermove', $('ha'), 50, 70); // past b's midpoint (60)
    expect($('a').getAttribute('data-dragging')).toBe('true');
    expect(order()).toEqual(['b', 'a', 'c']);

    pointer('pointerup', $('ha'), 50, 70);
    expect($('a').hasAttribute('data-dragging')).toBe(false);
    expect(events).toEqual([
      { item: $('a'), from: 0, to: 1, order: ['b', 'a', 'c'] },
    ]);
  });

  it('Escape mid-drag restores the original order and fires no event', () => {
    const spy = vi.fn();
    $('list').addEventListener('hc:sortchange', spy);
    pointer('pointerdown', $('ha'), 50, 20);
    pointer('pointermove', $('ha'), 50, 70);
    expect(order()).toEqual(['b', 'a', 'c']);
    key(document.body, 'Escape');
    expect(order()).toEqual(['a', 'b', 'c']);
    pointer('pointerup', $('ha'), 50, 70);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a plain click (no movement) neither drags nor fires', () => {
    const spy = vi.fn();
    $('list').addEventListener('hc:sortchange', spy);
    pointer('pointerdown', $('ha'), 50, 20);
    pointer('pointerup', $('ha'), 50, 20);
    expect(order()).toEqual(['a', 'b', 'c']);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('installSortable — uninstall', () => {
  it('removes listeners and the live region', () => {
    document.body.innerHTML = LIST;
    const un = installSortable();
    key($('ha'), ' ');
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    key($('ha'), 'Escape');
    un();
    key($('ha'), ' ');
    expect($('a').hasAttribute('data-grabbed')).toBe(false);
    expect(document.querySelector('[role="status"]')).toBeNull();
  });
});
