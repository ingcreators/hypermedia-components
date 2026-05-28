import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installRemoteDialog } from '../src/js/remote-dialog.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = `
    <div id="root" data-hc-remote-dialog-root></div>
  `;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function fireAfterSwap(target) {
  target.dispatchEvent(new CustomEvent('htmx:afterSwap', {
    bubbles: true,
    detail: { target },
  }));
}

function injectDialog(host, html = '<dialog class="hc-dialog"><p>hi</p></dialog>') {
  host.innerHTML = html;
}

describe('installRemoteDialog', () => {
  it('opens the first dialog in the swapped root after htmx:afterSwap', () => {
    uninstall = installRemoteDialog();
    const root = document.getElementById('root');
    injectDialog(root);

    fireAfterSwap(root);

    const dialog = root.querySelector('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('only triggers when the swap target carries data-hc-remote-dialog-root', () => {
    document.body.innerHTML = `<div id="other"><dialog><p>x</p></dialog></div>`;
    uninstall = installRemoteDialog();
    const other = document.getElementById('other');
    fireAfterSwap(other);
    expect(other.querySelector('dialog').hasAttribute('open')).toBe(false);
  });

  it('does nothing if the root has no dialog yet', () => {
    uninstall = installRemoteDialog();
    expect(() => fireAfterSwap(document.getElementById('root'))).not.toThrow();
  });

  it('skips opening when the dialog is already open', () => {
    uninstall = installRemoteDialog();
    const root = document.getElementById('root');
    injectDialog(root);
    const dialog = root.querySelector('dialog');
    const spy = vi.spyOn(dialog, 'showModal');

    // Mark as already open.
    dialog.setAttribute('open', '');
    Object.defineProperty(dialog, 'open', { configurable: true, value: true });

    fireAfterSwap(root);
    expect(spy).not.toHaveBeenCalled();
  });

  it('idempotent: repeated installs return the same uninstaller', () => {
    const off1 = installRemoteDialog();
    const off2 = installRemoteDialog();
    uninstall = off1;
    expect(off1).toBe(off2);
  });

  it('uninstall stops responding to events', () => {
    const off = installRemoteDialog();
    off();
    const root = document.getElementById('root');
    injectDialog(root);
    fireAfterSwap(root);
    expect(root.querySelector('dialog').hasAttribute('open')).toBe(false);
  });
});
