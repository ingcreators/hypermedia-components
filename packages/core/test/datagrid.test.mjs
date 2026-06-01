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

  it('creates a shared overflow tooltip and removes it on uninstall', () => {
    document.body.innerHTML = FIXTURE;
    const u = installDatagrid();
    expect(document.querySelector('.hc-datagrid__tooltip')).toBeTruthy();
    u();
    expect(document.querySelector('.hc-datagrid__tooltip')).toBeNull();
  });

  it('picks up a grid added after install (MutationObserver)', async () => {
    uninstall = installDatagrid();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.hc-datagrid__table').getAttribute('role')).toBe('grid');
  });
});

const FIXTURE_EDIT = `
  <div class="hc-datagrid" id="grid">
    <template data-datagrid-editor data-col="name"><input class="hc-input" type="text" aria-label="Name"></template>
    <template data-datagrid-editor data-col="status">
      <select class="hc-select" aria-label="Status"><option value="open">Open</option><option value="done">Done</option></select>
    </template>
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head"><tr>
          <th class="hc-datagrid__headcell" scope="col">Name</th>
          <th class="hc-datagrid__headcell" scope="col">Status</th>
        </tr></thead>
        <tbody class="hc-datagrid__body">
          <tr class="hc-datagrid__row" id="row-1">
            <td class="hc-datagrid__cell" id="c-name" data-editable data-col="name">Ada</td>
            <td class="hc-datagrid__cell" id="c-status" data-editable data-col="status" data-value="open">Open</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

describe('installDatagrid — inline editing', () => {
  it('Enter starts editing a text cell; Enter commits and emits hc:datagridedit', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    press(cell, 'Enter');
    const input = cell.querySelector('input');
    expect(input).toBeTruthy();
    expect(cell.getAttribute('data-editing')).toBe('');

    input.value = 'Grace';
    const onEdit = vi.fn();
    $('grid').addEventListener('hc:datagridedit', (e) => onEdit(e.detail));
    press(input, 'Enter');

    expect(cell.hasAttribute('data-editing')).toBe(false);
    expect(cell.textContent).toBe('Grace');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({
      value: 'Grace',
      oldValue: 'Ada',
      col: 'name',
    });
  });

  it('editing a select commits the chosen value and label', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-status');
    cell.focus();
    press(cell, 'F2');
    const select = cell.querySelector('select');
    expect(select.value).toBe('open'); // seeded from the cell
    select.value = 'done';
    press(select, 'Enter');
    expect(cell.textContent).toBe('Done');
    expect(cell.dataset.value).toBe('done');
  });

  it('Escape cancels and restores the original cell', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    press(cell, 'Enter');
    cell.querySelector('input').value = 'changed';
    press(cell.querySelector('input'), 'Escape');
    expect(cell.hasAttribute('data-editing')).toBe(false);
    expect(cell.textContent).toBe('Ada');
  });

  it('typing a character starts editing and seeds the value', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    press(cell, 'Z');
    const input = cell.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Z');
  });
});

const FIXTURE_MULTI = `
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell" rowspan="2" scope="col">
              <input type="checkbox" class="hc-checkbox" id="select-all" aria-label="Select all">
            </th>
            <th class="hc-datagrid__headcell" scope="col">Code</th>
            <th class="hc-datagrid__headcell" scope="col">Name</th>
          </tr>
          <tr>
            <th class="hc-datagrid__headcell" scope="col">Qty</th>
            <th class="hc-datagrid__headcell" scope="col">Price</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__record" id="rec-1">
          <tr class="hc-datagrid__row" id="r1a">
            <td class="hc-datagrid__cell" rowspan="2"><input type="checkbox" class="hc-checkbox" aria-label="Select record 1"></td>
            <td class="hc-datagrid__cell" id="c-r1-code">D0006</td>
            <td class="hc-datagrid__cell">Ham</td>
          </tr>
          <tr class="hc-datagrid__row" id="r1b">
            <td class="hc-datagrid__cell" id="c-r1-qty">12</td>
            <td class="hc-datagrid__cell">14000</td>
          </tr>
        </tbody>
        <tbody class="hc-datagrid__record" id="rec-2">
          <tr class="hc-datagrid__row" id="r2a">
            <td class="hc-datagrid__cell" rowspan="2"><input type="checkbox" class="hc-checkbox" aria-label="Select record 2"></td>
            <td class="hc-datagrid__cell" id="c-r2-code">D0004</td>
            <td class="hc-datagrid__cell">Rice</td>
          </tr>
          <tr class="hc-datagrid__row" id="r2b">
            <td class="hc-datagrid__cell">47</td>
            <td class="hc-datagrid__cell">17250</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

describe('installDatagrid — multi-row records', () => {
  it('a record checkbox selects all of the record’s sub-rows and counts by record', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    const onSel = vi.fn();
    $('grid').addEventListener('hc:datagridselectionchange', (e) => onSel(e.detail));

    const cb = $('rec-1').querySelector('input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    expect($('r1a').getAttribute('aria-selected')).toBe('true');
    expect($('r1b').getAttribute('aria-selected')).toBe('true');
    expect($('rec-1').hasAttribute('data-selected')).toBe(true);
    expect(onSel.mock.calls.at(-1)[0]).toMatchObject({ selected: 1, total: 2 });
  });

  it('the select-all checkbox selects every record', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    const all = $('select-all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('rec-1').hasAttribute('data-selected')).toBe(true);
    expect($('rec-2').hasAttribute('data-selected')).toBe(true);
  });

  it('Space on a cell selects that cell’s record', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    $('c-r2-code').focus();
    press($('c-r2-code'), ' ');
    expect($('rec-2').hasAttribute('data-selected')).toBe(true);
    expect($('rec-2').querySelector('input[type="checkbox"]').checked).toBe(true);
  });

  it('arrow keys navigate across a record’s sub-rows and sets the current record', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    $('c-r1-code').focus();
    expect($('rec-1').hasAttribute('data-current')).toBe(true);
    press($('c-r1-code'), 'ArrowDown'); // into the second sub-row
    expect($('r1b').querySelector('[data-active]')).toBeTruthy();
    press($('r1b').querySelector('[data-active]'), 'ArrowDown'); // into record 2
    expect($('rec-2').hasAttribute('data-current')).toBe(true);
    expect($('rec-1').hasAttribute('data-current')).toBe(false);
  });
});
