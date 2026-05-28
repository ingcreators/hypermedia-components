import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installConfirm } from '../src/js/confirm.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function placeButton(extraAttrs = {}) {
  const btn = document.createElement('button');
  btn.className = 'hc-button';
  btn.setAttribute('data-hc-confirm', 'Delete this item?');
  btn.textContent = 'Delete';
  for (const [k, v] of Object.entries(extraAttrs)) btn.setAttribute(k, v);
  document.body.appendChild(btn);
  return btn;
}

function dispatchClick(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('installConfirm', () => {
  it('lazily creates a shared dialog on first click', () => {
    uninstall = installConfirm();
    expect(document.querySelector('.hc-confirm-dialog')).toBeNull();

    const btn = placeButton();
    dispatchClick(btn);

    const dialog = document.querySelector('.hc-confirm-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('#hc-confirm-message').textContent).toBe('Delete this item?');
  });

  it('reuses the same dialog across multiple clicks', () => {
    uninstall = installConfirm();
    const a = placeButton({ 'data-hc-confirm': 'First?' });
    const b = placeButton({ 'data-hc-confirm': 'Second?' });

    dispatchClick(a);
    const first = document.querySelector('.hc-confirm-dialog');
    first.close('cancel');

    dispatchClick(b);
    const second = document.querySelector('.hc-confirm-dialog');
    expect(second).toBe(first);
    expect(first.querySelector('#hc-confirm-message').textContent).toBe('Second?');
  });

  it('dispatches a bubbling "confirmed" event on the source when accepted', () => {
    uninstall = installConfirm();
    const btn = placeButton();

    let received = null;
    document.body.addEventListener('confirmed', (e) => { received = e; });

    dispatchClick(btn);
    document.querySelector('[data-hc-confirm-ok]').click();

    expect(received).not.toBeNull();
    expect(received.target).toBe(btn);
    expect(received.bubbles).toBe(true);
  });

  it('does not dispatch "confirmed" when cancelled', () => {
    uninstall = installConfirm();
    const btn = placeButton();

    const spy = vi.fn();
    btn.addEventListener('confirmed', spy);

    dispatchClick(btn);
    document.querySelector('[data-hc-confirm-cancel]').click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks bubble-phase listeners on the source element', () => {
    uninstall = installConfirm();
    const btn = placeButton();

    const subsequent = vi.fn();
    btn.addEventListener('click', subsequent);

    dispatchClick(btn);

    // The capture-phase handler stops propagation, so a bubble-phase
    // listener attached after the source must not see the click.
    expect(subsequent).not.toHaveBeenCalled();
  });

  it('uses data-hc-confirm-variant when present, falling back to data-variant, then "primary"', () => {
    uninstall = installConfirm();

    const explicit = placeButton({ 'data-hc-confirm-variant': 'success' });
    dispatchClick(explicit);
    let okBtn = document.querySelector('[data-hc-confirm-ok]');
    expect(okBtn.getAttribute('data-variant')).toBe('success');
    document.querySelector('.hc-confirm-dialog').close('cancel');
    explicit.remove();

    const danger = placeButton({ 'data-variant': 'danger' });
    dispatchClick(danger);
    okBtn = document.querySelector('[data-hc-confirm-ok]');
    expect(okBtn.getAttribute('data-variant')).toBe('danger');
    document.querySelector('.hc-confirm-dialog').close('cancel');
    danger.remove();

    const plain = placeButton();
    dispatchClick(plain);
    okBtn = document.querySelector('[data-hc-confirm-ok]');
    expect(okBtn.getAttribute('data-variant')).toBe('primary');
  });

  it('uses custom title and labels when provided', () => {
    uninstall = installConfirm();
    const btn = placeButton({
      'data-hc-confirm-title': 'Delete invoice',
      'data-hc-confirm-label': 'Delete',
      'data-hc-cancel-label': 'Keep',
    });
    dispatchClick(btn);

    expect(document.querySelector('#hc-confirm-title').textContent).toBe('Delete invoice');
    expect(document.querySelector('[data-hc-confirm-ok]').textContent).toBe('Delete');
    expect(document.querySelector('[data-hc-confirm-cancel]').textContent).toBe('Keep');
  });

  it('is idempotent — calling installConfirm twice returns the same uninstaller', () => {
    const off1 = installConfirm();
    const off2 = installConfirm();
    uninstall = off1;

    expect(off1).toBe(off2);

    const btn = placeButton();
    const spy = vi.fn();
    btn.addEventListener('confirmed', spy);

    dispatchClick(btn);
    document.querySelector('[data-hc-confirm-ok]').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('triggers on a descendant click via event delegation', () => {
    uninstall = installConfirm();
    const btn = placeButton();
    const icon = document.createElement('span');
    icon.textContent = 'x';
    btn.appendChild(icon);

    const spy = vi.fn();
    btn.addEventListener('confirmed', spy);

    dispatchClick(icon);
    document.querySelector('[data-hc-confirm-ok]').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uninstall removes the listener and the shared dialog', () => {
    const off = installConfirm();
    const btn = placeButton();

    dispatchClick(btn);
    expect(document.querySelector('.hc-confirm-dialog')).not.toBeNull();

    off();

    expect(document.querySelector('.hc-confirm-dialog')).toBeNull();

    // After uninstall, clicks are no longer intercepted.
    const spy = vi.fn();
    btn.addEventListener('click', spy);
    dispatchClick(btn);
    expect(spy).toHaveBeenCalled();
  });
});
