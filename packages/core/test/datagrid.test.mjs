import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installDatagrid } from '../src/js/datagrid.js';

let uninstall = () => {};

const FIXTURE = `
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell" data-frozen rowspan="2" scope="col">
              <input type="checkbox" class="hc-checkbox" id="select-all" aria-label="Select all">
            </th>
            <th class="hc-datagrid__headcell" data-frozen data-frozen-edge rowspan="2" scope="col">ID</th>
            <th class="hc-datagrid__headcell" colspan="2">Group</th>
          </tr>
          <tr>
            <th class="hc-datagrid__headcell" scope="col">A</th>
            <th class="hc-datagrid__headcell" scope="col">B</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__body">
          <tr class="hc-datagrid__row" id="row-1">
            <td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" aria-label="Select row 1"></td>
            <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row" id="c-1-id">1</th>
            <td class="hc-datagrid__cell" id="c-1-a">a1</td>
            <td class="hc-datagrid__cell" id="c-1-b">b1</td>
          </tr>
          <tr class="hc-datagrid__row" id="row-2">
            <td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" aria-label="Select row 2"></td>
            <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row" id="c-2-id">2</th>
            <td class="hc-datagrid__cell" id="c-2-a">a2</td>
            <td class="hc-datagrid__cell" id="c-2-b">b2</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

function press(el, key, opts = {}) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }),
  );
}

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installDatagrid', () => {
  it('is idempotent', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installDatagrid();
    const u2 = installDatagrid();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('applies grid roles and a roving tabindex (first cell is the entry point)', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    expect(document.querySelector('.hc-datagrid__table').getAttribute('role')).toBe('grid');
    expect($('c-1-a').getAttribute('role')).toBe('gridcell');
    expect($('c-1-id').getAttribute('role')).toBe('rowheader');
    // first body cell is tabbable, the rest are not
    const first = $('row-1').querySelector('.hc-datagrid__cell');
    expect(first.tabIndex).toBe(0);
    expect($('c-1-a').tabIndex).toBe(-1);
  });

  it('arrow keys move the active cell', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const first = $('row-1').querySelector('.hc-datagrid__cell');
    first.focus();
    press(first, 'ArrowRight'); // → ID cell
    expect($('c-1-id').getAttribute('data-active')).toBe('');
    press($('c-1-id'), 'ArrowRight'); // → A cell
    expect($('c-1-a').getAttribute('data-active')).toBe('');
    press($('c-1-a'), 'ArrowDown'); // → row 2 A cell
    expect($('c-2-a').getAttribute('data-active')).toBe('');
  });

  it('Home/End and Ctrl+Home/End jump within the row and the grid', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    $('c-1-a').focus();
    press($('c-1-a'), 'End'); // last cell in row 1
    expect($('c-1-b').getAttribute('data-active')).toBe('');
    press($('c-1-b'), 'Home'); // first cell in row 1
    expect($('row-1').querySelector('.hc-datagrid__cell').getAttribute('data-active')).toBe('');
    press($('row-1').querySelector('.hc-datagrid__cell'), 'End', { ctrlKey: true }); // last cell, last row
    expect($('c-2-b').getAttribute('data-active')).toBe('');
    press($('c-2-b'), 'Home', { ctrlKey: true }); // first cell, first row
    expect($('row-1').querySelector('.hc-datagrid__cell').getAttribute('data-active')).toBe('');
  });

  it('Space toggles the active row selection and emits an event', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const onSel = vi.fn();
    $('grid').addEventListener('hc:datagridselectionchange', (e) => onSel(e.detail));

    $('c-2-a').focus();
    press($('c-2-a'), ' ');
    expect($('row-2').getAttribute('aria-selected')).toBe('true');
    expect($('row-2').querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(onSel).toHaveBeenCalled();
    expect(onSel.mock.calls.at(-1)[0]).toMatchObject({ selected: 1, total: 2 });
  });

  it('the select-all checkbox toggles every row', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const all = $('select-all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('row-1').getAttribute('aria-selected')).toBe('true');
    expect($('row-2').getAttribute('aria-selected')).toBe('true');
  });

  it('a single row checkbox drives indeterminate state on select-all', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const rowCb = $('row-1').querySelector('input[type="checkbox"]');
    rowCb.checked = true;
    rowCb.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('row-1').getAttribute('aria-selected')).toBe('true');
    expect($('select-all').indeterminate).toBe(true);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installDatagrid();
    u();
    const first = $('row-1').querySelector('.hc-datagrid__cell');
    first.focus();
    press(first, 'ArrowRight');
    expect($('c-1-id').hasAttribute('data-active')).toBe(false);
  });

  it('picks up a grid added after install (MutationObserver)', async () => {
    uninstall = installDatagrid();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.hc-datagrid__table').getAttribute('role')).toBe('grid');
  });
});
