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

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

  it('re-syncs select-all and re-emits the count after a row swap', async () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const rowCb = $('row-1').querySelector('input[type="checkbox"]');
    rowCb.checked = true;
    rowCb.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('select-all').indeterminate).toBe(true);

    const onSel = vi.fn();
    $('grid').addEventListener('hc:datagridselectionchange', (e) => onSel(e.detail));
    document.querySelector('.hc-datagrid__body').innerHTML = `
      <tr class="hc-datagrid__row" id="row-3">
        <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" aria-label="Select row 3"></td>
        <th class="hc-datagrid__cell" scope="row">3</th>
        <td class="hc-datagrid__cell">a3</td>
        <td class="hc-datagrid__cell">b3</td>
      </tr>`;
    await new Promise((r) => setTimeout(r, 0)); // let the tbody observer run
    expect(onSel.mock.calls.at(-1)[0]).toMatchObject({ selected: 0, total: 1 });
    expect($('select-all').checked).toBe(false);
    expect($('select-all').indeterminate).toBe(false);
  });

  it('adopts server-rendered checked rows after a swap', async () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    document.querySelector('.hc-datagrid__body').innerHTML = `
      <tr class="hc-datagrid__row" id="row-3">
        <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" checked aria-label="Select row 3"></td>
        <th class="hc-datagrid__cell" scope="row">3</th>
        <td class="hc-datagrid__cell">a3</td>
        <td class="hc-datagrid__cell">b3</td>
      </tr>
      <tr class="hc-datagrid__row" id="row-4">
        <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" aria-label="Select row 4"></td>
        <th class="hc-datagrid__cell" scope="row">4</th>
        <td class="hc-datagrid__cell">a4</td>
        <td class="hc-datagrid__cell">b4</td>
      </tr>`;
    await new Promise((r) => setTimeout(r, 0)); // let the tbody observer run
    expect($('row-3').getAttribute('aria-selected')).toBe('true');
    expect($('row-3').hasAttribute('data-selected')).toBe(true);
    expect($('row-4').getAttribute('aria-selected')).toBe('false');
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

  it('an IME keydown (isComposing) opens the editor unseeded, without preventDefault', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);
    const input = cell.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Ada'); // the old label — never the raw latin key
    expect(event.defaultPrevented).toBe(false); // the composition survives
  });

  it('an IME keydown (key "Process") opens the editor unseeded', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    press(cell, 'Process');
    const input = cell.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Ada');
  });

  it('compositionstart on the active cell opens the editor', () => {
    document.body.innerHTML = FIXTURE_EDIT;
    uninstall = installDatagrid();
    const cell = $('c-name');
    cell.focus();
    cell.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const input = cell.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Ada');
  });

  it('compositionstart on a non-editable cell does nothing', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const cell = $('c-1-a');
    cell.focus();
    cell.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(cell.querySelector('input')).toBeNull();
    expect(cell.hasAttribute('data-editing')).toBe(false);
  });
});

const FIXTURE_FOOT = `
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell" data-frozen scope="col">Item</th>
            <th class="hc-datagrid__headcell" scope="col">Q1</th>
            <th class="hc-datagrid__headcell" data-frozen-end data-frozen-end-edge scope="col" id="h-act">Actions</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__body">
          <tr class="hc-datagrid__row" id="fr-1">
            <td class="hc-datagrid__cell" data-frozen id="c-item-1">A</td>
            <td class="hc-datagrid__cell" id="c-q1-1">1</td>
            <td class="hc-datagrid__cell" data-frozen-end data-frozen-end-edge id="c-act-1"><button type="button" class="hc-button">Edit</button></td>
          </tr>
        </tbody>
        <tfoot class="hc-datagrid__foot" id="foot">
          <tr id="foot-row">
            <td class="hc-datagrid__cell" data-frozen id="foot-label">Total</td>
            <td class="hc-datagrid__cell" id="foot-q1">1</td>
            <td class="hc-datagrid__cell" data-frozen-end></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
`;

