import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSseDispatch } from '../src/js/sse-dispatch.js';

let uninstall = () => {};

const $ = (id) => document.getElementById(id);

// Mimic the htmx SSE extension: it triggers a cancelable, bubbling
// `htmx:sseBeforeMessage` on the sse-swap element, with the underlying
// MessageEvent (`.type` = SSE event name, `.data` = payload string) as
// the CustomEvent detail. Cancelling skips the swap.
function sseMessage(el, type, data) {
  const ev = new CustomEvent('htmx:sseBeforeMessage', {
    bubbles: true,
    cancelable: true,
    detail: { type, data, elt: el },
  });
  el.dispatchEvent(ev);
  return ev;
}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="scope">
      <span hidden id="bridge" data-hc-sse-dispatch
            data-sse-swap="hc:toast, items:changed"></span>
      <section id="plain" data-sse-swap="activity:item"></section>
    </div>`;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('installSseDispatch', () => {
  it('is idempotent', () => {
    uninstall = installSseDispatch();
    expect(installSseDispatch()).toBe(uninstall);
  });

  it('cancels the swap and dispatches the SSE event as a bubbling CustomEvent', () => {
    uninstall = installSseDispatch();
    const onToast = vi.fn();
    document.body.addEventListener('hc:toast', (e) => onToast(e.detail));

    const ev = sseMessage($('bridge'), 'hc:toast', '{"message":"Build finished","variant":"success"}');

    expect(ev.defaultPrevented).toBe(true);
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast.mock.calls[0][0]).toEqual({ message: 'Build finished', variant: 'success' });
  });

  it('empty (or missing) data dispatches with an empty-object detail', () => {
    uninstall = installSseDispatch();
    const onChanged = vi.fn();
    document.body.addEventListener('items:changed', (e) => onChanged(e.detail));

    sseMessage($('bridge'), 'items:changed', '');
    sseMessage($('bridge'), 'items:changed', undefined);

    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(onChanged.mock.calls[0][0]).toEqual({});
    expect(onChanged.mock.calls[1][0]).toEqual({});
  });

  it('drops malformed JSON — swap still cancelled, nothing dispatched', () => {
    uninstall = installSseDispatch();
    const onToast = vi.fn();
    document.body.addEventListener('hc:toast', onToast);

    const ev = sseMessage($('bridge'), 'hc:toast', '{not json');

    expect(ev.defaultPrevented).toBe(true);
    expect(onToast).not.toHaveBeenCalled();
  });

  it('drops valid-JSON non-objects (array, string, number, null)', () => {
    uninstall = installSseDispatch();
    const onToast = vi.fn();
    document.body.addEventListener('hc:toast', onToast);

    for (const payload of ['[1,2]', '"hi"', '42', 'null']) {
      const ev = sseMessage($('bridge'), 'hc:toast', payload);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(onToast).not.toHaveBeenCalled();
  });

  it('drops messages with no SSE event name', () => {
    uninstall = installSseDispatch();
    const ev = sseMessage($('bridge'), undefined, '{}');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('leaves non-bridge sse-swap targets alone (their swap proceeds)', () => {
    uninstall = installSseDispatch();
    const onItem = vi.fn();
    document.body.addEventListener('activity:item', onItem);

    const ev = sseMessage($('plain'), 'activity:item', '<li>new</li>');

    expect(ev.defaultPrevented).toBe(false);
    expect(onItem).not.toHaveBeenCalled();
  });

  it('recovers after a dropped message (next valid one dispatches)', () => {
    uninstall = installSseDispatch();
    const onToast = vi.fn();
    document.body.addEventListener('hc:toast', (e) => onToast(e.detail));

    sseMessage($('bridge'), 'hc:toast', '{oops');
    sseMessage($('bridge'), 'hc:toast', '{"message":"ok"}');

    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast.mock.calls[0][0]).toEqual({ message: 'ok' });
  });

  it('uninstall stops the bridge', () => {
    const u = installSseDispatch();
    u();
    const onToast = vi.fn();
    document.body.addEventListener('hc:toast', onToast);

    const ev = sseMessage($('bridge'), 'hc:toast', '{"message":"hi"}');

    expect(ev.defaultPrevented).toBe(false);
    expect(onToast).not.toHaveBeenCalled();
  });
});
