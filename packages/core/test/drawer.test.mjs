import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installDrawer } from '../src/js/drawer.js';

let uninstall = () => {};

const SIMPLE = `
  <dialog id="dr" class="hc-drawer" data-side="right">
    <header class="hc-drawer__header" id="dr-header">
      <h2 class="hc-drawer__title">Settings</h2>
      <form method="dialog">
        <button id="dr-x" type="submit" aria-label="Close">×</button>
      </form>
    </header>
    <div class="hc-drawer__body" id="dr-body">Body</div>
  </dialog>
`;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installDrawer', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installDrawer();
    const u2 = installDrawer();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('clicking the dialog itself (backdrop) closes it', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installDrawer();
    const dialog = document.getElementById('dr');
    const closed = vi.spyOn(dialog, 'close');

    // Backdrop click: event.target is the dialog itself.
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('clicking on drawer content does NOT close', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installDrawer();
    const dialog = document.getElementById('dr');
    const closed = vi.spyOn(dialog, 'close');

    const body = document.getElementById('dr-body');
    body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('uninstall detaches the backdrop click listener', () => {
    document.body.innerHTML = SIMPLE;
    const u = installDrawer();
    const dialog = document.getElementById('dr');
    const closed = vi.spyOn(dialog, 'close');

    u();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(closed).not.toHaveBeenCalled();
    uninstall = () => {};
  });

  it('picks up .hc-drawer added after install (MutationObserver)', async () => {
    uninstall = installDrawer();
    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    document.body.appendChild(wrap.firstElementChild);

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    const dialog = document.getElementById('dr');
    const closed = vi.spyOn(dialog, 'close');
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