describe('installDatagrid — sticky footer & frozen-end columns', () => {
  it('footer rows get grid roles without joining the navigation matrix', () => {
    document.body.innerHTML = FIXTURE_FOOT;
    uninstall = installDatagrid();
    expect($('foot-row').getAttribute('role')).toBe('row');
    expect($('foot-q1').getAttribute('role')).toBe('gridcell');
    // Not navigable: from the only body row, ArrowDown stays in the body.
    const cell = $('c-q1-1');
    cell.focus();
    press(cell, 'ArrowDown');
    expect($('foot-q1').hasAttribute('data-active')).toBe(false);
    expect(cell.getAttribute('data-active')).toBe('');
  });

  it('measures frozen-end offsets, the footer level height, and scroll padding', () => {
    document.body.innerHTML = FIXTURE_FOOT;
    uninstall = installDatagrid();
    expect($('c-act-1').style.getPropertyValue('--hc-datagrid-right')).toBe('0px');
    expect($('h-act').style.getPropertyValue('--hc-datagrid-right')).toBe('0px');
    expect($('grid').style.getPropertyValue('--hc-datagrid-foot-1-h')).toBe('0px');
    const scroll = document.querySelector('.hc-datagrid__scroll');
    expect(scroll.style.scrollPaddingBottom).toBe('0px');
    expect(scroll.style.scrollPaddingRight).toBe('0px');
  });
});

describe('installDatagrid — range selection & copy', () => {
  it('Shift+Arrow paints a rectangular data-in-range from the anchor', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const start = $('c-1-a');
    start.focus();
    press(start, 'ArrowRight', { shiftKey: true });
    press(document.activeElement, 'ArrowDown', { shiftKey: true });
    const inRange = [...document.querySelectorAll('[data-in-range]')].map((c) => c.id);
    expect(inRange.sort()).toEqual(['c-1-a', 'c-1-b', 'c-2-a', 'c-2-b']);
  });

  it('a plain arrow or Escape clears the range', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const start = $('c-1-a');
    start.focus();
    press(start, 'ArrowRight', { shiftKey: true });
    expect(document.querySelectorAll('[data-in-range]').length).toBe(2);
    press(document.activeElement, 'ArrowLeft');
    expect(document.querySelectorAll('[data-in-range]').length).toBe(0);

    press(document.activeElement, 'ArrowRight', { shiftKey: true });
    expect(document.querySelectorAll('[data-in-range]').length).toBe(2);
    press(document.activeElement, 'Escape');
    expect(document.querySelectorAll('[data-in-range]').length).toBe(0);
  });

  it('Ctrl+C copies the range as TSV via a cancelable hc:datagridcopy', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const onCopy = vi.fn();
    $('grid').addEventListener('hc:datagridcopy', (e) => onCopy(e.detail));
    const start = $('c-1-a');
    start.focus();
    press(start, 'ArrowRight', { shiftKey: true });
    press(document.activeElement, 'ArrowDown', { shiftKey: true });
    press(document.activeElement, 'c', { ctrlKey: true });
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy.mock.calls[0][0]).toMatchObject({
      text: 'a1\tb1\na2\tb2',
      rows: 2,
      cols: 2,
    });
  });

  it('Ctrl+C without a range copies the active cell alone', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const onCopy = vi.fn();
    $('grid').addEventListener('hc:datagridcopy', (e) => onCopy(e.detail));
    const cell = $('c-2-b');
    cell.focus();
    press(cell, 'c', { ctrlKey: true });
    expect(onCopy.mock.calls[0][0]).toMatchObject({ text: 'b2', rows: 1, cols: 1 });
  });

  it('a spanning cell contributes its text once, at the first covered slot', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    const onCopy = vi.fn();
    $('grid').addEventListener('hc:datagridcopy', (e) => onCopy(e.detail));
    const lead = $('c-r1-lead'); // rowspan="2"
    lead.focus();
    press(lead, 'ArrowRight', { shiftKey: true });
    press(document.activeElement, 'ArrowDown', { shiftKey: true });
    press(document.activeElement, 'c', { ctrlKey: true });
    // lead cell text is empty (checkbox only); its second slot stays empty
    expect(onCopy.mock.calls[0][0].text).toBe('\tD0006\n\t12');
  });

  it('Shift+Click extends the range to the clicked cell', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const start = $('c-1-a');
    start.focus();
    $('c-2-b').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true }),
    );
    const inRange = [...document.querySelectorAll('[data-in-range]')].map((c) => c.id);
    expect(inRange.sort()).toEqual(['c-1-a', 'c-1-b', 'c-2-a', 'c-2-b']);
  });

  it('Ctrl+A selects every row through the select-all path', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagrid();
    const cell = $('c-1-a');
    cell.focus();
    press(cell, 'a', { ctrlKey: true });
    expect($('select-all').checked).toBe(true);
    expect($('row-1').getAttribute('aria-selected')).toBe('true');
    expect($('row-2').getAttribute('aria-selected')).toBe('true');
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
            <td class="hc-datagrid__cell" id="c-r1-lead" rowspan="2"><input type="checkbox" class="hc-checkbox" aria-label="Select record 1"></td>
            <td class="hc-datagrid__cell" id="c-r1-code">D0006</td>
            <td class="hc-datagrid__cell" id="c-r1-name">Ham</td>
          </tr>
          <tr class="hc-datagrid__row" id="r1b">
            <td class="hc-datagrid__cell" id="c-r1-qty">12</td>
            <td class="hc-datagrid__cell" id="c-r1-price">14000</td>
          </tr>
        </tbody>
        <tbody class="hc-datagrid__record" id="rec-2">
          <tr class="hc-datagrid__row" id="r2a">
            <td class="hc-datagrid__cell" id="c-r2-lead" rowspan="2"><input type="checkbox" class="hc-checkbox" aria-label="Select record 2"></td>
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

  it('↓ keeps the visual column across sub-rows (Code → Qty, not Price)', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    $('c-r1-code').focus();
    press($('c-r1-code'), 'ArrowDown');
    expect($('c-r1-qty').getAttribute('data-active')).toBe('');
  });

  it('↓ then ↑ round-trips in the last column', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    $('c-r1-name').focus();
    press($('c-r1-name'), 'ArrowDown');
    expect($('c-r1-price').getAttribute('data-active')).toBe('');
    press($('c-r1-price'), 'ArrowUp');
    expect($('c-r1-name').getAttribute('data-active')).toBe('');
  });

  it('the rowspan lead cell is one stop: ← reaches it from a sub-row, ↓ leaves to the next record’s lead', () => {
    document.body.innerHTML = FIXTURE_MULTI;
    uninstall = installDatagrid();
    $('c-r1-qty').focus();
    press($('c-r1-qty'), 'ArrowLeft'); // into the lead cell spanning both sub-rows
    expect($('c-r1-lead').getAttribute('data-active')).toBe('');
    press($('c-r1-lead'), 'ArrowDown'); // skips the lead cell's own second slot
    expect($('c-r2-lead').getAttribute('data-active')).toBe('');
    press($('c-r2-lead'), 'ArrowRight'); // back out of the span keeps the entry row
    expect($('c-r2-code').getAttribute('data-active')).toBe('');
  });
});

