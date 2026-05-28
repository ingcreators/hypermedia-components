import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installCloseDialog } from '../src/js/close-dialog.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = `
    <dialog id="d">
      <form id="f" data-hc-close-dialog-on-success>
        <button id="submit" type="submit">Save</button>
      </form>
    </dialog>
  `;
  document.getElementById('d').showModal();
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function fireAfterRequest(target, { successful = true } = {}) {
  target.dispatchEvent(new CustomEvent('htmx:afterRequest', {
    bubbles: true,
    detail: { successful },
  }));
}

describe('installCloseDialog', () => {
  it('closes the closest dialog after a successful request', () => {
    uninstall = installCloseDialog();
    const dialog = document.getElementById('d');
    expect(dialog.hasAttribute('open')).toBe(true);

    fireAfterRequest(document.getElementById('f'));
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('also matches descendants of the opt-in element', () => {
    uninstall = installCloseDialog();
    fireAfterRequest(document.getElementById('submit'));
    expect(document.getElementById('d').hasAttribute('open')).toBe(false);
  });

  it('keeps the dialog open on failure', () => {
    uninstall = installCloseDialog();
    fireAfterRequest(document.getElementById('f'), { successful: false });
    expect(document.getElementById('d').hasAttribute('open')).toBe(true);
  });

  it('does nothing if the opt-in attribute is absent', () => {
    document.getElementById('f').removeAttribute('data-hc-close-dialog-on-success');
    uninstall = installCloseDialog();
    fireAfterRequest(document.getElementById('f'));
    expect(document.getElementById('d').hasAttribute('open')).toBe(true);
  });

  it('does nothing when no dialog ancestor exists', () => {
    document.body.innerHTML = `<form id="orphan" data-hc-close-dialog-on-success></form>`;
    uninstall = installCloseDialog();
    expect(() => fireAfterRequest(document.getElementById('orphan'))).not.toThrow();
  });

  it('idempotent: repeated installs return the same uninstaller', () => {
    const off1 = installCloseDialog();
    const off2 = installCloseDialog();
    uninstall = off1;
    expect(off1).toBe(off2);
  });

  it('uninstall stops responding to events', () => {
    const off = installCloseDialog();
    off();
    fireAfterRequest(document.getElementById('f'));
    expect(document.getElementById('d').hasAttribute('open')).toBe(true);
  });
});
