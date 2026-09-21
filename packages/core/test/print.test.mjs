import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installPrint } from '../src/js/print.js';

let uninstall = () => {};
let print;

beforeEach(() => {
  document.body.innerHTML = '';
  print = vi.spyOn(window, 'print').mockImplementation(() => {});
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  print.mockRestore();
  document.body.innerHTML = '';
});

describe('installPrint', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    const u1 = installPrint();
    const u2 = installPrint();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('a click on [data-hc-print] calls window.print()', () => {
    document.body.innerHTML = '<button type="button" data-hc-print>Print</button>';
    uninstall = installPrint();
    document.querySelector('button').click();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('a click inside the button (an icon) counts too', () => {
    document.body.innerHTML = '<button type="button" data-hc-print><span class="hc-icon">⎙</span></button>';
    uninstall = installPrint();
    document.querySelector('span').click();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('works for buttons swapped in after install (root-delegated)', () => {
    uninstall = installPrint();
    document.body.innerHTML = '<button type="button" data-hc-print>Print</button>';
    document.querySelector('button').click();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('a type-less <button> present at install becomes type="button" (no form submit)', () => {
    document.body.innerHTML = '<form><button data-hc-print>Print</button></form>';
    uninstall = installPrint();
    expect(document.querySelector('button').getAttribute('type')).toBe('button');
  });

  it('a disabled button does nothing', () => {
    document.body.innerHTML = '<button type="button" data-hc-print aria-disabled="true">Print</button>';
    uninstall = installPrint();
    document.querySelector('button').click();
    expect(print).not.toHaveBeenCalled();
  });

  it('other clicks are ignored', () => {
    document.body.innerHTML = '<button type="button">Save</button>';
    uninstall = installPrint();
    document.querySelector('button').click();
    expect(print).not.toHaveBeenCalled();
  });

  it('the uninstaller detaches', () => {
    document.body.innerHTML = '<button type="button" data-hc-print>Print</button>';
    const u = installPrint();
    u();
    document.querySelector('button').click();
    expect(print).not.toHaveBeenCalled();
  });
});