const FIXTURE_DETAIL = `
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head"><tr>
          <th class="hc-datagrid__headcell" scope="col"></th>
          <th class="hc-datagrid__headcell" scope="col">Category</th>
        </tr></thead>
        <tbody class="hc-datagrid__record" id="rec-1">
          <tr class="hc-datagrid__row" id="main-1">
            <td class="hc-datagrid__cell" id="toggle-cell">
              <button class="hc-datagrid__toggle" data-hc-datagrid-toggle type="button" aria-label="Toggle"></button>
            </td>
            <td class="hc-datagrid__cell">Beverages</td>
          </tr>
          <tr class="hc-datagrid__detail-row" id="detail-1">
            <td class="hc-datagrid__detail" colspan="2"><p>Soft drinks, coffees…</p></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

describe('installDatagrid — expandable row detail', () => {
  const btn = () => $('toggle-cell').querySelector('button');

  it('starts collapsed with ARIA wired', () => {
    document.body.innerHTML = FIXTURE_DETAIL;
    uninstall = installDatagrid();
    expect($('detail-1').hidden).toBe(true);
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    const cellId = $('detail-1').querySelector('.hc-datagrid__detail').id;
    expect(cellId).toMatch(/^hc-datagrid-detail-\d+$/);
    expect(btn().getAttribute('aria-controls')).toBe(cellId);
  });

  it('clicking the toggle expands the detail and emits hc:datagridexpand', () => {
    document.body.innerHTML = FIXTURE_DETAIL;
    uninstall = installDatagrid();
    const onExp = vi.fn();
    $('grid').addEventListener('hc:datagridexpand', onExp);
    click(btn());
    expect($('detail-1').hidden).toBe(false);
    expect($('rec-1').hasAttribute('data-expanded')).toBe(true);
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    expect(onExp).toHaveBeenCalledTimes(1);
  });

  it('clicking again collapses and emits hc:datagridcollapse', () => {
    document.body.innerHTML = FIXTURE_DETAIL;
    uninstall = installDatagrid();
    click(btn()); // expand
    const onCol = vi.fn();
    $('grid').addEventListener('hc:datagridcollapse', onCol);
    click(btn()); // collapse
    expect($('detail-1').hidden).toBe(true);
    expect($('rec-1').hasAttribute('data-expanded')).toBe(false);
    expect(onCol).toHaveBeenCalledTimes(1);
  });

  it('Enter on a cell holding a toggle expands the detail', () => {
    document.body.innerHTML = FIXTURE_DETAIL;
    uninstall = installDatagrid();
    $('toggle-cell').focus();
    press($('toggle-cell'), 'Enter');
    expect($('detail-1').hidden).toBe(false);
  });
});

const FIXTURE_RESIZE = `
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head"><tr>
          <th class="hc-datagrid__headcell" data-resizable data-col="name" scope="col" id="h-name">Name</th>
          <th class="hc-datagrid__headcell" scope="col" id="h-fixed">Fixed</th>
        </tr></thead>
        <tbody class="hc-datagrid__body">
          <tr class="hc-datagrid__row">
            <td class="hc-datagrid__cell" data-col="name" id="c-name">Chai</td>
            <td class="hc-datagrid__cell">x</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

