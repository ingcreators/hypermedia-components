import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installDatagrid } from '../src/js/datagrid.js';
import { installDatagridActions } from '../src/js/datagrid-actions.js';
import { setMessages } from '../src/js/i18n.js';

let uninstall = () => {};
let uninstallGrid = () => {};
let restoreMessages = () => {};

const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (id) => document.getElementById(id);

const FIXTURE = `
  <div class="hc-toolbar" role="toolbar" aria-label="Bulk actions" id="bar"
       data-hc-datagrid-actions="#grid" hidden>
    <span data-hc-datagrid-count id="count"></span>
    <button class="hc-button" type="button" id="archive">Archive</button>
  </div>
  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell">
              <input type="checkbox" class="hc-checkbox" id="select-all" aria-label="Select all">
            </th>
            <th class="hc-datagrid__headcell" scope="col">ID</th>
          </tr>
        </thead>
        <tbody class="hc-datagrid__body" id="rows">
          <tr class="hc-datagrid__row" id="row-1">
            <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" id="cb-1" name="ids" value="1" aria-label="Select row 1"></td>
            <td class="hc-datagrid__cell">1</td>
          </tr>
          <tr class="hc-datagrid__row" id="row-2">
            <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" id="cb-2" name="ids" value="2" aria-label="Select row 2"></td>
            <td class="hc-datagrid__cell">2</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

function check(cb, on = true) {
  cb.checked = on;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  uninstallGrid();
  uninstallGrid = () => {};
  restoreMessages();
  restoreMessages = () => {};
});

describe('installDatagridActions', () => {
  it('is idempotent', () => {
    uninstall = installDatagridActions();
    expect(installDatagridActions()).toBe(uninstall);
  });

  it('initializes from the grid state at install (pre-selected rows)', () => {
    document.body.innerHTML = FIXTURE;
    $('row-1').setAttribute('aria-selected', 'true');
    uninstall = installDatagridActions();
    expect($('bar').hasAttribute('hidden')).toBe(false);
    expect($('count').textContent).toBe('1 selected');
  });

  it('stays hidden while nothing is selected', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagridActions();
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('0 selected');
  });

  it('gives the count element a default role="status"', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagridActions();
    expect($('count').getAttribute('role')).toBe('status');
  });

  it('shows the bar and updates the count as rows are selected', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagridActions();
    uninstallGrid = installDatagrid();

    check($('cb-1'));
    expect($('bar').hasAttribute('hidden')).toBe(false);
    expect($('count').textContent).toBe('1 selected');

    check($('select-all'));
    expect($('count').textContent).toBe('2 selected');

    check($('select-all'), false);
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('0 selected');
  });

  it('renders the count through the i18n catalog ({selected} and {total})', () => {
    document.body.innerHTML = FIXTURE;
    restoreMessages = setMessages({ 'datagrid.selected': '{total} 件中 {selected} 件を選択中' });
    uninstall = installDatagridActions();
    uninstallGrid = installDatagrid();
    check($('cb-2'));
    expect($('count').textContent).toBe('2 件中 1 件を選択中');
  });

  it('clears the bar after an htmx-style row swap (grid re-emits)', async () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installDatagridActions();
    uninstallGrid = installDatagrid();
    check($('cb-1'));
    expect($('bar').hasAttribute('hidden')).toBe(false);

    $('rows').innerHTML = `
      <tr class="hc-datagrid__row" id="row-3">
        <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" name="ids" value="3" aria-label="Select row 3"></td>
        <td class="hc-datagrid__cell">3</td>
      </tr>`;
    await tick();
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('0 selected');
  });

  it('initializes a bar added after install (MutationObserver)', async () => {
    document.body.innerHTML = FIXTURE;
    $('row-1').setAttribute('aria-selected', 'true');
    $('bar').remove();
    uninstall = installDatagridActions();

    document.body.insertAdjacentHTML(
      'afterbegin',
      `<div id="late-bar" data-hc-datagrid-actions="#grid" hidden>
         <span data-hc-datagrid-count id="late-count"></span>
       </div>`,
    );
    await tick();
    expect($('late-bar').hasAttribute('hidden')).toBe(false);
    expect($('late-count').textContent).toBe('1 selected');
  });

  it('ignores bars whose selector resolves to nothing (or is invalid)', () => {
    document.body.innerHTML = FIXTURE;
    $('bar').setAttribute('data-hc-datagrid-actions', '#no-such-grid');
    uninstall = installDatagridActions();
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('');

    uninstall();
    $('bar').setAttribute('data-hc-datagrid-actions', ':::not-a-selector');
    expect(() => {
      uninstall = installDatagridActions();
    }).not.toThrow();
    expect($('count').textContent).toBe('');
  });

  it('uninstall stops updates', () => {
    document.body.innerHTML = FIXTURE;
    const u = installDatagridActions();
    uninstallGrid = installDatagrid();
    u();
    check($('cb-1'));
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('0 selected'); // frozen at install-time state
  });

  it('counts records (not rows) in multi-row record grids', () => {
    document.body.innerHTML = `
      <div id="bar" data-hc-datagrid-actions="#grid" hidden>
        <span data-hc-datagrid-count id="count"></span>
      </div>
      <div class="hc-datagrid" id="grid">
        <div class="hc-datagrid__scroll">
          <table class="hc-datagrid__table">
            <tbody class="hc-datagrid__record" data-selected>
              <tr class="hc-datagrid__row" aria-selected="true"><td class="hc-datagrid__cell">a</td></tr>
              <tr class="hc-datagrid__row" aria-selected="true"><td class="hc-datagrid__cell">b</td></tr>
            </tbody>
            <tbody class="hc-datagrid__record">
              <tr class="hc-datagrid__row"><td class="hc-datagrid__cell">c</td></tr>
              <tr class="hc-datagrid__row"><td class="hc-datagrid__cell">d</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    uninstall = installDatagridActions();
    expect($('count').textContent).toBe('1 selected');
    expect($('bar').hasAttribute('hidden')).toBe(false);
  });

  it('does not react to a different grid’s selection events', () => {
    document.body.innerHTML = `${FIXTURE}
      <div class="hc-datagrid" id="other-grid"><div class="hc-datagrid__scroll">
        <table class="hc-datagrid__table"><tbody class="hc-datagrid__body">
          <tr class="hc-datagrid__row" id="other-row">
            <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" id="other-cb" aria-label="Select"></td>
          </tr>
        </tbody></table>
      </div></div>`;
    uninstall = installDatagridActions();
    uninstallGrid = installDatagrid();
    check($('other-cb'));
    expect($('bar').hasAttribute('hidden')).toBe(true);
    expect($('count').textContent).toBe('0 selected');
  });
});
