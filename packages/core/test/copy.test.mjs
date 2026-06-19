import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCopy } from '../src/js/copy.js';

let uninstall = () => {};
let writeText;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
  vi.useRealTimers();
});

// Flush the writeText() microtask (and any 0ms timers) under fake timers.
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('installCopy', () => {
  it('is idempotent and returns an uninstaller', () => {
    uninstall = installCopy();
    expect(installCopy()).toBe(uninstall);
  });

  it('copies a form control’s value and reflects success on the button', async () => {
    document.body.innerHTML = `
      <input id="src" value="https://app.example.com/x">
      <button id="btn" data-hc-copy="#src">Copy</button>`;
    uninstall = installCopy();

    const copied = vi.fn();
    document.addEventListener('hc:copied', copied);

    document.getElementById('btn').click();
    await settle();

    expect(writeText).toHaveBeenCalledWith('https://app.example.com/x');
    expect(document.getElementById('btn').hasAttribute('data-hc-copied')).toBe(true);
    expect(copied).toHaveBeenCalledTimes(1);
    expect(copied.mock.calls[0][0].detail).toEqual({ text: 'https://app.example.com/x' });

    document.removeEventListener('hc:copied', copied);
  });

  it('copies textContent for a non-form-control target', async () => {
    document.body.innerHTML = `
      <code id="snippet">SELECT 1;</code>
      <button id="btn" data-hc-copy="#snippet">Copy</button>`;
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    expect(writeText).toHaveBeenCalledWith('SELECT 1;');
  });

  it('copies a literal via data-hc-copy-text', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="literal value">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    expect(writeText).toHaveBeenCalledWith('literal value');
  });

  it('announces the success label through a role="status" live region', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="x" data-hc-copy-ok="Copied!">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    const region = document.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region.classList.contains('hc-sr-only')).toBe(true);
    expect(region.textContent).toBe('Copied!');
  });

  it('falls back to the i18n default label when data-hc-copy-ok is absent', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="x">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    expect(document.querySelector('[role="status"]').textContent).toBe('Copied');
  });

  it('never overwrites the button’s own accessible name', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="x">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    expect(document.getElementById('btn').textContent).toBe('Copy');
  });

  it('clears data-hc-copied after the transient window', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="x">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();
    expect(document.getElementById('btn').hasAttribute('data-hc-copied')).toBe(true);

    await vi.advanceTimersByTimeAsync(1500);
    expect(document.getElementById('btn').hasAttribute('data-hc-copied')).toBe(false);
  });

  it('is a no-op without the Clipboard API (insecure context)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.body.innerHTML = `
      <input id="src" value="abc">
      <button id="btn" data-hc-copy="#src">Copy</button>`;
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();

    expect(writeText).not.toHaveBeenCalled();
    expect(document.getElementById('btn').hasAttribute('data-hc-copied')).toBe(false);
  });

  it('tolerates a malformed selector without throwing', () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy="###">Copy</button>';
    uninstall = installCopy();
    expect(() => document.getElementById('btn').click()).not.toThrow();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does nothing for clicks outside a copy trigger', async () => {
    document.body.innerHTML = '<button id="other">Other</button>';
    uninstall = installCopy();
    document.getElementById('other').click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('removes the listener and live region on uninstall', async () => {
    document.body.innerHTML = '<button id="btn" data-hc-copy-text="x">Copy</button>';
    uninstall = installCopy();

    document.getElementById('btn').click();
    await settle();
    expect(document.querySelector('[role="status"]')).not.toBeNull();

    uninstall();
    uninstall = () => {};

    expect(document.querySelector('[role="status"]')).toBeNull();
    writeText.mockClear();
    document.getElementById('btn').click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });
});
