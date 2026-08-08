import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './dom-setup.mjs';
import { installSessionExpiry } from '../src/js/session-expiry.js';

let uninstall = () => {};
let ajax;

beforeEach(() => {
  document.body.innerHTML = `
    <button id="action">Approve</button>
    <div id="error-dialog" data-hc-remote-dialog-root data-hc-session-expiry></div>
  `;
  ajax = vi.fn();
  window.htmx = { ajax };
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  delete window.htmx;
});

function fire401(elt, { verb = 'post', path = '/approve', parameters } = {}) {
  document.body.dispatchEvent(
    new CustomEvent('htmx:beforeSwap', {
      bubbles: true,
      detail: { xhr: { status: 401 }, requestConfig: { elt, verb, path, parameters } },
    }),
  );
}

function renew() {
  document.body.dispatchEvent(
    new CustomEvent('hc:sessionrenewed', { bubbles: true }),
  );
}

describe('installSessionExpiry', () => {
  it('replays the interrupted request after renewal', () => {
    uninstall = installSessionExpiry();
    const elt = document.getElementById('action');
    fire401(elt);
    renew();
    expect(ajax).toHaveBeenCalledWith('post', '/approve', {
      source: elt,
      values: undefined,
    });
    // The slot is one-shot.
    renew();
    expect(ajax).toHaveBeenCalledOnce();
  });

  it('converts FormData parameters into plain values', () => {
    uninstall = installSessionExpiry();
    const elt = document.getElementById('action');
    const parameters = new FormData();
    parameters.append('id', '42');
    parameters.append('state', 'approved');
    fire401(elt, { parameters });
    renew();
    expect(ajax).toHaveBeenCalledWith('post', '/approve', {
      source: elt,
      values: { id: '42', state: 'approved' },
    });
  });

  it('keeps only the latest interrupted request', () => {
    uninstall = installSessionExpiry();
    const elt = document.getElementById('action');
    fire401(elt, { path: '/first' });
    fire401(elt, { path: '/second' });
    renew();
    expect(ajax).toHaveBeenCalledOnce();
    expect(ajax.mock.calls[0][1]).toBe('/second');
  });

  it('ignores 401s without a session-expiry host', () => {
    document.getElementById('error-dialog').remove();
    uninstall = installSessionExpiry();
    fire401(document.getElementById('action'));
    renew();
    expect(ajax).not.toHaveBeenCalled();
  });

  it('ignores non-401 responses', () => {
    uninstall = installSessionExpiry();
    document.body.dispatchEvent(
      new CustomEvent('htmx:beforeSwap', {
        bubbles: true,
        detail: {
          xhr: { status: 422 },
          requestConfig: { elt: document.getElementById('action'), verb: 'post', path: '/x' },
        },
      }),
    );
    renew();
    expect(ajax).not.toHaveBeenCalled();
  });

  it('closes the host dialog on renewal and skips a vanished source', () => {
    uninstall = installSessionExpiry();
    const host = document.getElementById('error-dialog');
    host.innerHTML = '<dialog open><form>login</form></dialog>';
    const dialog = host.querySelector('dialog');
    const elt = document.getElementById('action');
    fire401(elt);
    elt.remove();
    renew();
    expect(dialog.open).toBe(false);
    expect(ajax).not.toHaveBeenCalled();
  });

  it('is idempotent and uninstalls cleanly', () => {
    uninstall = installSessionExpiry();
    expect(installSessionExpiry()).toBe(uninstall);
    uninstall();
    fire401(document.getElementById('action'));
    renew();
    expect(ajax).not.toHaveBeenCalled();
  });
});
