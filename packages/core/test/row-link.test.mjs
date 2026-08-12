import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installRowLink, rowLinkOf } from '../src/js/row-link.js';

let uninstall = () => {};

const FIXTURE = `
  <div class="hc-datagrid">
    <table class="hc-datagrid__table">
      <tbody class="hc-datagrid__body">
        <tr class="hc-datagrid__row" id="row-4903">
          <td class="hc-datagrid__cell" id="pick">
            <input type="checkbox" id="box" name="ids" value="4903">
          </td>
          <th class="hc-datagrid__cell" id="id-cell" scope="row">
            <a href="/orders/4903" id="link" data-hc-row-link>SO-4903</a>
          </th>
          <td class="hc-datagrid__cell" id="plain">Northwind</td>
          <td class="hc-datagrid__cell" id="acted">
            <button type="button" id="approve">Approve</button>
          </td>
        </tr>
        <tr class="hc-datagrid__row" id="row-4904">
          <td class="hc-datagrid__cell" id="unlinked">no link here</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

function enter(el, init = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  el.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('rowLinkOf', () => {
  it('finds the row’s marked link', () => {
    expect(rowLinkOf(document.getElementById('row-4903'))).toBe(
      document.getElementById('link'),
    );
  });

  it('is null when the row names none', () => {
    // A row with several links must SAY which one is the record;
    // guessing "the first" turns a column reorder into a behavior change.
    expect(rowLinkOf(document.getElementById('row-4904'))).toBe(null);
  });
});

describe('installRowLink', () => {
  it('Enter on a plain cell follows the row’s link', () => {
    uninstall = installRowLink();
    const link = document.getElementById('link');
    const click = vi.fn((e) => e.preventDefault());
    link.addEventListener('click', click);

    const event = enter(document.getElementById('plain'));
    expect(click).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Enter alone when the datagrid already claimed it', () => {
    // The datagrid calls preventDefault() before opening an editor.
    // That IS the coordination: a handled Enter is not ours.
    uninstall = installRowLink();
    const click = vi.fn((e) => e.preventDefault());
    document.getElementById('link').addEventListener('click', click);
    enter(document.getElementById('plain'), { cancelable: true });
    // …now simulate the editor path.
    const claimed = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    claimed.preventDefault();
    document.getElementById('plain').dispatchEvent(claimed);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('a control that owns its Enter keeps it', () => {
    uninstall = installRowLink();
    const click = vi.fn();
    document.getElementById('link').addEventListener('click', click);
    enter(document.getElementById('approve'));
    enter(document.getElementById('box'));
    // …and the link itself: pressing Enter on it is the browser's job.
    enter(document.getElementById('link'));
    expect(click).not.toHaveBeenCalled();
  });

  it('does not open a row while a cell is being edited', () => {
    uninstall = installRowLink();
    const click = vi.fn();
    document.getElementById('link').addEventListener('click', click);
    document.getElementById('plain').setAttribute('data-editing', '');
    enter(document.getElementById('plain'));
    expect(click).not.toHaveBeenCalled();
  });

  it('a modifier means something else — new tab, selection, shortcut', () => {
    uninstall = installRowLink();
    const click = vi.fn();
    document.getElementById('link').addEventListener('click', click);
    for (const mod of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
      enter(document.getElementById('plain'), { [mod]: true });
    }
    expect(click).not.toHaveBeenCalled();
  });

  it('a row with no marked link is left alone', () => {
    uninstall = installRowLink();
    const event = enter(document.getElementById('unlinked'));
    expect(event.defaultPrevented).toBe(false);
  });

  it('is idempotent and uninstalls cleanly', () => {
    const first = installRowLink();
    expect(installRowLink()).toBe(first);
    const click = vi.fn((e) => e.preventDefault());
    document.getElementById('link').addEventListener('click', click);
    enter(document.getElementById('plain'));
    expect(click).toHaveBeenCalledTimes(1); // not doubled

    first();
    uninstall = () => {};
    enter(document.getElementById('plain'));
    expect(click).toHaveBeenCalledTimes(1);
  });
});