describe('installDatagrid — column resize', () => {
  it('adds a separator handle only to resizable headers', () => {
    document.body.innerHTML = FIXTURE_RESIZE;
    uninstall = installDatagrid();
    const handle = $('h-name').querySelector('.hc-datagrid__resizer');
    expect(handle).toBeTruthy();
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect($('h-fixed').querySelector('.hc-datagrid__resizer')).toBeNull();
  });

  it('arrow keys on the handle set the column width and emit hc:datagridcolumnresize', () => {
    document.body.innerHTML = FIXTURE_RESIZE;
    uninstall = installDatagrid();
    const onResize = vi.fn();
    $('grid').addEventListener('hc:datagridcolumnresize', (e) => onResize(e.detail));
    const handle = $('h-name').querySelector('.hc-datagrid__resizer');
    press(handle, 'ArrowRight');
    // jsdom has no layout (width 0) → clamps to the minimum; header + body
    // cells of the column become fixed-width and clip.
    expect($('h-name').style.inlineSize).toBe('40px');
    expect($('c-name').style.inlineSize).toBe('40px');
    expect($('c-name').hasAttribute('data-resized')).toBe(true);
    expect(onResize).toHaveBeenCalled();
    expect(onResize.mock.calls.at(-1)[0]).toMatchObject({ col: 'name', width: 40 });
  });

  it('does not duplicate handles on repeated install', () => {
    document.body.innerHTML = FIXTURE_RESIZE;
    installDatagrid();
    uninstall = installDatagrid();
    expect($('h-name').querySelectorAll('.hc-datagrid__resizer')).toHaveLength(1);
  });

  it('uninstall removes the handle', () => {
    document.body.innerHTML = FIXTURE_RESIZE;
    const u = installDatagrid();
    u();
    expect($('h-name').querySelector('.hc-datagrid__resizer')).toBeNull();
  });
});

