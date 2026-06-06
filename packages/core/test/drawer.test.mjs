import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installDrawer, dragShouldDismiss } from '../src/js/drawer.js';

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

describe('dragShouldDismiss (threshold math)', () => {
  it('dismisses past 40% of the panel size', () => {
    expect(dragShouldDismiss({ delta: 81, size: 200, velocity: 0 })).toBe(true); // > 80
    expect(dragShouldDismiss({ delta: 79, size: 200, velocity: 0 })).toBe(false);
  });

  it('dismisses on a quick flick even when short', () => {
    expect(dragShouldDismiss({ delta: 10, size: 200, velocity: 0.6 })).toBe(true);
    expect(dragShouldDismiss({ delta: 10, size: 200, velocity: 0.4 })).toBe(false);
  });
});

describe('installDrawer — drag to dismiss', () => {
  let uninstall2 = () => {};
  function pointer(el, type, { clientX = 0, clientY = 0, timeStamp = 0 } = {}) {
    const e = new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 });
    Object.defineProperty(e, 'timeStamp', { value: timeStamp, configurable: true });
    el.dispatchEvent(e);
  }
  function openDrawer() {
    const dialog = document.getElementById('dr');
    dialog.showModal();
    Object.defineProperty(dialog, 'offsetWidth', { value: 300, configurable: true });
    Object.defineProperty(dialog, 'offsetHeight', { value: 600, configurable: true });
    return dialog;
  }
  afterEach(() => {
    uninstall2();
    uninstall2 = () => {};
    vi.useRealTimers();
  });

  it('a long outward drag flies the panel out and closes it', () => {
    vi.useFakeTimers();
    document.body.innerHTML = SIMPLE;
    uninstall2 = installDrawer();
    const dialog = openDrawer();
    const closed = vi.spyOn(dialog, 'close');
    const header = document.getElementById('dr-header');

    pointer(header, 'pointerdown', { clientX: 100, timeStamp: 0 });
    pointer(header, 'pointermove', { clientX: 260, timeStamp: 50 }); // +160 > 0.4*300=120
    pointer(header, 'pointerup', { clientX: 260, timeStamp: 60 });

    expect(dialog.style.translate).toBe('100% 0'); // flying out
    vi.advanceTimersByTime(400); // fallback close (no transitionend in jsdom)
    expect(closed).toHaveBeenCalled();
  });

  it('a short drag snaps back without closing', () => {
    document.body.innerHTML = SIMPLE;
    uninstall2 = installDrawer();
    const dialog = openDrawer();
    const closed = vi.spyOn(dialog, 'close');
    const header = document.getElementById('dr-header');

    pointer(header, 'pointerdown', { clientX: 100, timeStamp: 0 });
    pointer(header, 'pointermove', { clientX: 130, timeStamp: 100 }); // +30 < 120, slow
    pointer(header, 'pointerup', { clientX: 130, timeStamp: 200 });

    expect(dialog.style.translate).toBe(''); // snapped back
    expect(closed).not.toHaveBeenCalled();
  });

  it('does not start a drag from the scrollable body or a control', () => {
    document.body.innerHTML = SIMPLE;
    uninstall2 = installDrawer();
    const dialog = openDrawer();
    const body = document.getElementById('dr-body');

    pointer(body, 'pointerdown', { clientX: 100, timeStamp: 0 });
    pointer(body, 'pointermove', { clientX: 260, timeStamp: 50 });
    pointer(body, 'pointerup', { clientX: 260, timeStamp: 60 });

    expect(dialog.style.translate).toBe(''); // never moved
    expect(dialog.open).toBe(true);
  });

  it('honors data-side="left" (drag left dismisses)', () => {
    vi.useFakeTimers();
    document.body.innerHTML = SIMPLE.replace('data-side="right"', 'data-side="left"');
    uninstall2 = installDrawer();
    const dialog = openDrawer();
    const closed = vi.spyOn(dialog, 'close');
    const header = document.getElementById('dr-header');

    pointer(header, 'pointerdown', { clientX: 200, timeStamp: 0 });
    pointer(header, 'pointermove', { clientX: 30, timeStamp: 50 }); // -170 outward (left)
    pointer(header, 'pointerup', { clientX: 30, timeStamp: 60 });

    expect(dialog.style.translate).toBe('-100% 0');
    vi.advanceTimersByTime(400);
    expect(closed).toHaveBeenCalled();
  });
});
