import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installSortList, sortWire } from '../src/js/sort-list.js';

let uninstall = () => {};

const FIXTURE = `
  <form id="sort-form">
    <input name="f-status" value="open">
    <ul data-hc-sortable data-hc-sort-list="sort">
      <li data-hc-sort-key="ship">
        <select name="dir-ship">
          <option value="asc">Ascending</option>
          <option value="desc" selected>Descending</option>
        </select>
      </li>
      <li data-hc-sort-key="order">
        <select name="dir-order">
          <option value="asc" selected>Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </li>
    </ul>
    <input name="page-size" value="40">
  </form>
`;

// jsdom implements FormData but not the `formdata` event, so build the
// entry list by hand and dispatch the event the way a browser would
// while constructing `new FormData(form)`. Real-browser firing is
// pinned by test-browser/sort-list.spec.mjs across all three engines.
function serialize(form) {
  const formData = new FormData();
  for (const el of form.elements) {
    if (el.name && !el.disabled && el.value !== undefined && el.type !== 'submit') {
      formData.append(el.name, el.value);
    }
  }
  const event = new Event('formdata', { bubbles: true });
  event.formData = formData;
  form.dispatchEvent(event);
  return [...formData.entries()];
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('sortWire', () => {
  it('reads the keys in DOM order, with - for descending', () => {
    document.body.innerHTML = FIXTURE;
    const list = document.querySelector('[data-hc-sort-list]');
    const read = (name) => document.querySelector(`[name="${name}"]`)?.value ?? null;
    expect(sortWire(list, read)).toBe('-ship,order');
  });

  it('an empty list is no sort at all', () => {
    document.body.innerHTML = `<ul data-hc-sort-list="sort"></ul>`;
    expect(sortWire(document.querySelector('[data-hc-sort-list]'), () => null)).toBe('');
  });
});

describe('installSortList', () => {
  it('joins the ordered rows into one param, where they started', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSortList();
    expect(serialize(document.getElementById('sort-form'))).toEqual([
      ['f-status', 'open'],
      ['sort', '-ship,order'],
      ['page-size', '40'],
    ]);
  });

  it('the DOM order is the sort order', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSortList();
    const list = document.querySelector('[data-hc-sort-list]');
    // What installSortable() does when a row is dragged or moved with
    // the keyboard: it reorders the nodes, and nothing else.
    list.append(list.firstElementChild);
    expect(
      serialize(document.getElementById('sort-form')).find(([n]) => n === 'sort'),
    ).toEqual(['sort', 'order,-ship']);
  });

  it('an emptied list clears the sort rather than sending it blank', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSortList();
    const list = document.querySelector('[data-hc-sort-list]');
    list.innerHTML = '';
    const names = serialize(document.getElementById('sort-form')).map(([n]) => n);
    expect(names).toEqual(['f-status', 'page-size']);
  });

  it('a stale sort param is replaced, never duplicated', () => {
    document.body.innerHTML = `
      <form id="sort-form">
        <input type="hidden" name="sort" value="-amount">
        <ul data-hc-sort-list="sort">
          <li data-hc-sort-key="ship"><select name="dir-ship"><option value="asc" selected>a</option></select></li>
        </ul>
      </form>`;
    uninstall = installSortList();
    expect(serialize(document.getElementById('sort-form'))).toEqual([['sort', 'ship']]);
  });

  it('takes the param name from the attribute', () => {
    document.body.innerHTML = `
      <form id="sort-form">
        <ul data-hc-sort-list="order-by">
          <li data-hc-sort-key="ship"><select name="dir-ship"><option value="desc" selected>d</option></select></li>
        </ul>
      </form>`;
    uninstall = installSortList();
    expect(serialize(document.getElementById('sort-form'))).toEqual([
      ['order-by', '-ship'],
    ]);
  });

  it('a row with no direction control sorts ascending, at the end', () => {
    document.body.innerHTML = `
      <form id="sort-form">
        <ul data-hc-sort-list="sort">
          <li data-hc-sort-key="ship"></li>
        </ul>
        <input name="q" value="x">
      </form>`;
    uninstall = installSortList();
    // Nothing in the entry list to anchor to — the contract asks for a
    // dir-<key> control on every row exactly so the order survives a
    // no-JS submit — so the joined value goes last rather than nowhere.
    expect(serialize(document.getElementById('sort-form'))).toEqual([
      ['q', 'x'],
      ['sort', 'ship'],
    ]);
  });

  it('is idempotent and uninstalls cleanly', () => {
    document.body.innerHTML = FIXTURE;
    const first = installSortList();
    expect(installSortList()).toBe(first);
    expect(
      serialize(document.getElementById('sort-form')).filter(([n]) => n === 'sort'),
    ).toHaveLength(1);

    first();
    uninstall = () => {};
    // Back to the no-JS wire: the per-key controls, in DOM order.
    expect(serialize(document.getElementById('sort-form'))).toEqual([
      ['f-status', 'open'],
      ['dir-ship', 'desc'],
      ['dir-order', 'asc'],
      ['page-size', '40'],
    ]);
  });
});