describe('installDatagrid — sortable columns', () => {
  function makeSortable() {
    const heads = document.querySelectorAll(
      '.hc-datagrid__head > tr:nth-child(2) > .hc-datagrid__headcell',
    );
    heads[0].setAttribute('data-sortable', '');
    heads[0].setAttribute('data-col', 'a');
    heads[1].setAttribute('data-sortable', '');
    heads[1].setAttribute('data-col', 'b');
    return heads;
  }

  it('makes a sortable header focusable with aria-sort="none"', () => {
    document.body.innerHTML = FIXTURE;
    const [a] = makeSortable();
    uninstall = installDatagrid();
    expect(a.getAttribute('tabindex')).toBe('0');
    expect(a.getAttribute('aria-sort')).toBe('none');
  });

  it('cycles aria-sort none → ascending → descending → none on click', () => {
    document.body.innerHTML = FIXTURE;
    const [a] = makeSortable();
    uninstall = installDatagrid();
    click(a);
    expect(a.getAttribute('aria-sort')).toBe('ascending');
    click(a);
    expect(a.getAttribute('aria-sort')).toBe('descending');
    click(a);
    expect(a.getAttribute('aria-sort')).toBe('none');
  });

  it('emits hc:datagridsort with the column + direction', () => {
    document.body.innerHTML = FIXTURE;
    const [a] = makeSortable();
    const grid = $('grid');
    const details = [];
    grid.addEventListener('hc:datagridsort', (e) => details.push(e.detail));
    uninstall = installDatagrid();
    click(a); // asc
    click(a); // desc
    click(a); // none
    expect(details).toEqual([
      { col: 'a', direction: 'asc' },
      { col: 'a', direction: 'desc' },
      { col: 'a', direction: null },
    ]);
  });

  it('is single-column — sorting one clears the other', () => {
    document.body.innerHTML = FIXTURE;
    const [a, b] = makeSortable();
    uninstall = installDatagrid();
    click(a);
    expect(a.getAttribute('aria-sort')).toBe('ascending');
    click(b);
    expect(b.getAttribute('aria-sort')).toBe('ascending');
    expect(a.getAttribute('aria-sort')).toBe('none');
  });

  it('Enter on a focused header cycles the sort', () => {
    document.body.innerHTML = FIXTURE;
    const [a] = makeSortable();
    uninstall = installDatagrid();
    press(a, 'Enter');
    expect(a.getAttribute('aria-sort')).toBe('ascending');
  });

  it('clicking the resizer grip does not sort', () => {
    document.body.innerHTML = FIXTURE;
    const [a] = makeSortable();
    a.setAttribute('data-resizable', '');
    uninstall = installDatagrid();
    const resizer = a.querySelector('.hc-datagrid__resizer');
    click(resizer);
    expect(a.getAttribute('aria-sort')).toBe('none');
  });
});

const FIXTURE_LAZY = `
  <div class="hc-datagrid" id="grid">
    <table class="hc-datagrid__table">
      <thead class="hc-datagrid__head"><tr>
        <th class="hc-datagrid__headcell" scope="col"></th>
        <th class="hc-datagrid__headcell" scope="col">Category</th>
      </tr></thead>
      <tbody class="hc-datagrid__record" id="rec-1">
        <tr class="hc-datagrid__row">
          <td class="hc-datagrid__cell">
            <button class="hc-datagrid__toggle" data-hc-datagrid-toggle type="button" aria-label="Toggle"></button>
          </td>
          <td class="hc-datagrid__cell">Beverages</td>
        </tr>
        <tr class="hc-datagrid__detail-row" id="detail-1">
          <td class="hc-datagrid__detail" id="lazy-cell" data-lazy colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>`;

describe('installDatagrid — lazy row detail', () => {
  const btn = () => document.querySelector('[data-hc-datagrid-toggle]');
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('fires hc:datagriddetailload + sets aria-busy on first expand', () => {
    document.body.innerHTML = FIXTURE_LAZY;
    uninstall = installDatagrid();
    const onLoad = vi.fn();
    $('lazy-cell').addEventListener('hc:datagriddetailload', onLoad);
    click(btn());
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect($('lazy-cell').getAttribute('aria-busy')).toBe('true');
    expect($('lazy-cell').dataset.loaded).toBe('');
  });

  it('clears aria-busy once content arrives', async () => {
    document.body.innerHTML = FIXTURE_LAZY;
    uninstall = installDatagrid();
    click(btn());
    expect($('lazy-cell').getAttribute('aria-busy')).toBe('true');
    $('lazy-cell').innerHTML = '<p>Loaded content</p>'; // simulate the htmx swap
    await tick(); // let the MutationObserver run
    expect($('lazy-cell').hasAttribute('aria-busy')).toBe(false);
  });

  it('does not reload on subsequent expands', () => {
    document.body.innerHTML = FIXTURE_LAZY;
    uninstall = installDatagrid();
    const onLoad = vi.fn();
    $('lazy-cell').addEventListener('hc:datagriddetailload', onLoad);
    click(btn()); // expand → load
    click(btn()); // collapse
    click(btn()); // expand again → no reload
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('a non-lazy detail does not fire the load event', () => {
    document.body.innerHTML = FIXTURE_LAZY.replace(' data-lazy', '');
    uninstall = installDatagrid();
    const onLoad = vi.fn();
    $('lazy-cell').addEventListener('hc:datagriddetailload', onLoad);
    click(btn());
    expect(onLoad).not.toHaveBeenCalled();
    expect($('lazy-cell').hasAttribute('aria-busy')).toBe(false);
  });
});
