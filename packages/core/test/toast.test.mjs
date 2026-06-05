import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installToast } from '../src/js/toast.js';

let uninstall = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function dispatch(detail) {
  document.body.dispatchEvent(
    new CustomEvent('hc:toast', { bubbles: true, detail }),
  );
}

describe('installToast', () => {
  it('lazily creates a labeled region on first toast', () => {
    uninstall = installToast();
    expect(document.querySelector('[data-hc-toast-region]')).toBeNull();

    dispatch({ message: 'Saved' });

    const region = document.querySelector('[data-hc-toast-region]');
    expect(region).not.toBeNull();
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Notifications');
    expect(region.classList.contains('hc-toast-region')).toBe(true);
  });

  it('reuses a pre-existing region instead of creating a new one', () => {
    const existing = document.createElement('div');
    existing.setAttribute('data-hc-toast-region', '');
    existing.id = 'preset-region';
    document.body.appendChild(existing);

    uninstall = installToast();
    dispatch({ message: 'Hi' });

    const all = document.querySelectorAll('[data-hc-toast-region]');
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('preset-region');
  });

  it('renders the message and (optional) title', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved.', title: 'Done' });

    const toast = document.querySelector('.hc-toast');
    expect(toast).not.toBeNull();
    expect(toast.querySelector('.hc-toast__title').textContent).toBe('Done');
    expect(toast.querySelector('.hc-toast__body').textContent).toBe('Saved.');
  });

  it('omits the title element when title is not provided', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved.' });

    const toast = document.querySelector('.hc-toast');
    expect(toast.querySelector('.hc-toast__title')).toBeNull();
    expect(toast.querySelector('.hc-toast__body').textContent).toBe('Saved.');
  });

  it('maps variant to data-variant attribute', () => {
    uninstall = installToast();
    dispatch({ message: 'A', variant: 'success' });
    dispatch({ message: 'B', variant: 'warning' });

    const toasts = document.querySelectorAll('.hc-toast');
    expect(toasts[0].getAttribute('data-variant')).toBe('success');
    expect(toasts[1].getAttribute('data-variant')).toBe('warning');
  });

  it('uses role="alert" / aria-live="assertive" for error; role="status" / polite otherwise', () => {
    uninstall = installToast();
    dispatch({ message: 'A' });
    dispatch({ message: 'B', variant: 'error' });

    const toasts = document.querySelectorAll('.hc-toast');
    expect(toasts[0].getAttribute('role')).toBe('status');
    expect(toasts[0].getAttribute('aria-live')).toBe('polite');
    expect(toasts[1].getAttribute('role')).toBe('alert');
    expect(toasts[1].getAttribute('aria-live')).toBe('assertive');
  });

  it('auto-dismisses after the default duration (4500ms)', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved' });
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);

    vi.advanceTimersByTime(4499);
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('.hc-toast').length).toBe(0);
  });

  it('honors a custom duration', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved', duration: 1000 });

    vi.advanceTimersByTime(999);
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('.hc-toast').length).toBe(0);
  });

  it('keeps the toast forever when duration=0 (sticky)', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved', duration: 0 });

    vi.advanceTimersByTime(60_000);
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);
  });

  it('ignores events without a message', () => {
    uninstall = installToast();
    dispatch({ title: 'No body' });
    dispatch(undefined);

    expect(document.querySelectorAll('.hc-toast').length).toBe(0);
  });

  it('is idempotent — repeated installs return the same uninstaller', () => {
    const off1 = installToast();
    const off2 = installToast();
    uninstall = off1;

    expect(off1).toBe(off2);

    dispatch({ message: 'Hi' });
    // Only one toast despite the double install.
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);
  });

  it('uninstall removes the listener and the auto-created region', () => {
    const off = installToast();
    dispatch({ message: 'Hi' });
    expect(document.querySelector('[data-hc-toast-region]')).not.toBeNull();

    off();

    expect(document.querySelector('[data-hc-toast-region]')).toBeNull();

    // Subsequent events do not render anything.
    dispatch({ message: 'Bye' });
    expect(document.querySelector('.hc-toast')).toBeNull();
  });

  it('uninstall preserves a region the consumer pre-rendered', () => {
    const preset = document.createElement('div');
    preset.setAttribute('data-hc-toast-region', '');
    preset.id = 'keep-me';
    document.body.appendChild(preset);

    const off = installToast();
    dispatch({ message: 'Hi' });
    off();

    expect(document.getElementById('keep-me')).not.toBeNull();
  });
});

describe('installToast — options', () => {
  function pointer(el, type, clientX) {
    el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, button: 0 }));
  }

  it('caps the stack at data-limit, evicting the oldest', () => {
    const region = document.createElement('div');
    region.setAttribute('data-hc-toast-region', '');
    region.setAttribute('data-limit', '2');
    document.body.appendChild(region);

    uninstall = installToast();
    dispatch({ message: 'one', duration: 0 });
    dispatch({ message: 'two', duration: 0 });
    dispatch({ message: 'three', duration: 0 });

    const bodies = [...region.querySelectorAll('.hc-toast__body')].map((b) => b.textContent);
    expect(region.children.length).toBe(2);
    expect(bodies).toEqual(['two', 'three']); // 'one' was evicted
  });

  it('swiping past the threshold flies the toast out and removes it', () => {
    uninstall = installToast();
    dispatch({ message: 'swipe me', duration: 0 });
    const toast = document.querySelector('[data-hc-toast-region] .hc-toast');
    Object.defineProperty(toast, 'offsetWidth', { value: 200, configurable: true });

    pointer(toast, 'pointerdown', 0);
    pointer(toast, 'pointermove', 120); // > 0.4 * 200 = 80
    pointer(toast, 'pointerup', 120);

    expect(toast.style.opacity).toBe('0'); // flying out
    vi.advanceTimersByTime(250); // fallback removal (no transitionend in jsdom)
    expect(toast.isConnected).toBe(false);
  });

  it('a short swipe snaps back without dismissing', () => {
    uninstall = installToast();
    dispatch({ message: 'keep', duration: 0 });
    const toast = document.querySelector('[data-hc-toast-region] .hc-toast');
    Object.defineProperty(toast, 'offsetWidth', { value: 200, configurable: true });

    pointer(toast, 'pointerdown', 0);
    pointer(toast, 'pointermove', 20); // < 80
    pointer(toast, 'pointerup', 20);

    expect(toast.style.translate).toBe(''); // snapped back
    expect(toast.isConnected).toBe(true);
  });
});
