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

describe('installToast — actions & update-by-id', () => {
  function click(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  it('renders an action button and clicking it fires a bubbling event then dismisses', () => {
    uninstall = installToast();
    const fired = vi.fn();
    document.body.addEventListener('hc:undo', (e) => fired(e.detail));
    dispatch({ message: 'Deleted item', id: 'del-1', duration: 0, action: { label: 'Undo', event: 'hc:undo' } });

    const toast = document.querySelector('.hc-toast');
    const btn = toast.querySelector('.hc-toast__action');
    expect(btn.textContent).toBe('Undo');

    click(btn);
    expect(fired).toHaveBeenCalledTimes(1);
    expect(fired.mock.calls[0][0]).toMatchObject({ id: 'del-1' });
    expect(toast.isConnected).toBe(false); // dismissed after the action
  });

  it('omits the action button when no action is provided', () => {
    uninstall = installToast();
    dispatch({ message: 'Saved' });
    expect(document.querySelector('.hc-toast__action')).toBeNull();
  });

  it('updates an existing toast in place by id (no duplicate)', () => {
    uninstall = installToast();
    dispatch({ message: 'Saving…', id: 'save', variant: 'info', duration: 0 });
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);

    dispatch({ message: 'Saved!', id: 'save', variant: 'success', duration: 4500 });

    const toasts = document.querySelectorAll('.hc-toast');
    expect(toasts.length).toBe(1); // updated, not stacked
    expect(toasts[0].querySelector('.hc-toast__body').textContent).toBe('Saved!');
    expect(toasts[0].getAttribute('data-variant')).toBe('success');
    expect(toasts[0].getAttribute('role')).toBe('status');
  });

  it('the update resets the auto-dismiss timer (sticky loading → timed success)', () => {
    uninstall = installToast();
    dispatch({ message: 'Loading…', id: 'job', duration: 0 }); // sticky
    vi.advanceTimersByTime(10_000);
    expect(document.querySelectorAll('.hc-toast').length).toBe(1); // still up

    dispatch({ message: 'Done', id: 'job', variant: 'success', duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(document.querySelectorAll('.hc-toast').length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('.hc-toast').length).toBe(0); // dismissed
  });

  it('a fresh id (no existing toast) just creates a new toast', () => {
    uninstall = installToast();
    dispatch({ message: 'First', id: 'a', duration: 0 });
    dispatch({ message: 'Second', id: 'b', duration: 0 });
    expect(document.querySelectorAll('.hc-toast').length).toBe(2);
  });

  it('the action survives an update-by-id (handler still works)', () => {
    uninstall = installToast();
    dispatch({ message: 'Working…', id: 'x', duration: 0 });
    dispatch({
      message: 'Failed',
      id: 'x',
      variant: 'error',
      duration: 0,
      action: { label: 'Retry', event: 'hc:retry' },
    });
    const fired = vi.fn();
    document.body.addEventListener('hc:retry', fired);
    click(document.querySelector('.hc-toast__action'));
    expect(fired).toHaveBeenCalledTimes(1);
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
